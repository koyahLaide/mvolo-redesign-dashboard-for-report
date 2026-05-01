'use strict';

const chalk = require('chalk');
const schema = require('./schema/supabase');
const { pool } = require('./db');

/**
 * Initializes the Supabase PostgreSQL connection and ensures the modular
 * schema is applied.
 */
async function initSupabase() {
  const client = await pool.connect();
  try {
    process.stdout.write(chalk.gray('  Verifying Supabase schema... '));
    // Execute the combined modular schema SQL
    await client.query(schema);
    process.stdout.write(chalk.green('Ready.\n'));
    return pool;
  } catch (err) {
    console.error(chalk.red('\n Supabase initialization failed:'));
    console.error(err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initSupabase };

