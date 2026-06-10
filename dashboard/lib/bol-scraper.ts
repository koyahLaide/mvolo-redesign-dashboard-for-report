/**
 * Bol.com competitor price scraper.
 * Searches by competitor brand name directly, then infers category from product title.
 * Uses multiple extraction strategies: _next/data JSON, __NEXT_DATA__, JSON-LD.
 */

export interface ScrapedProduct {
  competitor: string;
  product_name: string;
  price: number;
  compare_price: number | null;
  category: string;
  url: string;
}

// Search queries per competitor. Searching BY brand name is more reliable than
// searching by category and then trying to find brand names in results.
const COMPETITOR_SEARCHES: Record<string, string[]> = {
  'Liroma':         ['Liroma'],
  'Vitalwave':      ['Vitalwave'],
  'Nuvibody':       ['Nuvibody'],
  'Panacea':        ['Panacea infrarood', 'Panacea rood licht'],
  'Platinum':       ['Platinum infrared', 'Platinum rood licht'],
  'Rojo':           ['Rojo infrarood', 'Rojo lamp'],
  'Hooga':          ['Hooga light', 'Hooga HG'],
  'MitoRed':        ['MitoRed'],
  'Amarapure':      ['Amarapure'],
  'Solawave':       ['Solawave'],
  'Blockbluelight': ['Blockbluelight'],
};

// Infer product category from title keywords
function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('gezichtsmasker') || t.includes('face mask') || t.includes('led mask') || t.includes('gezichts')) return 'led_face_mask';
  if (t.includes('dubbele kop') || t.includes('double head') || t.includes('duo lamp') || t.includes('dubbel')) return 'infrared_double';
  if (t.includes('panel') || t.includes('paneel') || t.includes('rlp') || t.includes('red light panel')) return 'rlt_panel';
  if (t.includes('rugband') || t.includes('rug belt') || t.includes('back belt') || t.includes('rug wrap')) return 'infrared_rugband';
  if (t.includes('sauna') || t.includes('deken') || t.includes('blanket')) return 'sauna_blanket';
  if (t.includes('daglichtbril') || t.includes('lichtbril') || t.includes('light glasses')) return 'daylight_glasses';
  if (t.includes('daglicht') || t.includes('daylight') || t.includes('lucent')) return 'daylight_lamp';
  if (t.includes('ems') || t.includes('gua sha') || t.includes('knie') || t.includes('knee')) return 'ems_device';
  return 'infrared_single';
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
  'Referer': 'https://www.bol.com/nl/nl/',
};

// Fetch Bol.com build ID so we can use the /_next/data/ JSON endpoint
async function getBolBuildId(): Promise<string | null> {
  try {
    const res = await fetch('https://www.bol.com/nl/nl/', { headers: HEADERS });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"buildId"\s*:\s*"([^"]{8,})"/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function searchBolProducts(competitor: string, query: string, buildId: string | null): Promise<ScrapedProduct[]> {
  const encoded = encodeURIComponent(query);

  // Strategy 1: Next.js /_next/data/ JSON endpoint (returns pageProps as JSON without JS execution)
  if (buildId) {
    try {
      const ndUrl = `https://www.bol.com/_next/data/${buildId}/nl/nl/s.json?searchtext=${encoded}`;
      const ndRes = await fetch(ndUrl, { headers: { ...HEADERS, 'Accept': 'application/json' } });
      if (ndRes.ok) {
        const ct = ndRes.headers.get('content-type') ?? '';
        if (ct.includes('json')) {
          const json = await ndRes.json();
          const items = deepFindArray(json?.pageProps ?? json, PRODUCT_ARRAY_KEYS);
          if (items.length > 0) {
            const parsed = parseItems(items, competitor);
            if (parsed.length > 0) return parsed;
          }
        }
      }
    } catch { /* fall through */ }
  }

  // Strategy 2: Bol.com internal BFF search endpoint
  try {
    const bffUrl = `https://www.bol.com/nl/rnwy/search/products?q=${encoded}&offset=0&limit=24&sort=RELEVANCE`;
    const bffRes = await fetch(bffUrl, { headers: { ...HEADERS, 'Accept': 'application/json' } });
    if (bffRes.ok) {
      const ct = bffRes.headers.get('content-type') ?? '';
      if (ct.includes('json')) {
        const json = await bffRes.json();
        const items = deepFindArray(json, PRODUCT_ARRAY_KEYS);
        if (items.length > 0) {
          const parsed = parseItems(items, competitor);
          if (parsed.length > 0) return parsed;
        }
      }
    }
  } catch { /* fall through */ }

  // Strategy 3: HTML page — __NEXT_DATA__ + JSON-LD
  return searchBolHtml(competitor, query);
}

const PRODUCT_ARRAY_KEYS = [
  'products', 'items', 'searchResults', 'listItems', 'productTiles',
  'hits', 'results', 'productList', 'productItems', 'searchItems',
  'tileList', 'productTileList',
];

