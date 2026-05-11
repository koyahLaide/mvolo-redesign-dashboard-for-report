'use strict';

async function rebuildDailyMetrics({ db, from, to }) {
  // Aggregate spend per date+channel from ad_spend
  const spendAgg = (
    await db.query(
      `
  SELECT date, channel, ROUND(SUM(spend)::numeric, 2) as spend
  FROM ad_spend
  WHERE date >= $1 AND date <= $2
  GROUP BY date, channel
`,
      [from, to],
    )
  ).rows;

  // Aggregate orders per date+channel from orders, this time in Supabase
  const ordersAgg = (
    await db.query(
      `
  SELECT
    created_at::date                                              as date,
    channel,
    COUNT(*)                                                      as orders,
    ROUND(SUM(total_price)::numeric, 2)                           as revenue,
    ROUND(SUM(COALESCE(profit, 0))::numeric, 2)                   as profit,
    SUM(is_new_customer::int)                                     as new_customers
  FROM orders
  WHERE created_at::date >= $1 AND created_at::date <= $2
  GROUP BY created_at::date, channel
`,
      [from, to],
    )
  ).rows;

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

  const metricsUpserted = metricsMap.size;
  if (metricsUpserted > 0) {
    const values = [];
    const placeholders = [];
    let i = 1;
    for (const m of metricsMap.values()) {
      const roas = m.spend > 0 ? Math.round((m.revenue / m.spend) * 100) / 100 : 0;
      const poas = m.spend > 0 ? Math.round((m.profit / m.spend) * 100) / 100 : 0;
      const cac = m.new_customers > 0 ? Math.round((m.spend / m.new_customers) * 100) / 100 : 0;
      placeholders.push(
        `($${i}, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7}, $${i + 8}, $${i + 9})`,
      );
      values.push(
        m.date,
        m.channel,
        m.spend,
        m.revenue,
        m.profit,
        m.orders,
        m.new_customers,
        roas,
        poas,
        cac,
      );
      i += 10;
    }
    await db.query(
      `
      INSERT INTO daily_metrics
        (date, channel, spend, revenue, profit, orders, new_customers, roas, poas, cac)
      VALUES ${placeholders.join(',')}
      ON CONFLICT(date, channel) DO UPDATE SET
        spend         = excluded.spend,
        revenue       = excluded.revenue,
        profit        = excluded.profit,
        orders        = excluded.orders,
        new_customers = excluded.new_customers,
        roas          = excluded.roas,
        poas          = excluded.poas,
        cac           = excluded.cac
    `,
      values,
    );
  }
  return { upserted: metricsUpserted };
}

module.exports = { rebuildDailyMetrics };
