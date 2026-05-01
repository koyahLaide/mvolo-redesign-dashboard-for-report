'use strict';

const { Pool } = require('pg');
const chalk = require('chalk');
const schema = require('./schema/supabase');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let _dbInitialized = false;

/**
 * Initializes the Supabase PostgreSQL connection and ensures the modular
 * schema is applied. Returns the pool instance.
 */
async function initSupabase() {
  if (_dbInitialized) return pool;

  const client = await pool.connect();
  try {
    process.stdout.write(chalk.gray('  Verifying Supabase schema... '));
    // Execute the combined modular schema SQL
    await client.query(schema);
    process.stdout.write(chalk.green('Ready.\n'));
    _dbInitialized = true;
    return pool;
  } catch (err) {
    console.error(chalk.red('\n  ❌ Supabase initialization failed:'));
    console.error(err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initSupabase, pool };
