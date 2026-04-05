'use strict';

/**
 * Microsoft Clarity Data Export API connector
 *
 * Required env var:
 *   CLARITY_API_TOKEN — Bearer token from Clarity Settings → Data Export
 *
 * Limitations (as per Clarity docs):
 *   - Max 10 requests per project per day
 *   - Data is last 1–3 days only (numOfDays: 1 | 2 | 3)
 *   - Max 3 dimensions per request, max 1000 rows per response
 */

const https = require('https');

const BASE_URL = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';

/**
 * Makes a single GET request to the Clarity export API.
 *
 * @param {object} params
 * @param {1|2|3} params.numOfDays
 * @param {string} [params.dimension1]
 * @param {string} [params.dimension2]
 * @param {string} [params.dimension3]
 * @returns {Promise<Array>}
 */
function fetchClarityRaw({ numOfDays = 1, dimension1, dimension2, dimension3 } = {}) {
  const token = process.env.CLARITY_API_TOKEN;
  if (!token) throw new Error('CLARITY_API_TOKEN must be set in .env');

  const query = new URLSearchParams({ numOfDays: String(numOfDays) });
  if (dimension1) query.set('dimension1', dimension1);
  if (dimension2) query.set('dimension2', dimension2);
  if (dimension3) query.set('dimension3', dimension3);

  const url = `${BASE_URL}?${query.toString()}`;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Clarity: invalid JSON response`));
          }
        } else if (res.statusCode === 429) {
          reject(new Error('Clarity: daily request limit reached (max 10/day)'));
        } else {
          reject(new Error(`Clarity: HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetches Clarity insights broken down by Channel.
 * Covers the last `numOfDays` days.
 *
 * Returns rows with: { date_label, channel, metric, sessions, subtotal, pagesViews,
 *                      sessions_with_pct, sessions_without_pct }
 *
 * @param {1|2|3} numOfDays
 * @returns {Promise<Array>}
 */
async function fetchClarityByChannel(numOfDays = 3) {
  const raw = await fetchClarityRaw({ numOfDays, dimension1: 'Channel' });
  return normalise(raw, 'Channel', numOfDays);
}

/**
 * Fetches Clarity insights broken down by URL (page path).
 * Covers the last `numOfDays` days.
 *
 * @param {1|2|3} numOfDays
 * @returns {Promise<Array>}
 */
async function fetchClarityByUrl(numOfDays = 3) {
  const raw = await fetchClarityRaw({ numOfDays, dimension1: 'URL' });
  return normalise(raw, 'URL', numOfDays);
}

/**
 * Normalises the raw Clarity API response into flat rows.
 *
 * @param {Array} rawMetrics  — array of { metricName, information: [...] }
 * @param {string} dimKey     — dimension key used in each info row (e.g. 'Channel', 'URL')
 * @param {number} numOfDays
 * @returns {Array<{
 *   fetched_at: string,
 *   num_of_days: number,
 *   metric: string,
 *   dimension_key: string,
 *   dimension_value: string,
 *   sessions: number,
 *   subtotal: number,
 *   pages_views: number,
 *   sessions_with_pct: number,
 *   sessions_without_pct: number,
 * }>}
 */
function normalise(rawMetrics, dimKey, numOfDays) {
  const fetchedAt = new Date().toISOString();
  const rows = [];

  for (const metric of (rawMetrics ?? [])) {
    const metricName = metric.metricName ?? 'unknown';
    for (const info of (metric.information ?? [])) {
      rows.push({
        fetched_at:           fetchedAt,
        num_of_days:          numOfDays,
        metric:               metricName,
        dimension_key:        dimKey,
        dimension_value:      info[dimKey] ?? info.URL ?? info.Channel ?? 'unknown',
        sessions:             parseInt(info.sessionsCount ?? '0', 10),
        subtotal:             parseFloat(info.subTotal ?? '0'),
        pages_views:          parseInt(info.pagesViews ?? '0', 10),
        sessions_with_pct:    parseFloat(info.sessionsWithMetricPercentage ?? '0'),
        sessions_without_pct: parseFloat(info.sessionsWithoutMetricPercentage ?? '0'),
      });
    }
  }

  return rows;
}

module.exports = { fetchClarityByChannel, fetchClarityByUrl, fetchClarityRaw };
