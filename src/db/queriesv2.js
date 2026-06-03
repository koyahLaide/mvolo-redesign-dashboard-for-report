'use strict';

/**
 * Returns the synced_at timestamp of the last successful sync,
 * or null if no successful sync has been recorded yet.
 *
 * @param {import('pg').Pool} pool
 * @returns {Promise<string|null>}
 */
async function getLastSyncedAt(pool) {
  const result = await pool.query(
    `SELECT synced_at FROM sync_log WHERE status = $1 ORDER BY id DESC LIMIT 1`,
    ['success']
  );
  return result.rows.length > 0 ? result.rows[0].synced_at : null;
}

/**
 * Returns true if the given email has never placed an order in the DB, false otherwise.
 * When email is null/empty, treats the customer as new.
 *
 * @param {import('pg').Pool} pool
 * @param {string|null} email
 * @returns {Promise<boolean>} true = new, false = returning
 */
async function checkIsNewCustomer(pool, email) {
  if (!email) return true;
  const result = await pool.query(
    `SELECT id FROM orders WHERE customer_email = $1 LIMIT 1`,
    [email]
  );
  return result.rows.length === 0;
}

/**
 * Inserts a single attributed order, skipping it if the id already exists.
 *
 * @param {import('pg').Pool} pool
 * @param {Object} order
 * @param {Object} attribution
 * @param {boolean} isNewCustomer - true if new, false if returning
 * @returns {Promise<boolean>} true if the row was newly inserted
 */
async function insertOrder(pool, order, attribution, isNewCustomer) {
  const result = await pool.query(
    `INSERT INTO orders (
      id, order_number, created_at, total_price, financial_status,
      channel, medium, utm_source, utm_campaign, utm_content, utm_term,
      landing_site, referring_site, source_name, synced_at,
      first_touch, last_touch, touch_path,
      customer_email, customer_id, is_new_customer, marketplace,
      shipping_city, shipping_country, device_type, browser_language
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    ) ON CONFLICT (id) DO NOTHING`,
    [
      order.id,
      order.order_number,
      order.created_at,
      order.total_price,
      order.financial_status,
      attribution.channel,
      attribution.medium,
      attribution.utm_source,
      attribution.utm_campaign,
      attribution.utm_content,
      attribution.utm_term,
      order.landing_site,
      order.referring_site,
      order.source_name,
      new Date().toISOString(),
      attribution.first_touch,
      attribution.last_touch,
      attribution.touch_path,
      order.customer_email,
      order.customer_id,
      isNewCustomer,
      order.marketplace ?? 'shopify',
      order.shipping_city ?? null,
      order.shipping_country ?? null,
      order.device_type ?? null,
      order.browser_language ?? null,
    ]
  );

  return result.rowCount > 0;
}

/**
 * Writes a record to sync_log.
 *
 * @param {import('pg').Pool} pool
 * @param {Object} entry
 */
async function logSync(pool, { syncedAt, ordersFetched, ordersNew, status, error }) {
  await pool.query(
    `INSERT INTO sync_log (synced_at, orders_fetched, orders_new, status, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [syncedAt, ordersFetched, ordersNew, status, error || null]
  );
}

module.exports = { getLastSyncedAt, insertOrder, logSync, checkIsNewCustomer };
