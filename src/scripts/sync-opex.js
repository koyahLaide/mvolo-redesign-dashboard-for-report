'use strict';
require('dotenv').config();
const { initDb } = require('../db/schema');
const chalk = require('chalk');

const db = initDb();

db.exec(`
  CREATE TABLE IF NOT EXISTS opex (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category       TEXT NOT NULL,
    name           TEXT NOT NULL,
    amount         REAL NOT NULL,
    frequency      TEXT NOT NULL DEFAULT 'monthly',
    monthly_amount REAL NOT NULL,
    btw            REAL DEFAULT 0,
    updated_at     TEXT DEFAULT (datetime('now'))
  )
`);

const upsert = db.prepare(`
  INSERT INTO opex (category, name, amount, frequency, monthly_amount, btw)
  VALUES (@category, @name, @amount, @frequency, @monthly_amount, @btw)
  ON CONFLICT DO NOTHING
`);

const insertAll = db.transaction(items => items.forEach(i => upsert.run(i)));

const monthly = [
  { category: 'software',   name: 'Online kantoor',  amount: 48.39,  frequency: 'monthly', monthly_amount: 48.39,  btw: 10.16 },
  { category: 'software',   name: 'Backlinks',        amount: 99.26,  frequency: 'monthly', monthly_amount: 99.26,  btw: 20.84 },
  { category: 'software',   name: 'Marktmentor',      amount: 83.50,  frequency: 'monthly', monthly_amount: 83.50,  btw: 17.53 },
  { category: 'software',   name: 'Awin',             amount: 75,     frequency: 'monthly', monthly_amount: 75,     btw: 10    },
  { category: 'operations', name: 'Laptop',           amount: 89.84,  frequency: 'monthly', monthly_amount: 89.84,  btw: 14    },
  { category: 'software',   name: 'Affiliate',        amount: 105,    frequency: 'monthly', monthly_amount: 105,    btw: 0     },
  { category: 'operations', name: 'Giften',           amount: 90,     frequency: 'monthly', monthly_amount: 90,     btw: 0     },
  { category: 'software',   name: 'Shopify',          amount: 150,    frequency: 'monthly', monthly_amount: 150,    btw: 31.5  },
  { category: 'software',   name: 'Odido',            amount: 56.12,  frequency: 'monthly', monthly_amount: 56.12,  btw: 11.79 },
  { category: 'finance',    name: 'ING Bank',         amount: 51,     frequency: 'monthly', monthly_amount: 51,     btw: 0     },
  { category: 'software',   name: 'Slack',            amount: 57.75,  frequency: 'monthly', monthly_amount: 57.75,  btw: 12.13 },
  { category: 'software',   name: 'Channeble',        amount: 82,     frequency: 'monthly', monthly_amount: 82,     btw: 17.22 },
  { category: 'software',   name: 'Klaviyo',          amount: 17.79,  frequency: 'monthly', monthly_amount: 17.79,  btw: 3.74  },
  { category: 'software',   name: 'Claude + ChatGPT', amount: 347.14, frequency: 'monthly', monthly_amount: 347.14, btw: 0     },
  { category: 'operations', name: 'NH Fulfilment',    amount: 1000,   frequency: 'monthly', monthly_amount: 1000,   btw: 210   },
  { category: 'software',   name: 'Trackbee',         amount: 48,     frequency: 'monthly', monthly_amount: 48,     btw: 10.08 },
  { category: 'software',   name: 'Google Cloud',     amount: 8.17,   frequency: 'monthly', monthly_amount: 8.17,   btw: 1.71  },
  { category: 'salary',     name: 'Lex',              amount: 363,    frequency: 'monthly', monthly_amount: 363,    btw: 63    },
  { category: 'salary',     name: 'Angelica',         amount: 174,    frequency: 'monthly', monthly_amount: 174,    btw: 0     },
  { category: 'salary',     name: 'Janisha',          amount: 224,    frequency: 'monthly', monthly_amount: 224,    btw: 0     },
  { category: 'salary',     name: 'Francis',          amount: 216,    frequency: 'monthly', monthly_amount: 216,    btw: 0     },


  { category: 'salary',     name: 'Nova',             amount: 120,    frequency: 'monthly', monthly_amount: 120,    btw: 0     },


  { category: 'salary',     name: 'AJ',               amount: 200,    frequency: 'monthly', monthly_amount: 200,    btw: 0     },
  { category: 'salary',     name: 'Reinier',          amount: 170,    frequency: 'monthly', monthly_amount: 170,    btw: 35.7  },
];

const yearly = [
  { category: 'software',   name: 'Webwinkelkeur', amount: 180,  frequency: 'yearly', monthly_amount: 15,     btw: 37.8   },
  { category: 'software',   name: 'Mijndomein',    amount: 72,   frequency: 'yearly', monthly_amount: 6,      btw: 15.12  },
  { category: 'software',   name: 'Vimexx',        amount: 50,   frequency: 'yearly', monthly_amount: 4.17,   btw: 10.5   },
  { category: 'software',   name: 'GS1',           amount: 1413, frequency: 'yearly', monthly_amount: 117.75, btw: 29.61  },
  { category: 'freelance',  name: 'Online jobs',   amount: 300,  frequency: 'yearly', monthly_amount: 25,     btw: 0      },
  { category: 'freelance',  name: 'Higgsfield',    amount: 873,  frequency: 'yearly', monthly_amount: 72.75,  btw: 183.33 },
];

db.exec('DELETE FROM opex');
insertAll([...monthly, ...yearly]);

const totals = db.prepare(`
  SELECT category, ROUND(SUM(monthly_amount), 2) as monthly, COUNT(*) as items
  FROM opex GROUP BY category ORDER BY monthly DESC
`).all();

console.log(chalk.cyan('\n  OPEX per categorie:'));
let total = 0;
totals.forEach(r => {
  console.log(`  ${r.category.padEnd(15)} EUR ${String(r.monthly.toFixed(2)).padStart(8)} (${r.items} items)`);
  total += r.monthly;
});
console.log(chalk.yellow(`\n  Totaal maandelijks: EUR ${total.toFixed(2)}`));
console.log(chalk.gray(`  Per dag:            EUR ${(total / 30).toFixed(2)}`));
console.log(chalk.green('\n  OPEX geladen\n'));
