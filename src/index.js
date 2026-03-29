'use strict';

require('dotenv').config();

const cron = require('node-cron');
const chalk = require('chalk');
const { initDb } = require('./db/schema');
const { runSync } = require('./etl/sync');

const CRON_SCHEDULE = '0 */6 * * *'; // Every 6 hours

function nextRunTime() {
  const now = new Date();
  const next = new Date(now);
  // Advance to the next 6-hour mark (00:00, 06:00, 12:00, 18:00)
  const nextHour = Math.ceil((now.getHours() + 1) / 6) * 6;
  next.setHours(nextHour % 24, 0, 0, 0);
  if (nextHour >= 24) next.setDate(next.getDate() + 1);
  return next.toLocaleString();
}

async function main() {
  console.log(chalk.bold.white('\n  Mvolo Attribution Dashboard'));
  console.log(chalk.gray('  Initialising database…'));

  initDb();
  console.log(chalk.green('  Database ready.\n'));

  // Run once immediately on startup
  await runSync();

  // Schedule subsequent syncs every 6 hours
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log(chalk.cyan(`\n  [cron] Scheduled sync triggered at ${new Date().toLocaleString()}`));
    try {
      await runSync();
    } catch (err) {
      console.error(chalk.red(`  [cron] Sync error: ${err.message}`));
    }
    console.log(chalk.gray(`  Next sync scheduled for: ${nextRunTime()}`));
  });

  console.log(chalk.gray(`  Cron active — next automatic sync at: ${nextRunTime()}`));
  console.log(chalk.gray('  (Press Ctrl+C to stop)\n'));
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal error: ${err.message}`));
  process.exit(1);
});
