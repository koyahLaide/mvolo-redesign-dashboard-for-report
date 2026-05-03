'use strict';

require('dotenv').config();
const { initSupabase } = require('../db/init_schema');
const { pool } = require('../db/db');

async function main() {
  try {
    await initSupabase();
    console.log('Supabase schema successfully initialized.');
    await pool.end();
  } catch (err) {
    process.exit(1);
  }
}

main();
