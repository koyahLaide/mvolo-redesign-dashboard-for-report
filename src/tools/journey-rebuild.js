'use strict';

/**
 * journey-rebuild.js
 *
 * Reconstructs customer journey data from three sources:
 *
 *   A. ProfitMetrics attribution metafields (profitmetrics.attribution per Shopify order)
 *      → populates/updates visitor_sessions with PM touch data
 *
 *   B. Meta attribution windows (1d_click / 7d_click / 28d_click)
 *      → populates journey_meta table for window analysis
 *
 *   C. Repeat purchase analysis from orders table
 *      → computes avg days between purchases per customer_email (stored in DB for dashboard)
 *
 * Usage:  node src/tools/journey-rebuild.js
 */

require('dotenv').config();

const chalk = require('chalk');
const axios  = require('axios');
const { initDb } = require('../db/schema');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Shopify helpers ───────────────────────────────────────────────────────────
const API_VERSION = '2024-01';

function shopifyBase() {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_TOKEN;
  if (!store || !token) throw new Error('SHOPIFY_STORE and SHOPIFY_TOKEN must be set in .env');
  return { base: `https://${store}/admin/api/${API_VERSION}`, token };
}

async function fetchPmMetafield(orderId, base, token) {
  try {
    const res = await axios.get(`${base}/orders/${orderId}/metafields.json`, {
      headers: { 'X-Shopify-Access-Token': token },
      params:  { namespace: 'profitmetrics', key: 'attribution' },
    });
    const mf = (res.data.metafields ?? []).find(
      (m) => m.namespace === 'profitmetrics' && m.key === 'attribution'
    );
    if (!mf) return null;
    return typeof mf.value === 'string' ? JSON.parse(mf.value) : mf.value;
  } catch {
    return null;
  }
}

// ── 0. Backfill customer_email / customer_id from Shopify ────────────────────
async function backfillCustomerEmails(db) {
  console.log(chalk.cyan('\n  [0] Backfilling customer_email / customer_id from Shopify'));

  const { base, token } = shopifyBase();

  const updateStmt = db.prepare(`
    UPDATE orders SET customer_email = @email, customer_id = @cid
    WHERE id = @id AND (customer_email IS NULL OR customer_email = '')
  `);

  let nextUrl = `${base}/orders.json`;
  let params  = { limit: 250, fields: 'id,email,customer', status: 'any' };
  let total   = 0;
  let updated = 0;

  while (nextUrl) {
    let res;
    try {
      res = await axios.get(nextUrl, {
        headers: { 'X-Shopify-Access-Token': token },
        params,
      });
    } catch (err) {
      console.warn(chalk.yellow(`  Shopify fetch failed: ${err.message}`));
      break;
    }

    const orders = res.data.orders ?? [];
    for (const o of orders) {
      const email = o.email || o.customer?.email || null;
      const cid   = o.customer?.id ? String(o.customer.id) : null;
      if (email || cid) {
        const r = updateStmt.run({ id: String(o.id), email, cid });
        if (r.changes) updated++;
      }
      total++;
    }

    process.stdout.write(chalk.cyan(`.`));

    // Cursor-based pagination via Link header
    const link = res.headers['link'] ?? '';
    const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
    if (nextMatch) {
      nextUrl = nextMatch[1];
      params  = {}; // page_info is already in the URL
      await delay(300);
    } else {
      nextUrl = null;
    }
  }

  process.stdout.write('\n');
  console.log(chalk.green(`  Done — checked ${total} orders, updated ${updated} with customer data`));
}

