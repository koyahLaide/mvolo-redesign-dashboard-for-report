'use strict';

/**
 * Parses UTM parameters from a landing_site URL.
 * Returns an empty object if the URL is invalid or absent.
 * @param {string|null} landingSite
 * @returns {URLSearchParams}
 */
function parseUtm(landingSite) {
  if (!landingSite) return new URLSearchParams();
  try {
    // landing_site can be a relative path — prepend a dummy base so URL() parses it
    const fullUrl = landingSite.startsWith('http')
      ? landingSite
      : `https://placeholder.com${landingSite}`;
    return new URL(fullUrl).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

/**
 * Checks whether a referring_site URL contains any of the given hostname fragments.
 * @param {string|null} referringSite
 * @param {string[]} fragments
 * @returns {boolean}
 */
function referrerContains(referringSite, fragments) {
  if (!referringSite) return false;
  const lower = referringSite.toLowerCase();
  return fragments.some((f) => lower.includes(f));
}

/**
 * Determines the marketing channel and medium for a single Shopify order.
 *
 * Attribution priority (first match wins):
 *  1. utm_source=meta or facebook   → meta_ads / paid_social
 *  2. utm_source=google + cpc       → google_search / cpc
 *  3. utm_source=google + shopping  → google_shopping / shopping
 *  4. utm_source=awin               → awin_affiliate / affiliate
 *  5. utm_source=klaviyo            → email / email
 *  6. No UTM, referrer=search engine → organic_search / organic
 *  7. No UTM, referrer=social       → organic_social / organic
 *  8. No UTM, no referrer           → direct / direct
 *  9. Anything else                 → other / other
 *
 * @param {Object} order - Mapped order from shopify.js
 * @returns {Object} Attribution object
 */
function attributeOrder(order) {
  const params = parseUtm(order.landing_site);

  const utmSource = (params.get('utm_source') || '').toLowerCase();
  const utmMedium = (params.get('utm_medium') || '').toLowerCase();
  const utmCampaign = params.get('utm_campaign') || null;
  const utmContent = params.get('utm_content') || null;
  const utmTerm = params.get('utm_term') || null;

  const hasUtm = utmSource !== '';

  let channel, medium;

  if (utmSource === 'meta' || utmSource === 'facebook') {
    channel = 'meta_ads';
    medium = 'paid_social';
  } else if (utmSource === 'google' && utmMedium === 'cpc') {
    channel = 'google_search';
    medium = 'cpc';
  } else if (utmSource === 'google' && utmMedium === 'shopping') {
    channel = 'google_shopping';
    medium = 'shopping';
  } else if (utmSource === 'awin') {
    channel = 'awin_affiliate';
    medium = 'affiliate';
  } else if (utmSource === 'klaviyo') {
    channel = 'email';
    medium = 'email';
  } else if (!hasUtm && referrerContains(order.referring_site, ['google.', 'bing.', 'yahoo.', 'duckduckgo.'])) {
    channel = 'organic_search';
    medium = 'organic';
  } else if (!hasUtm && referrerContains(order.referring_site, ['instagram.', 'facebook.', 'tiktok.', 'linkedin.'])) {
    channel = 'organic_social';
    medium = 'organic';
  } else if (!hasUtm && !order.referring_site) {
    channel = 'direct';
    medium = 'direct';
  } else {
    channel = 'other';
    medium = 'other';
  }

  return {
    channel,
    medium,
    utm_source: utmSource || null,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
  };
}

/**
 * Summarises an array of attributed orders by channel.
 *
 * @param {Array<{channel: string}>} orders - Orders that already have a `channel` property
 * @returns {Object} Map of channel → count, e.g. { meta_ads: 12, direct: 5 }
 */
function summarizeAttribution(orders) {
  return orders.reduce((acc, order) => {
    const ch = order.channel || 'unknown';
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});
}

module.exports = { attributeOrder, summarizeAttribution };
