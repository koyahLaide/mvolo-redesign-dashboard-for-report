import { NextResponse } from 'next/server';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN ?? 'fa98bd-2.myshopify.com';
const SHOPIFY_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN ?? '';
const GMC_MERCHANT_ID = process.env.GMC_MERCHANT_ID ?? '';
const GMC_CLIENT_ID = process.env.GMC_CLIENT_ID ?? '';
const GMC_CLIENT_SECRET = process.env.GMC_CLIENT_SECRET ?? '';
const GMC_REFRESH_TOKEN = process.env.GMC_REFRESH_TOKEN ?? '';

async function getGMCAccessToken(): Promise<string | null> {
  if (!GMC_CLIENT_ID || !GMC_CLIENT_SECRET || !GMC_REFRESH_TOKEN) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GMC_CLIENT_ID,
        client_secret: GMC_CLIENT_SECRET,
        refresh_token: GMC_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

async function fetchShopifyProducts() {
  if (!SHOPIFY_TOKEN) return getMockProducts();
  try {
    const res = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250&status=active`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    const data = await res.json();
    return (data.products ?? []).map((p: any) => {
      const variant = p.variants?.[0];
      return {
        id: String(p.id),
        title: p.title,
        handle: p.handle,
        price: parseFloat(variant?.price ?? '0'),
        compare_price: parseFloat(variant?.compare_at_price ?? '0') || null,
        sku: variant?.sku ?? '',
        barcode: variant?.barcode ?? '',
        inventory: variant?.inventory_quantity ?? 0,
        image: p.images?.[0]?.src ?? null,
        url: `https://mgrproduct.nl/products/${p.handle}`,
        product_type: p.product_type ?? '',
        vendor: p.vendor ?? '',
        tags: p.tags ?? '',
        body_html: p.body_html ?? '',
        status: p.status,
        updated_at: p.updated_at,
      };
    });
  } catch {
    return getMockProducts();
  }
}

