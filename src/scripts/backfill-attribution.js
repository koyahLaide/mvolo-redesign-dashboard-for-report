'use strict';

/**
 * backfill-attribution.js
 *
 * Vult first_touch, last_touch, touch_path en direct_subchannel in
 * voor alle bestaande orders waar deze kolommen nog NULL zijn.
 *
 * Gebruik:
 *   node src/scripts/backfill-attribution.js
 *
 * Veilig om meerdere keren te draaien (idempotent).
 */

require('dotenv').config();
const chalk = require('chalk');
const { initDb } = require('../db/schema');
const { attributeOrder, getDirectSubchannel } = require('../etl/attribution');

async function runBackfill() {
  const db = initDb();

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan.bold('  Mvolo — Attribution Backfill'));
  console.log(chalk.cyan(`  ${new Date().toLocaleString()}`));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  // Haal alle orders op waar first_touch nog ontbreekt
  const orders = db.prepare(`
    SELECT id, landing_site, referring_site, channel, marketplace
    FROM orders
    WHERE first_touch IS NULL
       OR last_touch IS NULL
  `).all();

  console.log(chalk.white(`  Orders te verwerken: ${chalk.bold(orders.length)}\n`));

  if (orders.length === 0) {
    console.log(chalk.green('  ✔ Niets te doen — alle orders hebben al attribution data.\n'));
    return;
  }

  const updateStmt = db.prepare(`
    UPDATE orders
    SET
      first_touch       = @first_touch,
      last_touch        = @last_touch,
      touch_path        = @touch_path,
      direct_subchannel = @direct_subchannel,
      channel           = @channel,
      medium            = @medium,
      utm_source        = @utm_source,
      utm_campaign      = @utm_campaign,
      utm_content       = @utm_content,
      utm_term          = @utm_term
    WHERE id = @id
  `);

  // Kanaal tellers voor de samenvatting
  const channelCounts = {};
  let updated = 0;
  let skipped = 0;

  // Bol marketplace orders: vaste attribution, geen re-attribuering nodig
  const BOL_ATTRIBUTION = {
    channel:          'bol_marketplace',
    medium:           'marketplace',
    utm_source:       'bol',
    utm_campaign:     null,
    utm_content:      null,
    utm_term:         null,
    first_touch:      'bol_marketplace',
    last_touch:       'bol_marketplace',
    touch_path:       JSON.stringify(['bol_marketplace']),
    direct_subchannel: null,
  };

  const backfill = db.transaction(() => {
    for (const order of orders) {
      try {
        let attribution;

        if (order.marketplace === 'bol') {
          attribution = BOL_ATTRIBUTION;
        } else {
          // Herbereken attribution op basis van landing_site + referring_site
          attribution = attributeOrder({
            landing_site:   order.landing_site,
            referring_site: order.referring_site,
          });
        }

        updateStmt.run({
          id:               order.id,
          first_touch:      attribution.first_touch,
          last_touch:       attribution.last_touch,
          touch_path:       attribution.touch_path,
          direct_subchannel: attribution.direct_subchannel ?? null,
          channel:          attribution.channel,
          medium:           attribution.medium,
          utm_source:       attribution.utm_source,
          utm_campaign:     attribution.utm_campaign,
          utm_content:      attribution.utm_content,
          utm_term:         attribution.utm_term,
        });

        channelCounts[attribution.channel] = (channelCounts[attribution.channel] || 0) + 1;
        updated++;

      } catch (err) {
        console.warn(chalk.yellow(`  ⚠ Order ${order.id} overgeslagen: ${err.message}`));
        skipped++;
      }
    }
  });

  backfill();

  // ── Samenvatting ────────────────────────────────────────────────────────────
  console.log(chalk.green.bold(`  ✔ Backfill klaar\n`));
  console.log(chalk.white(`  ${'Bijgewerkt'.padEnd(25)} ${chalk.bold(updated)}`));
  console.log(chalk.white(`  ${'Overgeslagen (fout)'.padEnd(25)} ${chalk.bold(skipped)}\n`));

  if (Object.keys(channelCounts).length > 0) {
    console.log(chalk.white.bold('  Kanaalverdeling na backfill:'));
    const total = updated || 1;

    const channelColors = {
      meta_ads:         chalk.magenta,
      google_search:    chalk.blue,
      google_shopping:  chalk.cyan,
      awin_affiliate:   chalk.yellow,
      email:            chalk.green,
      organic_search:   chalk.greenBright,
      organic_social:   chalk.magentaBright,
      bol_marketplace:  chalk.blueBright,
      direct:           chalk.white,
      ai_referral:      chalk.cyanBright,
      other:            chalk.gray,
    };

    for (const [channel, count] of Object.entries(channelCounts).sort((a, b) => b[1] - a[1])) {
      const pct  = ((count / total) * 100).toFixed(1);
      const bar  = '█'.repeat(Math.max(1, Math.round((count / total) * 20)));
      const color = channelColors[channel] || chalk.white;
      console.log(
        `  ${color(channel.padEnd(22))}  ${String(count).padStart(4)} orders  ${chalk.gray(pct.padStart(5) + '%')}  ${color(bar)}`
      );
    }
  }

  // Controleer hoeveel orders nog steeds NULL hebben (sanity check)
  const remaining = db.prepare(`
    SELECT COUNT(*) as cnt FROM orders WHERE first_touch IS NULL OR last_touch IS NULL
  `).get();

  if (remaining.cnt > 0) {
    console.log(chalk.yellow(`\n  ⚠ Nog ${remaining.cnt} orders zonder attribution — mogelijk Bol orders zonder marketplace vlag.`));
  } else {
    console.log(chalk.green('\n  ✔ Alle orders hebben nu attribution data.'));
  }

  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

runBackfill().catch((err) => {
  console.error(chalk.red(`\n  Fatal error: ${err.message}`));
  process.exit(1);
});
