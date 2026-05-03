'use strict';

const { fetchKlaviyoData } = require('../../connectors/klaviyo');
const chalk = require('chalk');

async function syncKlaviyo(db, syncedAt) {
    if (!process.env.KLAVIYO_API_KEY) throw new Error('KLAVIYO_API_KEY does not exist');

    const klaviyoData = await fetchKlaviyoData();
    if (klaviyoData.campaigns.length > 0) {
    const insertCampaign = db.prepare(`
        INSERT OR REPLACE INTO klaviyo_campaigns
        (id, name, status, sent_at, subject, synced_at)
        VALUES
        (@id, @name, @status, @sent_at, @subject, @synced_at)
    `);
    const upsertCampaigns = db.transaction((rows) => {
        for (const r of rows) insertCampaign.run({ ...r, synced_at: syncedAt });
    });
    upsertCampaigns(klaviyoData.campaigns);
    console.log(chalk.white(`  Klaviyo campaigns synced: ${chalk.bold(klaviyoData.campaigns.length)}`));
    }

    if (klaviyoData.flows.length > 0) {
    const insertFlow = db.prepare(`
        INSERT OR REPLACE INTO klaviyo_flows
        (id, name, status, created, trigger_type, synced_at)
        VALUES
        (@id, @name, @status, @created, @trigger_type, @synced_at)
    `);
    const upsertFlows = db.transaction((rows) => {
        for (const r of rows) insertFlow.run({ ...r, synced_at: syncedAt });
    });
    upsertFlows(klaviyoData.flows);
    console.log(chalk.white(`  Klaviyo flows synced: ${chalk.bold(klaviyoData.flows.length)}`));
    }

    if (klaviyoData.subscriberCount !== null) {
    console.log(chalk.white(`  Klaviyo subscribers: ${chalk.bold(klaviyoData.subscriberCount)}`));
    }

}

module.exports = { syncKlaviyo }