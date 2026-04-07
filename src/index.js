'use strict';

require('dotenv').config();
const cron  = require('node-cron');
const chalk = require('chalk');
const { initDb }       = require('./db/schema');
const { runSync }      = require('./etl/sync');
const { runSpendSync } = require('./etl/spend-sync');

const CRON_SCHEDULE       = '0 */6 * * *'; // Every 6 hours
const SPEND_CRON_SCHEDULE = '0 2 * * *';   // Daily at 02:00

function nextRunTime() {
  const now  = new Date();
  const next = new Date(now);
  const nextHour = Math.ceil((now.getHours() + 1) / 6) * 6;
  next.setHours(nextHour % 24, 0, 0, 0);
  if (nextHour >= 24) next.setDate(next.getDate() + 1);
  return next.toLocaleString();
}

async function main() {
  const arg = process.argv[2];

  // ── CI / GitHub Actions modus ─────────────────────────────────────────────
  // node src/index.js sync       → eenmalige sync, dan exit
  // node src/index.js sync-spend → eenmalige spend sync, dan exit
  if (arg === 'sync') {
    console.log(chalk.bold.white('\n  Mvolo Attribution Dashboard — CI sync\n'));
    initDb();
    await runSync();
    process.exit(0);
  }

  if (arg === 'sync-spend') {
    console.log(chalk.bold.white('\n  Mvolo Attribution Dashboard — CI spend sync\n'));
    const db = initDb();
    await runSpendSync(db);
    process.exit(0);
  }

  // ── Lokale server modus (geen argument) ───────────────────────────────────
  console.log(chalk.bold.white('\n  Mvolo Attribution Dashboard'));
  console.log(chalk.gray('  Initialising database…'));
  initDb();
  console.log(chalk.green('  Database ready.\n'));

  // Run once immediately on startup
  await runSync();

  // Schedule subsequent order syncs every 6 hours
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(chalk.cyan(`\n  [cron] Scheduled sync triggered at ${new Date().toLocaleString()}`));
    try {
      await runSync();
    } catch (err) {
      console.error(chalk.red(`  [cron] Sync error: ${err.message}`));
    }
    console.log(chalk.gray(`  Next sync scheduled for: ${nextRunTime()}`));
  });

  // Schedule spend sync daily at 02:00
  cron.schedule(SPEND_CRON_SCHEDULE, async () => {
    console.log(chalk.cyan(`\n  [cron] Spend sync triggered at ${new Date().toLocaleString()}`));
    try {
      await runSpendSync(initDb());
    } catch (err) {
      console.error(chalk.red(`  [cron] Spend sync error: ${err.message}`));
    }
  });

  console.log(chalk.gray(`  Cron active — next automatic sync at: ${nextRunTime()}`));
  console.log(chalk.gray('  (Press Ctrl+C to stop)\n'));
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal error: ${err.message}`));
  process.exit(1);
});