// ── A. ProfitMetrics metafield → visitor_sessions ────────────────────────────
async function rebuildPmJourney(db) {
  console.log(chalk.cyan('\n  [A] ProfitMetrics attribution metafields → visitor_sessions'));

  const { base, token } = shopifyBase();

  // Get Shopify orders that are in our DB (Shopify orders only, last 90d)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const dbOrders = db.prepare(`
    SELECT id, order_number, created_at, channel, first_touch, last_touch
    FROM orders
    WHERE marketplace = 'shopify' OR marketplace IS NULL
      AND created_at >= ?
    ORDER BY created_at DESC
  `).all(cutoffStr);

  console.log(chalk.white(`  Processing ${dbOrders.length} Shopify orders…`));

  const upsert = db.prepare(`
    INSERT INTO visitor_sessions
      (visitor_id, order_id, session_count, first_touch_date, last_touch_date,
       days_to_convert, sessions_before_purchase, touch_path, created_at)
    VALUES
      (@visitor_id, @order_id, @session_count, @first_touch_date, @last_touch_date,
       @days_to_convert, @sessions_before_purchase, @touch_path, @created_at)
    ON CONFLICT DO NOTHING
  `);

  let processed = 0;
  let enriched  = 0;

  for (const order of dbOrders) {
    // Shopify order IDs in DB look like "6173..." (numeric string, no prefix)
    const shopifyId = order.id.replace(/^bol_/, '');
    const pm = await fetchPmMetafield(shopifyId, base, token);
    processed++;

    if (!pm) {
      process.stdout.write(chalk.gray('.'));
      await delay(120);
      continue;
    }

    // PM attribution metafield structure: { first_touch, last_touch, touches: [...] }
    const touches     = Array.isArray(pm.touches) ? pm.touches : [];
    const touchCount  = touches.length || 1;
    const touchPath   = JSON.stringify(touches.map((t) => t.channel ?? t.source ?? 'unknown'));

    // Compute days to convert from first → last touch
    const firstDate = pm.first_touch?.date ?? pm.first_click_date ?? order.created_at;
    const lastDate  = order.created_at;
    const days = firstDate
      ? Math.max(0, Math.round((new Date(lastDate) - new Date(firstDate)) / 86400000))
      : 0;

    try {
      upsert.run({
        visitor_id:               `pm_${order.id}`,
        order_id:                 order.id,
        session_count:            touchCount,
        first_touch_date:         firstDate,
        last_touch_date:          lastDate,
        days_to_convert:          days,
        sessions_before_purchase: touchCount,
        touch_path:               touchPath,
        created_at:               new Date().toISOString(),
      });
      enriched++;
      process.stdout.write(chalk.green('.'));
    } catch {
      process.stdout.write(chalk.yellow('.'));
    }

    await delay(150);
    if (processed % 50 === 0) process.stdout.write(chalk.cyan(` [${processed}]\n`));
  }

  process.stdout.write('\n');
  console.log(chalk.green(`  Done — processed ${processed}, enriched ${enriched}`));
  return { processed, enriched };
}

// ── B. Meta attribution windows → journey_meta ───────────────────────────────
async function rebuildMetaWindows(db) {
  console.log(chalk.cyan('\n  [B] Meta attribution windows (1d/7d/28d) → journey_meta'));

  const TOKEN      = process.env.META_ACCESS_TOKEN;
  const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

  if (!TOKEN || !ACCOUNT_ID) {
    console.warn(chalk.yellow('  Skipped — META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not set'));
    return;
  }

  const BASE = 'https://graph.facebook.com/v19.0';

  /**
   * Fetch all pages for one attribution window.
   * When a single window is requested, Meta puts the count in actions[].value.
   * Using separate calls per window gives true per-window figures.
   */
  async function fetchWindow(windowName) {
    const byKey = new Map(); // "date||campaign_name" → { purchases, revenue }
    let after = null;

    while (true) {
      const params = {
        access_token:               TOKEN,
        level:                      'campaign',
        fields:                     'campaign_name,date_start,actions,action_values',
        action_attribution_windows: windowName,   // single string, not array
        date_preset:                'last_90d',
        time_increment:             1,
        limit:                      500,
        ...(after ? { after } : {}),
      };

      let response;
      try {
        response = await axios.get(`${BASE}/act_${ACCOUNT_ID}/insights`, { params });
      } catch (err) {
        const msg = err.response?.data?.error?.message ?? err.message;
        console.warn(chalk.yellow(`  Meta API error [${windowName}]: ${msg}`));
        break;
      }

      for (const row of (response.data.data ?? [])) {
        const key = `${row.date_start}||${row.campaign_name ?? ''}`;
        const purchases = (row.actions ?? [])
          .filter((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
          .reduce((s, a) => s + Number(a.value ?? 0), 0);
        const revenue = (row.action_values ?? [])
          .filter((a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase')
          .reduce((s, a) => s + Number(a.value ?? 0), 0);

        byKey.set(key, {
          date:          row.date_start,
          campaign_name: row.campaign_name ?? null,
          purchases:     Math.round(purchases),
          revenue:       Math.round(revenue * 100) / 100,
        });
      }

      const paging = response.data.paging;
      if (paging?.next && paging?.cursors?.after) {
        after = paging.cursors.after;
        await delay(400);
      } else {
        break;
      }
    }

    return byKey;
  }

  console.log(chalk.white('  Fetching 1d_click window…'));
  const map1d  = await fetchWindow('1d_click');
  await delay(600);
  console.log(chalk.white('  Fetching 7d_click window…'));
  const map7d  = await fetchWindow('7d_click');
  await delay(600);
  console.log(chalk.white('  Fetching 28d_click window…'));
  const map28d = await fetchWindow('28d_click');

  if (map28d.size === 0 && map7d.size === 0 && map1d.size === 0) {
    console.log(chalk.yellow('  No Meta attribution data returned'));
    return;
  }

  // Merge all keys across the three windows
  const allKeys = new Set([...map1d.keys(), ...map7d.keys(), ...map28d.keys()]);

  const rows = [];
  for (const key of allKeys) {
    const r1  = map1d.get(key)  ?? { purchases: 0, revenue: 0 };
    const r7  = map7d.get(key)  ?? { purchases: 0, revenue: 0 };
    const r28 = map28d.get(key) ?? map7d.get(key) ?? map1d.get(key);
    if (!r28) continue;

    rows.push({
      date:          r28.date,
      channel:       'meta_ads',
      campaign_name: r28.campaign_name,
      purchases_1d:  r1.purchases,
      purchases_7d:  r7.purchases,
      purchases_28d: r28.purchases,
      revenue_1d:    r1.revenue,
      revenue_7d:    r7.revenue,
      revenue_28d:   r28.revenue,
    });
  }

  // Clear and re-insert
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  db.prepare(`DELETE FROM journey_meta WHERE date >= ?`).run(cutoffStr);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO journey_meta
      (date, channel, campaign_name, purchases_1d, purchases_7d, purchases_28d,
       revenue_1d, revenue_7d, revenue_28d)
    VALUES
      (@date, @channel, @campaign_name, @purchases_1d, @purchases_7d, @purchases_28d,
       @revenue_1d, @revenue_7d, @revenue_28d)
  `);
  for (const r of rows) insert.run(r);

  const total1d  = rows.reduce((s, r) => s + r.purchases_1d,  0);
  const total7d  = rows.reduce((s, r) => s + r.purchases_7d,  0);
  const total28d = rows.reduce((s, r) => s + r.purchases_28d, 0);
  console.log(chalk.green(`  Done — ${rows.length} rows | 1d: ${total1d} / 7d: ${total7d} / 28d: ${total28d} aankopen`));
}

