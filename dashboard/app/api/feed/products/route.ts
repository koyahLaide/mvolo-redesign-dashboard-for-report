import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';


export async function GET(request: Request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market') || 'all';
  const channel = searchParams.get('channel') || 'all';

  try {
    // 1. Fetch products with feed-relevant fields
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select(`
        id, ean, sku, name_nl, name_en, category, shopify_id, bol_offer_id,
        active, brand, price_eur, sale_price_eur, image_url, additional_images,
        product_url, shopify_handle, shopify_status, shopify_tags, shopify_vendor,
        description_nl, description_en, weight_grams, last_shopify_sync,
        created_at, updated_at
      `)
      .eq('active', true)
      .order('name_nl');

    if (prodError) throw prodError;

    // 2. Fetch markets
    const { data: markets } = await supabase
      .from('markets')
      .select('id, code, name, language, language_code, status')
      .order('code');

    // 3. Fetch feed market configs
    const { data: feedConfigs } = await supabase
      .from('feed_market_configs')
      .select('id, market_id, channel, feed_name, is_active, last_fetched_at');

    // 4. Fetch content per product per language
    const { data: content } = await supabase
      .from('feed_product_content')
      .select('product_id, language, title, description, ai_status');

    // 5. Fetch active rules count
    const { count: activeRules } = await supabase
      .from('feed_rules')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    // 6. Fetch open alerts
    const { data: alerts } = await supabase
      .from('feed_alerts')
      .select('id, type, severity, message, product_id, channel, created_at')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // 7. Fetch image counts per product from image_bank
    const { data: imageCounts } = await supabase
      .from('image_bank')
      .select('product_id')
      .eq('is_active', true);

    // Build image count map
    const imageCountMap: Record<string, number> = {};
    (imageCounts || []).forEach((img: any) => {
      imageCountMap[img.product_id] = (imageCountMap[img.product_id] || 0) + 1;
    });

    // Build content map
    const contentMap: Record<string, any[]> = {};
    (content || []).forEach((c: any) => {
      if (!contentMap[c.product_id]) contentMap[c.product_id] = [];
      contentMap[c.product_id].push(c);
    });

    // 8. Determine feed eligibility per product
    const enrichedProducts = (products || []).map((p: any) => {
      const hasPrice = p.price_eur && p.price_eur > 0;
      const hasEan = p.ean && p.ean.length >= 8;
      const hasSku = p.sku && p.sku.length > 0;
      const hasImage = !!p.image_url;
      const hasDescription = !!p.description_nl;
      const imageCount = imageCountMap[p.id] || 0;
      const languages = contentMap[p.id] || [];

      const issues: string[] = [];
      if (!hasPrice) issues.push('Geen prijs');
      if (!hasEan) issues.push('Geen EAN');
      if (!hasSku) issues.push('Geen SKU');
      if (!hasImage) issues.push('Geen afbeelding');
      if (!hasDescription) issues.push('Geen beschrijving');

      const feedReady = issues.length === 0;

      return {
        ...p,
        feed_ready: feedReady,
        feed_issues: issues,
        image_bank_count: imageCount,
        content_languages: languages,
      };
    });

    // 9. Summary stats
    const totalProducts = enrichedProducts.length;
    const feedReadyCount = enrichedProducts.filter((p: any) => p.feed_ready).length;
    const withIssues = totalProducts - feedReadyCount;
    const activeFeedCount = (feedConfigs || []).filter((f: any) => f.is_active).length;

    return NextResponse.json({
      products: enrichedProducts,
      markets: markets || [],
      feedConfigs: feedConfigs || [],
      alerts: alerts || [],
      stats: {
        totalProducts,
        feedReady: feedReadyCount,
        withIssues,
        activeFeeds: activeFeedCount,
        activeRules: activeRules || 0,
      },
    });
  } catch (error: any) {
    console.error('[Feed Products] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
