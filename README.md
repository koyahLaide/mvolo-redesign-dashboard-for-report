# Mvolo Attribution Dashboard

Syncs Shopify orders to a local SQLite database and attributes each order to a marketing channel based on UTM parameters and referrer data.

## Setup

```bash
npm install
cp .env.example .env
# Fill in your credentials in .env
```

## Usage

```bash
# Start the daemon (runs once immediately, then every 6 hours)
npm start

# Run a single sync manually
npm run sync
```

## Attribution logic

| Condition | Channel | Medium |
|---|---|---|
| `utm_source=meta` or `facebook` | `meta_ads` | `paid_social` |
| `utm_source=google` + `utm_medium=cpc` | `google_search` | `cpc` |
| `utm_source=google` + `utm_medium=shopping` | `google_shopping` | `shopping` |
| `utm_source=awin` | `awin_affiliate` | `affiliate` |
| `utm_source=klaviyo` | `email` | `email` |
| No UTM, referrer is a search engine | `organic_search` | `organic` |
| No UTM, referrer is a social platform | `organic_social` | `organic` |
| No UTM, no referrer | `direct` | `direct` |
| Everything else | `other` | `other` |

## Database

SQLite database is stored at `data/mvolo.db`.

**Tables:**
- `orders` — one row per Shopify order with attribution fields
- `sync_log` — audit log of every sync run

## First-party Session Tracker

Track the full customer journey (multi-touch, days to convert, sessions before purchase) by adding a lightweight script to your Shopify theme.

### 1. Voeg toe aan `theme.liquid` (vóór `</body>`)

```liquid
<script src="https://dashboard-sigma-nine-85.vercel.app/tracker.js" defer></script>
```

### 2. Voeg toe aan de order confirmation page (`checkout.liquid` of `order-status.liquid`)

```liquid
<div id="pm-order" data-order-id="{{ order.id }}"></div>
```

Dit triggert automatisch het versturen van de sessiegeschiedenis naar de dashboard API zodra een klant een aankoop afrondt.

### Hoe het werkt

| Stap | Actie |
|------|-------|
| Paginabezoek met UTMs | Sessie opgeslagen in `localStorage` |
| Externe referrer (bijv. Facebook) | Sessie opgeslagen in `localStorage` |
| Order confirmation page | Volledige journey verstuurd naar `/api/track` |
| Dashboard → Customer Journey | Toont gem. sessies + dagen per kanaal |

- Bezoeker ID: anonieme UUID in `localStorage` (`mvolo_vid`)
- Max 30 sessies per bezoeker bijgehouden
- Data wordt niet gedeeld met derden

### Scripttag (alternatief via Shopify Admin)

Via **Online Store → Themes → Edit code → theme.liquid**, of via
**Settings → Custom data → Scripts** (Shopify Plus).

## Environment variables

| Variable | Description |
|---|---|
| `SHOPIFY_STORE` | Your store domain, e.g. `mystore.myshopify.com` |
| `SHOPIFY_TOKEN` | Admin API access token (`shpat_…`) |
| `AWIN_API_KEY` | Awin API key (reserved for future connector) |
| `AWIN_ADVERTISER_ID` | Awin advertiser ID (reserved for future connector) |
