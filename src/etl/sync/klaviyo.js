'use strict';

const { fetchKlaviyoData } = require('../../connectors/klaviyo');
const chalk = require('chalk');

async function syncKlaviyo(pool, syncedAt) {
  if (!process.env.KLAVIYO_API_KEY) throw new Error('KLAVIYO_API_KEY does not exist');

  const klaviyoData = await fetchKlaviyoData();
  if (klaviyoData.campaigns.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertCampaign = `
        INSERT INTO klaviyo_campaigns
        (id, name, status, sent_at, subject, synced_at)
        VALUES
        ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        sent_at = EXCLUDED.sent_at,
        subject = EXCLUDED.subject,
        synced_at = EXCLUDED.synced_at
    `;
      for (const r of klaviyoData.campaigns) {
        await client.query(insertCampaign, [
          r.id,
          r.name,
          r.status,
          r.sent_at,
          r.subject,
          syncedAt,
        ]);
      }
      console.log(
        chalk.white(`  Klaviyo campaigns synced: ${chalk.bold(klaviyoData.campaigns.length)}`),
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  if (klaviyoData.flows.length > 0) {
    const client = await pool.connect();

    const insertFlow = `
    INSERT INTO klaviyo_flows
    (id, name, status, created, trigger_type, synced_at)
    VALUES
    ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    created = EXCLUDED.created,
    trigger_type = EXCLUDED.trigger_type,
    synced_at = EXCLUDED.synced_at
`;

    try {
      await client.query('BEGIN');
      for (const r of klaviyoData.flows) {
        await client.query(insertFlow, [
          r.id,
          r.name,
          r.status,
          r.created,
          r.trigger_type,
          syncedAt,
        ]);
      }
      console.log(chalk.white(`  Klaviyo flows synced: ${chalk.bold(klaviyoData.flows.length)}`));
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  if (klaviyoData.subscriberCount !== null) {
    console.log(chalk.white(`  Klaviyo subscribers: ${chalk.bold(klaviyoData.subscriberCount)}`));
  }
}
module.exports = { syncKlaviyo };
