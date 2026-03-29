'use strict';

/**
 * Returns the synced_at timestamp of the last successful sync,
 * or null if no successful sync has been recorded yet.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {string|null}
 */
function getLastSyncedAt(db) {
  const row = db
    .prepare(`SELECT synced_at FROM sync_log WHERE status = 'success' ORDER BY id DESC LIMIT 1`)
    .get();
  return row ? row.synced_at : null;
}

/**
 * Inserts a single attributed order, skipping it if the id already exists.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Object} order
 * @param {Object} attribution
 * @returns {boolean} true if the row was newly inserted
 */
function insertOrder(db, order, attribution) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO orders (
      id, order_number, created_at, total_price, financial_status,
      channel, medium, utm_source, utm_campaign, utm_content, utm_term,
      landing_site, referring_site, source_name, synced_at
    ) VALUES (
      @id, @order_number, @created_at, @total_price, @financial_status,
      @channel, @medium, @utm_source, @utm_campaign, @utm_content, @utm_term,
      @landing_site, @referring_site, @source_name, @synced_at
    )
  `);

  const result = stmt.run({
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    total_price: order.total_price,
    financial_status: order.financial_status,
    channel: attribution.channel,
    medium: attribution.medium,
    utm_source: attribution.utm_source,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    landing_site: order.landing_site,
    referring_site: order.referring_site,
    source_name: order.source_name,
    synced_at: new Date().toISOString(),
  });

  return result.changes > 0;
}

/**
 * Writes a record to sync_log.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Object} entry
 */
function logSync(db, { syncedAt, ordersFetched, ordersNew, status, error }) {
  db.prepare(`
    INSERT INTO sync_log (synced_at, orders_fetched, orders_new, status, error)
    VALUES (@synced_at, @orders_fetched, @orders_new, @status, @error)
  `).run({
    synced_at: syncedAt,
    orders_fetched: ordersFetched,
    orders_new: ordersNew,
    status,
    error: error || null,
  });
}

module.exports = { getLastSyncedAt, insertOrder, logSync };
