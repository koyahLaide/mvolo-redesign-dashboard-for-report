/**
 * Mvolo First-Party Session Tracker v1.0
 * Tracks UTM touchpoints in localStorage and sends full journey to API on purchase.
 *
 * Install on Shopify:
 *   theme.liquid  → <script src="https://dashboard-sigma-nine-85.vercel.app/tracker.js" defer></script>
 *   order confirmation page → <div id="pm-order" data-order-id="{{ order.id }}"></div>
 */
(function () {
  'use strict';

  var SH_KEY  = 'mvolo_sh';   // session history
  var VID_KEY = 'mvolo_vid';  // visitor id
  var MAX     = 30;
  var API     = 'https://dashboard-sigma-nine-85.vercel.app/api/track';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getVid() {
    try {
      var id = localStorage.getItem(VID_KEY);
      if (!id) { id = uuid(); localStorage.setItem(VID_KEY, id); }
      return id;
    } catch (e) { return uuid(); }
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(SH_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function saveHistory(h) {
    try { localStorage.setItem(SH_KEY, JSON.stringify(h.slice(-MAX))); }
    catch (e) {}
  }

  function getUtms() {
    var p = new URLSearchParams(window.location.search);
    return {
      utm_source:   p.get('utm_source'),
      utm_medium:   p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'),
      utm_content:  p.get('utm_content'),
      utm_term:     p.get('utm_term'),
    };
  }

  // ── Record visit ─────────────────────────────────────────────────────────────
  // Only record when: UTMs present, external referrer, or first-ever visit.

  function recordVisit() {
    var utms    = getUtms();
    var hasUtm  = !!(utms.utm_source || utms.utm_campaign);
    var ref     = document.referrer || null;
    var extRef  = ref && ref.indexOf(window.location.hostname) === -1;
    var history = getHistory();

    if (!hasUtm && !extRef && history.length > 0) return;

    history.push({
      ts:  new Date().toISOString(),
      p:   window.location.pathname,
      ref: ref,
      src: utms.utm_source,
      med: utms.utm_medium,
      cmp: utms.utm_campaign,
      cnt: utms.utm_content,
      trm: utms.utm_term,
    });
    saveHistory(history);
  }

  // ── Send journey to API ───────────────────────────────────────────────────────

  function send(orderId) {
    var vid     = getVid();
    var history = getHistory();
    if (!history.length) return;

    var payload = JSON.stringify({
      visitor_id:      vid,
      order_id:        orderId ? String(orderId) : null,
      session_history: history,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(API, {
          method:    'POST',
          headers:   { 'Content-Type': 'application/json' },
          body:      payload,
          keepalive: true,
        }).catch(function () {});
      }
      // Clear after send so we don't double-count
      localStorage.removeItem(SH_KEY);
    } catch (e) {}
  }

  // ── Main ─────────────────────────────────────────────────────────────────────

  recordVisit();

  // Shopify order confirmation: <div id="pm-order" data-order-id="{{ order.id }}"></div>
  var pmEl = document.getElementById('pm-order');
  if (pmEl) {
    var oid = pmEl.getAttribute('data-order-id');
    if (oid) { send(oid); return; }
  }

  // Fallback: detect Shopify thank_you URL patterns
  if (/\/thank.you|\/checkouts\/.+\/thank.you/.test(window.location.pathname)) {
    send(null);
  }
}());
