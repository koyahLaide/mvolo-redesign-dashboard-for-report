'use strict';

/**
 * Weekly Slack rapport — kanaal breakdown, direct breakdown, CR per kanaal.
 * Stuurt altijd een bericht, ook als sommige data ontbreekt.
 *
 * Gebruik: node src/reports/weekly-slack.js
 */

require('dotenv').config();

const axios  = require('axios');
const chalk  = require('chalk');
const { initDb } = require('../db/schema');

const WEBHOOK = process.env.SLACK_WEBHOOK_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────

function euro(n) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n ?? 0);
}

function pct(n, total) {
  if (!total) return '—';
  return ((n / total) * 100).toFixed(1) + '%';
}

function safePct(numerator, denominator) {
  if (!denominator || denominator === 0) return 'n/b';
  return ((numerator / denominator) * 100).toFixed(1) + '%';
}

const DIRECT_LABELS = {
  direct_typed:   'Direct getypt',
  dark_social:    'Dark social',
  email_no_utm:   'E-mail (geen UTM)',
  meta_no_utm:    'Meta Ads (geen UTM)',
  ios_private:    'iOS privé',
  direct_unknown: 'Onbekend',
};

// ── Database queries ──────────────────────────────────────────────────────────

function queryOrFallback(db, sql, fallback) {
  try {
    return db.prepare(sql).all();
  } catch {
    return fallback;
  }
}

function queryOneOrFallback(db, sql, fallback) {
  try {
    return db.prepare(sql).get() ?? fallback;
  } catch {
    return fallback;
  }
}

// ── Slack payload builder ─────────────────────────────────────────────────────

function buildPayload({ totals, channels, directSubs, ga4Sessions, period }) {
  const totalOrders  = totals.total_orders  ?? 0;
  const totalRevenue = totals.total_revenue ?? 0;
  const newCustomers = totals.new_customers ?? 0;

  // Overall conversion rate
  const totalSessions = ga4Sessions.reduce((s, r) => s + (r.sessions ?? 0), 0);
  const overallCR = safePct(totalOrders, totalSessions);

  // GA4 sessions mapped by channel
  const GA4_MAP = {
    'Direct':         'direct',
    'Organic Search': 'organic_search',
    'Paid Social':    'meta_ads',
    'Paid Search':    'google_search',
    'Email':          'email',
    'Organic Social': 'organic_social',
    'Affiliates':     'awin_affiliate',
    'Referral':       'other',
    'Unassigned':     'other',
  };
  const ga4Map = {};
  for (const row of ga4Sessions) {
    const key = GA4_MAP[row.channel] ?? row.channel.toLowerCase().replace(/\s+/g, '_');
    ga4Map[key] = (ga4Map[key] ?? 0) + (row.sessions ?? 0);
  }

  // ── Channel table text ────────────────────────────────────────────────────
  const channelLines = channels.length
    ? channels.map((ch) => {
        const sess = ga4Map[ch.channel] ?? 0;
        const cr   = safePct(ch.orders, sess);
        const name = (ch.channel || 'onbekend').replace(/_/g, ' ');
        return `• *${name}*: ${ch.orders} orders · ${euro(ch.revenue)} · CR: ${cr}`;
      }).join('\n')
    : '_Geen kanaaldata beschikbaar_';

  // ── Direct breakdown text ─────────────────────────────────────────────────
  const directTotal = directSubs.reduce((s, r) => s + (r.orders ?? 0), 0);
  const directLines = directSubs.length
    ? directSubs.map((r) => {
        const label = DIRECT_LABELS[r.subchannel] ?? r.subchannel;
        return `  ◦ ${label}: ${r.orders} (${pct(r.orders, directTotal)}) · ${euro(r.revenue)}`;
      }).join('\n')
    : '  ◦ _Geen directe orders of nog geen backfill uitgevoerd_';

  const dateLabel = period === 'week' ? 'Afgelopen 7 dagen' : 'Alle tijd';

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📊 Mvolo Weekly Rapport — ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`, emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Periode:* ${dateLabel}\n*Orders:* ${totalOrders} · *Omzet:* ${euro(totalRevenue)} · *Nieuwe klanten:* ${newCustomers} · *Sitewide CR:* ${overallCR}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Kanaal breakdown*\n${channelLines}` },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Direct breakdown* (${directTotal} directe orders)\n${directLines}`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Gegenereerd op ${new Date().toLocaleString('nl-NL')} · Mvolo Attribution Dashboard` },
        ],
      },
    ],
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo — Weekly Slack Rapport'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  if (!WEBHOOK) {
    console.warn(chalk.yellow('  ⚠ SLACK_WEBHOOK_URL niet ingesteld in .env — rapport overgeslagen\n'));
    process.exit(0);
  }

  let db;
  try {
    db = initDb();
    console.log(chalk.green('  ✔ Database verbonden\n'));
  } catch (err) {
    console.error(chalk.red(`  ✖ Database fout: ${err.message}`));
    // Still try to send an error notification
    await sendToSlack({ text: `⚠️ Mvolo rapport kon niet worden gegenereerd: database niet bereikbaar (${err.message})` });
    process.exit(1);
  }

  // Totals — afgelopen 7 dagen
  const period = 'week';
  const dateFilter = "created_at >= DATE('now', '-7 days')";

  const totals = queryOneOrFallback(db, `
    SELECT
      COUNT(*) as total_orders,
      ROUND(SUM(total_price), 2) as total_revenue,
      SUM(CASE WHEN is_new_customer = 1 THEN 1 ELSE 0 END) as new_customers
    FROM orders
    WHERE ${dateFilter}
  `, { total_orders: 0, total_revenue: 0, new_customers: 0 });

  const channels = queryOrFallback(db, `
    SELECT
      channel,
      COUNT(*) as orders,
      ROUND(SUM(total_price), 2) as revenue
    FROM orders
    WHERE ${dateFilter}
    GROUP BY channel
    ORDER BY orders DESC
  `, []);

  const directSubs = queryOrFallback(db, `
    SELECT
      COALESCE(direct_subchannel, 'direct_unknown') as subchannel,
      COUNT(*) as orders,
      ROUND(SUM(total_price), 2) as revenue
    FROM orders
    WHERE channel = 'direct' AND ${dateFilter}
    GROUP BY direct_subchannel
    ORDER BY orders DESC
  `, []);

  const ga4Sessions = queryOrFallback(db, `
    SELECT channel, SUM(sessions) as sessions
    FROM ga4_sessions
    WHERE date >= DATE('now', '-7 days')
    GROUP BY channel
  `, []);

  console.log(chalk.white(`  Orders (7d):    ${chalk.bold(totals.total_orders)}`));
  console.log(chalk.white(`  Omzet (7d):     ${chalk.bold(euro(totals.total_revenue))}`));
  console.log(chalk.white(`  Kanalen:        ${chalk.bold(channels.length)}`));
  console.log(chalk.white(`  Direct subs:    ${chalk.bold(directSubs.length)}\n`));

  const payload = buildPayload({ totals, channels, directSubs, ga4Sessions, period });

  await sendToSlack(payload);
  console.log(chalk.green.bold('  ✔ Slack rapport verstuurd\n'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

async function sendToSlack(payload) {
  try {
    await axios.post(WEBHOOK, payload);
  } catch (err) {
    const msg = err.response?.data ?? err.message;
    console.error(chalk.red(`  ✖ Slack versturen mislukt: ${JSON.stringify(msg)}`));
    throw err;
  }
}

run().catch((err) => {
  console.error(chalk.red(`\n  Fatal: ${err.message}\n`));
  process.exit(1);
});
