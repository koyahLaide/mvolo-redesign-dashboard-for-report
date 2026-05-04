'use strict';

async function rebuildDailyMetrics({ db, from, to }) {
  // Aggregate spend per date+channel from ad_spend
  const spendAgg = db
    .prepare(
      `
    SELECT date, channel, ROUND(SUM(spend), 2) as spend
    FROM ad_spend
    WHERE date >= ? AND date <= ?
    GROUP BY date, channel
  `,
    )
    .all(from, to);

  // Aggregate orders per date+channel from orders
  const ordersAgg = db
    .prepare(
      `
    SELECT
      DATE(created_at) as date,
      channel,
      COUNT(*)                                                      as orders,
      ROUND(SUM(total_price), 2)                                    as revenue,
      ROUND(SUM(COALESCE(profit, 0)), 2)                            as profit,
      SUM(CASE WHEN is_new_customer = 1 THEN 1 ELSE 0 END)          as new_customers
    FROM orders
    WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
    GROUP BY DATE(created_at), channel
  `,
    )
    .all(from, to);

  // Build a map: "date__channel" → metrics
  const metricsMap = new Map();

  for (const row of spendAgg) {
    const key = `${row.date}__${row.channel}`;
    metricsMap.set(key, {
      date: row.date,
      channel: row.channel,
      spend: row.spend,
      revenue: 0,
      profit: 0,
      orders: 0,
      new_customers: 0,
    });
  }

  for (const row of ordersAgg) {
    const key = `${row.date}__${row.channel}`;
    if (!metricsMap.has(key)) {
      metricsMap.set(key, {
        date: row.date,
        channel: row.channel,
        spend: 0,
        revenue: row.revenue,
        profit: row.profit,
        orders: row.orders,
        new_customers: row.new_customers,
      });
    } else {
      const entry = metricsMap.get(key);
      entry.revenue = row.revenue;
      entry.profit = row.profit;
      entry.orders = row.orders;
      entry.new_customers = row.new_customers;
    }
  }

  const upsertMetrics = db.prepare(`
    INSERT INTO daily_metrics
      (date, channel, spend, revenue, profit, orders, new_customers, roas, poas, cac)
    VALUES
      (@date, @channel, @spend, @revenue, @profit, @orders, @new_customers, @roas, @poas, @cac)
    ON CONFLICT(date, channel) DO UPDATE SET
      spend         = excluded.spend,
      revenue       = excluded.revenue,
      profit        = excluded.profit,
      orders        = excluded.orders,
      new_customers = excluded.new_customers,
      roas          = excluded.roas,
      poas          = excluded.poas,
      cac           = excluded.cac
  `);

  let metricsUpserted = 0;
  for (const m of metricsMap.values()) {
    const roas = m.spend > 0 ? Math.round((m.revenue / m.spend) * 100) / 100 : 0;
    const poas = m.spend > 0 ? Math.round((m.profit / m.spend) * 100) / 100 : 0;
    const cac = m.new_customers > 0 ? Math.round((m.spend / m.new_customers) * 100) / 100 : 0;
    upsertMetrics.run({ ...m, roas, poas, cac });
    metricsUpserted++;
  }

  return { upserted: metricsUpserted };
}

module.exports = { rebuildDailyMetrics };
