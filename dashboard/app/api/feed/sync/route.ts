import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


const SHOPIFY_STORE = process.env.SHOPIFY_STORE!;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN!;
const API_VERSION = '2024-01';

// Strip HTML tags for clean descriptions
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Fetch all active products from Shopify with pagination
async function fetchAllShopifyProducts() {
  const products: any[] = [];
  let url: string | null =
    `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json?limit=250&status=active`;

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Shopify API ${res.status}: ${body.substring(0, 300)}`);
    }

    const data = await res.json();
    products.push(...(data.products || []));

    // Handle pagination via Link header
    const linkHeader = res.headers.get('link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return products;
}

// Transform Shopify product to our Supabase format
function transformProduct(shopifyProduct: any) {
  const variant = shopifyProduct.variants?.[0] || {};
  const images = shopifyProduct.images || [];
  const primaryImage = images[0]?.src || null;
  const additionalImages = images.slice(1).map((img: any) => img.src);

  const price = parseFloat(variant.price) || 0;
  const compareAtPrice = variant.compare_at_price
    ? parseFloat(variant.compare_at_price)
    : null;

  // EAN can be in barcode field — clean it
  let ean = (variant.barcode || '').trim();
  if (ean === '10' || ean.length < 8) ean = ''; // Invalid EAN

  // SKU — Shopify sometimes puts EAN in SKU field
  let sku = (variant.sku || '').trim();
  if (!sku || sku === 'null') sku = '';

  // Tags as array
  const tags = shopifyProduct.tags
    ? shopifyProduct.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : [];

  return {
    shopify_id: String(shopifyProduct.id),
    name_nl: shopifyProduct.title,
    ean: ean || null,
    sku: sku || null,
    category: shopifyProduct.product_type || null,
    active: shopifyProduct.status === 'active',
    brand: shopifyProduct.vendor || 'Mvolo',
    price_eur: price > 0 ? price : null,
    sale_price_eur: compareAtPrice && compareAtPrice > price ? price : null,
    image_url: primaryImage,
    additional_images: additionalImages.length > 0 ? additionalImages : null,
    shopify_handle: shopifyProduct.handle,
    shopify_status: shopifyProduct.status,
    shopify_product_type: shopifyProduct.product_type || null,
    shopify_tags: tags.length > 0 ? tags : null,
    shopify_vendor: shopifyProduct.vendor || null,
    weight_grams: variant.grams || null,
    description_nl: stripHtml(shopifyProduct.body_html || ''),
    last_shopify_sync: new Date().toISOString(),
    // product_url intentionally omitted — stored per-market in feed_product_content
  };
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  try {
    // Auth check — only allow with valid secret or from internal calls
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (authHeader !== `Bearer ${expectedKey}`) {
      // Also allow if called from the dashboard itself (same origin)
      const origin = request.headers.get('origin') || '';
      if (!origin.includes('vercel.app') && !origin.includes('localhost')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[Feed Sync] Starting Shopify → Supabase sync...');

    // 1. Load markets to build per-language domain map
    const { data: markets } = await supabase
      .from('markets')
      .select('code, language_code, storefront_domain, status')
      .not('storefront_domain', 'is', null)
      .order('status'); // 'primary' before 'secondary' so primary domain wins per language

    // First occurrence per language_code = primary market's domain
    const langDomainMap = new Map<string, string>(); // language_code → storefront_domain
    for (const m of (markets ?? [])) {
      if (m.language_code && m.storefront_domain && !langDomainMap.has(m.language_code)) {
        langDomainMap.set(m.language_code, m.storefront_domain);
      }
    }
    console.log(`[Feed Sync] Domains: ${[...langDomainMap.entries()].map(([l, d]) => `${l}→${d}`).join(', ')}`);

    // 2. Fetch all active Shopify products
    const shopifyProducts = await fetchAllShopifyProducts();
    console.log(`[Feed Sync] Fetched ${shopifyProducts.length} active products from Shopify`);

    // 3. Transform (no product_url — handled per-market in feed_product_content)
    const products = shopifyProducts.map(transformProduct);

    // 4. Upsert into Supabase — match on shopify_id
    let synced = 0;
    const errors: string[] = [];

    for (const product of products) {
      const { data, error } = await supabase
        .from('products')
        .upsert(product, { onConflict: 'shopify_id' })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique')) {
          if (product.ean) {
            const { error: updateError } = await supabase
              .from('products')
              .update(product)
              .eq('ean', product.ean);
            if (!updateError) { synced++; continue; }
          }
        }
        errors.push(`${product.name_nl}: ${error.message}`);
        continue;
      }

      synced++;

      if (data?.id && product.shopify_handle) {
        // 5. NL content — full upsert (title + description + URL)
        const nlDomain = langDomainMap.get('nl') ?? 'mvolo.nl';
        await supabase.from('feed_product_content').upsert({
          product_id: data.id,
          language: 'nl',
          title: product.name_nl,
          description: product.description_nl?.substring(0, 5000) ?? null,
          product_url: `https://${nlDomain}/products/${product.shopify_handle}`,
        }, { onConflict: 'product_id,language' }).select();

        // 6. Other languages — update URL only; insert skeleton row if none exists yet
        for (const [langCode, domain] of langDomainMap) {
          if (langCode === 'nl') continue;
          const langUrl = `https://${domain}/products/${product.shopify_handle}`;

          const { data: updated } = await supabase
            .from('feed_product_content')
            .update({ product_url: langUrl })
            .eq('product_id', data.id)
            .eq('language', langCode)
            .select('id');

          if (!updated || updated.length === 0) {
            // No row yet — insert URL-only skeleton (title/description filled by AI enrichment later)
            await supabase.from('feed_product_content').insert({
              product_id: data.id,
              language: langCode,
              product_url: langUrl,
            });
          }
        }
      }
    }

    // 5. Log the sync
    await supabase.from('feed_changelog').insert({
      field: 'shopify_sync',
      old_value: null,
      new_value: `${synced} products synced`,
      source: 'shopify_sync',
    });

    console.log(`[Feed Sync] Done: ${synced} synced, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      synced,
      total: products.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Feed Sync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

// GET = sync status
export async function GET() {
  const supabase = getSupabase();
  const { data: lastSync } = await supabase
    .from('feed_changelog')
    .select('created_at, new_value')
    .eq('source', 'shopify_sync')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { count } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .not('shopify_id', 'is', null);

  return NextResponse.json({
    lastSync: lastSync?.created_at || null,
    lastResult: lastSync?.new_value || null,
    productsWithShopifyData: count || 0,
  });
}