async function searchBolHtml(competitor: string, query: string): Promise<ScrapedProduct[]> {
  const url = `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(query)}&sort=9`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const html = await res.text();

  // __NEXT_DATA__
  const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (ndMatch) {
    try {
      const nd = JSON.parse(ndMatch[1]);
      const items = deepFindArray(nd?.props?.pageProps ?? nd?.props ?? nd, PRODUCT_ARRAY_KEYS);
      if (items.length > 0) {
        const parsed = parseItems(items, competitor);
        if (parsed.length > 0) return parsed;
      }
    } catch { /* fall through */ }
  }

  // JSON-LD — handle both Product and ItemList types
  const ldResults: ScrapedProduct[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const ld = JSON.parse(m[1]);
      const nodes = Array.isArray(ld) ? ld : [ld];
      for (const node of nodes) {
        if (node['@type'] === 'Product') {
          const price = parseFloat(node.offers?.price ?? node.offers?.lowPrice ?? '0');
          if (!price) continue;
          ldResults.push({
            competitor,
            product_name: (node.name ?? '').substring(0, 200),
            price,
            compare_price: null,
            category: inferCategory(node.name ?? ''),
            url: node.url ?? url,
          });
        }
        if (node['@type'] === 'ItemList') {
          for (const el of node.itemListElement ?? []) {
            const item = el.item ?? el;
            if (!item.name) continue;
            const price = parseFloat(item.offers?.price ?? item.offers?.lowPrice ?? '0');
            if (!price) continue;
            ldResults.push({
              competitor,
              product_name: String(item.name).substring(0, 200),
              price,
              compare_price: null,
              category: inferCategory(item.name),
              url: item.url ?? url,
            });
          }
        }
      }
    } catch { /* skip */ }
  }
  if (ldResults.length > 0) return ldResults;

  // Last resort: parse price + title from raw HTML using meta tags / og tags
  return parseMetaTags(html, competitor, url);
}

function parseMetaTags(html: string, competitor: string, pageUrl: string): ScrapedProduct[] {
  const results: ScrapedProduct[] = [];
  // og:title + og:price:amount pattern (used by some e-commerce sites)
  const titleMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
  const priceMatch = html.match(/property="product:price:amount"\s+content="([^"]+)"/);
  if (titleMatch && priceMatch) {
    const price = parseFloat(priceMatch[1]);
    if (price > 0) {
      results.push({
        competitor,
        product_name: titleMatch[1].substring(0, 200),
        price,
        compare_price: null,
        category: inferCategory(titleMatch[1]),
        url: pageUrl,
      });
    }
  }
  return results;
}

function deepFindArray(obj: any, keys: string[], depth = 0): any[] {
  if (depth > 12 || !obj || typeof obj !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) return obj[key];
  }
  for (const val of Object.values(obj)) {
    const found = deepFindArray(val, keys, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
}

function parseItems(items: any[], competitor: string): ScrapedProduct[] {
  const results: ScrapedProduct[] = [];
  for (const item of items) {
    const title: string = item?.title ?? item?.productTitle ?? item?.name ?? item?.displayName ?? item?.label ?? '';
    if (!title) continue;

    const priceRaw = item?.price ?? item?.prices?.regularPrice ?? item?.listPrice ?? item?.currentPrice
      ?? item?.salePrice ?? item?.offerPrice ?? item?.priceLabel;
    const compareRaw = item?.originalPrice ?? item?.prices?.originalPrice ?? item?.compareAtPrice
      ?? item?.strikethroughPrice ?? null;
    const slug: string = item?.url ?? item?.productUrl ?? item?.slug ?? item?.href ?? item?.link ?? '';

    const price = typeof priceRaw === 'number'
      ? priceRaw
      : parseFloat(String(priceRaw ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
    const comparePrice = compareRaw
      ? (typeof compareRaw === 'number'
          ? compareRaw
          : parseFloat(String(compareRaw).replace(/[^\d.,]/g, '').replace(',', '.')))
      : null;

    if (!price || isNaN(price) || price > 10000) continue;

    results.push({
      competitor,
      product_name: title.substring(0, 200),
      price,
      compare_price: comparePrice && !isNaN(comparePrice) && comparePrice > price ? comparePrice : null,
      category: inferCategory(title),
      url: slug.startsWith('http') ? slug : slug ? `https://www.bol.com${slug}` : `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(competitor)}`,
    });
  }
  return results;
}

export async function scrapeCompetitorPrices(): Promise<{ products: ScrapedProduct[]; debug: string[] }> {
  const all: ScrapedProduct[] = [];
  const seen = new Set<string>();
  const debug: string[] = [];

  const buildId = await getBolBuildId();
  debug.push(`Build ID: ${buildId ?? 'niet gevonden'}`);

  for (const [competitor, queries] of Object.entries(COMPETITOR_SEARCHES)) {
    for (const query of queries) {
      try {
        const items = await searchBolProducts(competitor, query, buildId);
        debug.push(`[${competitor}] "${query}" → ${items.length} results`);
        for (const item of items) {
          const key = `${item.competitor}|${item.product_name}|${item.category}`;
          if (!seen.has(key)) {
            seen.add(key);
            all.push(item);
          }
        }
        await new Promise(r => setTimeout(r, 700));
      } catch (err: any) {
        debug.push(`[${competitor}] "${query}" → ERROR: ${err.message}`);
      }
    }
  }

  return { products: all, debug };
}