async function fetchGMCProducts(accessToken: string) {
  if (!GMC_MERCHANT_ID || !accessToken) return null;
  try {
    const res = await fetch(
      `https://shoppingcontent.googleapis.com/content/v2.1/${GMC_MERCHANT_ID}/products?maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return data.resources ?? [];
  } catch {
    return null;
  }
}

async function fetchGMCStatuses(accessToken: string) {
  if (!GMC_MERCHANT_ID || !accessToken) return null;
  try {
    const res = await fetch(
      `https://shoppingcontent.googleapis.com/content/v2.1/${GMC_MERCHANT_ID}/productstatuses?maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    return data.resources ?? [];
  } catch {
    return null;
  }
}

function scoreTitle(title: string): { score: 'Poor' | 'Average' | 'Great' | 'Too Long'; reason: string } {
  const len = title.length;
  if (len > 150) return { score: 'Too Long', reason: `${len} tekens (max 150)` };
  if (len < 20) return { score: 'Poor', reason: `Te kort (${len} tekens, min 20)` };
  const hasKeyword = /lamp|therapie|therapy|mask|licht|light|infrarood|infrared|led|panel|sauna/i.test(title);
  const hasBrand = /mvolo/i.test(title);
  if (len >= 70 && hasKeyword && hasBrand) return { score: 'Great', reason: 'Goede lengte, keyword + merk aanwezig' };
  if (len >= 40 && hasKeyword) return { score: 'Average', reason: 'Voldoende maar mist merk of extra keywords' };
  return { score: 'Poor', reason: 'Te kort of mist relevante keywords' };
}

function checkFeedHealth(product: any): string[] {
  const issues: string[] = [];
  if (!product.barcode || product.barcode.length < 8) issues.push('Ontbrekende of ongeldige GTIN/barcode');
  if (!product.title || product.title.length < 20) issues.push('Titel te kort voor Google Shopping');
  if (!product.image) issues.push('Geen productafbeelding');
  if (!product.price || product.price <= 0) issues.push('Geen geldige prijs');
  if (!product.body_html || product.body_html.length < 50) issues.push('Beschrijving te kort of ontbreekt');
  if (!product.product_type) issues.push('Geen productcategorie ingesteld');
  if (!product.sku) issues.push('Geen SKU');
  return issues;
}

function diagnoseGMCIssue(issue: string): { fix: string; priority: 'high' | 'medium' | 'low' } {
  const map: Record<string, { fix: string; priority: 'high' | 'medium' | 'low' }> = {
    'mismatched_domain': { fix: 'Claim mgrproduct.nl in GMC via Website → Claimen. Zorg dat de feed-URL overeenkomt met het geclaimde domein.', priority: 'high' },
    'missing_gtin': { fix: 'Voeg barcode/EAN toe aan het product in Shopify onder Inventory → Barcode.', priority: 'high' },
    'price_mismatch': { fix: 'Controleer of Shopify prijs overeenkomt met de prijs op de landingspagina. Verberg geen prijzen achter apps.', priority: 'high' },
    'invalid_value': { fix: 'Controleer de Google Product Category waarde — moet een geldig GMC taxonomie-ID zijn.', priority: 'medium' },
    'missing_required_attribute': { fix: 'Vul ontbrekende verplichte attributen in via Shopify metafields of feed-regels.', priority: 'high' },
    'image_too_small': { fix: 'Gebruik afbeeldingen van minimaal 100x100px. Aanbevolen: 800x800px of groter.', priority: 'medium' },
    'landing_page_error': { fix: 'Controleer of de product-URL bereikbaar is en geen 404 geeft.', priority: 'high' },
    'policy_violation': { fix: 'Bekijk GMC Policy Center voor details. Meestal gerelateerd aan gezondheids- of medische claims.', priority: 'high' },
    'account_suspended': { fix: 'Neem contact op met GMC support. Controleer alle policy-schendingen in het account.', priority: 'high' },
  };
  for (const [key, val] of Object.entries(map)) {
    if (issue.toLowerCase().includes(key.replace('_', ' ')) || issue.toLowerCase().includes(key)) {
      return val;
    }
  }
  return { fix: 'Bekijk GMC voor meer details over deze fout.', priority: 'medium' };
}

function classifyLabel(clicks: number, roas: number, cost: number): 'Heroes' | 'Villains' | 'Sidekicks' | 'Zombies' {
  if (clicks === 0 && cost === 0) return 'Zombies';
  if (roas >= 400 && clicks > 20) return 'Heroes';
  if (roas < 100 && cost > 50) return 'Villains';
  if (clicks > 0 && cost < 10) return 'Sidekicks';
  return 'Zombies';
}

function getMockProducts() {
  return [
    {
      id: '5480399346108', title: 'TDP Moxa lamp Mineralentherapie Gewrichtspijn Fibromyalgie Warmtetherapie Spierpijn Verlichting Artritis Behandeling Bloedsomloop Verbetering Mvolo',
      handle: 'tdp-moxa-lamp', price: 249, compare_price: 299, sku: 'TDP-001', barcode: '8720299123456',
      inventory: 12, image: null, url: 'https://mgrproduct.nl/products/tdp-moxa-lamp',
      product_type: 'Infraroodlamp', vendor: 'Mvolo', tags: 'infrarood,therapie', body_html: '<p>Professionele TDP Moxa lamp voor thuis gebruik.</p>', status: 'active', updated_at: '2026-04-28',
      clicks: 113, cost: 122.28, conversions: 4, conv_value: 796, roas: 651,
    },
    {
      id: '4763187200108', title: 'Dubbele Infraroodlamp Gewrichtspijn Chronische Pijn Mvolo',
      handle: 'dubbele-infraroodlamp', price: 189, compare_price: 229, sku: 'INF-002', barcode: '8720299123457',
      inventory: 8, image: null, url: 'https://mgrproduct.nl/products/dubbele-infraroodlamp',
      product_type: 'Infraroodlamp', vendor: 'Mvolo', tags: 'infrarood', body_html: '<p>Dubbele infraroodlamp.</p>', status: 'active', updated_at: '2026-04-28',
      clicks: 93, cost: 88.50, conversions: 4, conv_value: 739.35, roas: 835,
    },
    {
      id: '5434275100108', title: 'LED Gezichtsmasker met Nek Huidverjonging',
      handle: 'led-gezichtsmasker', price: 149, compare_price: null, sku: 'LED-003', barcode: '',
      inventory: 25, image: null, url: 'https://mgrproduct.nl/products/led-gezichtsmasker',
      product_type: 'LED Mask', vendor: 'Mvolo', tags: 'led,face', body_html: '<p>LED mask.</p>', status: 'active', updated_at: '2026-04-27',
      clicks: 288, cost: 296.67, conversions: 2, conv_value: 268.20, roas: 90,
    },
    {
      id: '5631586100108', title: 'Mvolo Roodlicht Calmerend Licht Slaap',
      handle: 'roodlicht-slaap', price: 89, compare_price: null, sku: 'RLT-004', barcode: '8720299123459',
      inventory: 3, image: null, url: 'https://mgrproduct.nl/products/roodlicht-slaap',
      product_type: 'Roodlicht', vendor: 'Mvolo', tags: 'roodlicht,slaap', body_html: '<p>Roodlicht voor slaap.</p>', status: 'active', updated_at: '2026-04-26',
      clicks: 266, cost: 216.07, conversions: 3, conv_value: 41.30, roas: 19,
    },
    {
      id: '5022216100108', title: 'Elite Series 306 Roodlichttherapie Lichttherapiepaneel Mvolo',
      handle: 'elite-306', price: 399, compare_price: 449, sku: 'ELT-005', barcode: '8720299123460',
      inventory: 6, image: null, url: 'https://mgrproduct.nl/products/elite-306',
      product_type: 'RLT Panel', vendor: 'Mvolo', tags: 'roodlicht,panel', body_html: '<p>Elite series paneel.</p>', status: 'active', updated_at: '2026-04-25',
      clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    },
    {
      id: '5393968100108', title: 'Elite series 506 Red Light Therapy Lamp Panel',
      handle: 'elite-506', price: 599, compare_price: null, sku: 'ELT-006', barcode: '',
      inventory: 4, image: null, url: 'https://mgrproduct.nl/products/elite-506',
      product_type: 'RLT Panel', vendor: 'Mvolo', tags: 'roodlicht,panel', body_html: '<p>Elite 506.</p>', status: 'active', updated_at: '2026-04-24',
      clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    },
    {
      id: '4816676100108', title: 'Enkele kop Infraroodlamp Red Therapy Behandeling',
      handle: 'enkele-infraroodlamp', price: 129, compare_price: 159, sku: 'INF-007', barcode: '8720299123462',
      inventory: 15, image: null, url: 'https://mgrproduct.nl/products/enkele-infraroodlamp',
      product_type: 'Infraroodlamp', vendor: 'Mvolo', tags: 'infrarood', body_html: '<p>Enkele kop infraroodlamp.</p>', status: 'active', updated_at: '2026-04-23',
      clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    },
    {
      id: '5448755100108', title: 'Elite Series 206 Red Light Infrared Light Therapy Panel',
      handle: 'elite-206', price: 249, compare_price: null, sku: 'ELT-008', barcode: '',
      inventory: 9, image: null, url: 'https://mgrproduct.nl/products/elite-206',
      product_type: 'RLT Panel', vendor: 'Mvolo', tags: 'roodlicht,panel,infrared', body_html: '', status: 'active', updated_at: '2026-04-22',
      clicks: 0, cost: 0, conversions: 0, conv_value: 0, roas: 0,
    },
  ];
}

function getMockGMCIssues() {
  return [
    { productId: '5448755100108', issues: [{ type: 'mismatched_domain', description: 'Niet-overeenkomende domeinen [link]', servability: 'disapproved' }] },
    { productId: '5393968100108', issues: [{ type: 'missing_gtin', description: 'Ontbrekende GTIN [gtin]', servability: 'disapproved' }] },
    { productId: '5434275100108', issues: [{ type: 'missing_gtin', description: 'Ontbrekende GTIN [gtin]', servability: 'eligible_limited' }] },
    { productId: '4816676100108', issues: [{ type: 'price_mismatch', description: 'Prijsmismatch gedetecteerd [price]', servability: 'disapproved' }] },
  ];
}

export async function GET() {
  try {
    const [shopifyProducts, accessToken] = await Promise.all([
      fetchShopifyProducts(),
      getGMCAccessToken(),
    ]);

    let gmcStatuses: any[] | null = null;
    if (accessToken) {
      gmcStatuses = await fetchGMCStatuses(accessToken);
    }

    const mockGMCIssues = !gmcStatuses ? getMockGMCIssues() : null;

    const products = shopifyProducts.map((p: any) => {
      const titleScore = scoreTitle(p.title);
      const feedIssues = checkFeedHealth(p);
      const label = classifyLabel(p.clicks ?? 0, p.roas ?? 0, p.cost ?? 0);

      let gmcIssues: any[] = [];
      if (gmcStatuses) {
        const status = gmcStatuses.find((s: any) => s.productId?.includes(p.id));
        if (status) {
          gmcIssues = (status.itemLevelIssues ?? []).map((issue: any) => ({
            type: issue.code,
            description: issue.description,
            servability: issue.servability,
            ...diagnoseGMCIssue(issue.code),
          }));
        }
      } else if (mockGMCIssues) {
        const mock = mockGMCIssues.find((m: any) => m.productId === p.id);
        if (mock) {
          gmcIssues = mock.issues.map((issue: any) => ({
            ...issue,
            ...diagnoseGMCIssue(issue.type),
          }));
        }
      }

      const gmcStatus = gmcIssues.some(i => i.servability === 'disapproved')
        ? 'disapproved'
        : gmcIssues.some(i => i.servability === 'eligible_limited')
        ? 'limited'
        : 'approved';

      return {
        ...p,
        titleScore: titleScore.score,
        titleReason: titleScore.reason,
        titleLength: p.title?.length ?? 0,
        feedIssues,
        feedScore: feedIssues.length === 0 ? 100 : Math.max(0, 100 - feedIssues.length * 20),
        gmcStatus,
        gmcIssues,
        label,
      };
    });

    // Statistieken
    const totalProducts = products.length;
    const disapproved = products.filter((p: any) => p.gmcStatus === 'disapproved').length;
    const limited = products.filter((p: any) => p.gmcStatus === 'limited').length;
    const approved = products.filter((p: any) => p.gmcStatus === 'approved').length;
    const titlePoor = products.filter((p: any) => p.titleScore === 'Poor').length;
    const titleGreat = products.filter((p: any) => p.titleScore === 'Great').length;
    const missingGtin = products.filter((p: any) => p.feedIssues.some((i: string) => i.includes('GTIN'))).length;
    const heroes = products.filter((p: any) => p.label === 'Heroes').length;
    const villains = products.filter((p: any) => p.label === 'Villains').length;
    const zombies = products.filter((p: any) => p.label === 'Zombies').length;
    const sidekicks = products.filter((p: any) => p.label === 'Sidekicks').length;

    const totalCost = products.reduce((s: number, p: any) => s + (p.cost ?? 0), 0);
    const totalConvValue = products.reduce((s: number, p: any) => s + (p.conv_value ?? 0), 0);
    const heroesConvValue = products.filter((p: any) => p.label === 'Heroes').reduce((s: number, p: any) => s + (p.conv_value ?? 0), 0);
    const villainsCost = products.filter((p: any) => p.label === 'Villains').reduce((s: number, p: any) => s + (p.cost ?? 0), 0);

    return NextResponse.json({
      products,
      stats: {
        totalProducts, disapproved, limited, approved,
        titlePoor, titleGreat, missingGtin,
        heroes, villains, zombies, sidekicks,
        totalCost, totalConvValue, heroesConvValue, villainsCost,
        feedCoverageScore: Math.round((approved / totalProducts) * 100),
      },
      gmcConnected: !!accessToken && !!gmcStatuses,
      lastSync: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