// ── C. Repeat purchase analysis ───────────────────────────────────────────────
async function repeatPurchaseAnalysis(db) {
  console.log(chalk.cyan('\n  [C] Repeat purchase analysis from orders table'));

  // Find customers with >1 order, compute avg days between orders, grouped by first-order channel
  // Use customer_id if available, else customer_email as fallback
  const result = db.prepare(`
    WITH ordered AS (
      SELECT
        COALESCE(customer_id, customer_email) AS customer_key,
        channel,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(customer_id, customer_email)
          ORDER BY created_at
        ) AS rn
      FROM orders
      WHERE COALESCE(customer_id, customer_email) IS NOT NULL
        AND COALESCE(customer_id, customer_email) != ''
    ),
    pairs AS (
      SELECT
        a.customer_key,
        a.channel AS first_channel,
        ROUND((julianday(b.created_at) - julianday(a.created_at)), 1) AS days_between
      FROM ordered a
      JOIN ordered b
        ON a.customer_key = b.customer_key
       AND b.rn = a.rn + 1
    )
    SELECT
      first_channel,
      COUNT(*)                           AS repeat_purchases,
      ROUND(AVG(days_between), 1)        AS avg_days_between,
      ROUND(MIN(days_between), 1)        AS min_days,
      ROUND(MAX(days_between), 1)        AS max_days
    FROM pairs
    GROUP BY first_channel
    ORDER BY repeat_purchases DESC
  `).all();

  if (result.length === 0) {
    console.log(chalk.yellow('  No repeat purchase data found'));
    return;
  }

  console.log(chalk.white('  Repeat purchase summary:'));
  for (const row of result) {
    console.log(
      `  ${chalk.bold(row.first_channel.padEnd(22))}` +
      ` ${chalk.green(String(row.repeat_purchases).padStart(3))} herhaalaankopen` +
      ` | gem. ${chalk.cyan(row.avg_days_between)} dagen`
    );
  }
  console.log(chalk.green(`\n  Done — ${result.length} channels met herhaalaankopen`));
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo Dashboard — Journey Rebuild'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // 0 — Backfill customer emails
  try {
    await backfillCustomerEmails(db);
  } catch (err) {
    console.warn(chalk.yellow(`  [0] Skipped: ${err.message}`));
  }

  // A — PM metafield → visitor_sessions
  try {
    await rebuildPmJourney(db);
  } catch (err) {
    console.warn(chalk.yellow(`  [A] Skipped: ${err.message}`));
  }

  // B — Meta attribution windows → journey_meta
  try {
    await rebuildMetaWindows(db);
  } catch (err) {
    console.warn(chalk.yellow(`  [B] Skipped: ${err.message}`));
  }

  // C — Repeat purchase analysis (always runs, just needs orders in DB)
  try {
    await repeatPurchaseAnalysis(db);
  } catch (err) {
    console.warn(chalk.yellow(`  [C] Skipped: ${err.message}`));
  }

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.green('  Journey rebuild complete ✓'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  db.close();
}

run().catch((err) => {
  console.error(chalk.red('\n[journey-rebuild] Fatal error:'), err.message);
  process.exit(1);
});
