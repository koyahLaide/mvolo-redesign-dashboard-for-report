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

## Environment variables

| Variable | Description |
|---|---|
| `SHOPIFY_STORE` | Your store domain, e.g. `mystore.myshopify.com` |
| `SHOPIFY_TOKEN` | Admin API access token (`shpat_…`) |
| `AWIN_API_KEY` | Awin API key (reserved for future connector) |
| `AWIN_ADVERTISER_ID` | Awin advertiser ID (reserved for future connector) |
