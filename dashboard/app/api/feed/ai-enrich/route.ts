import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase  = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL             = 'claude-sonnet-4-5';
const INPUT_CPM         = 3.00;   // $ per million input tokens
const OUTPUT_CPM        = 15.00;  // $ per million output tokens
const MIN_CTR_DATAPOINTS = 20;

export type Variant = {
  id: 'A' | 'B' | 'C' | 'D' | 'S';
  label: string;
  compliance: 'green' | 'orange';
  channel?: string;
  season?: string;
  title: string;
  description_short: string; // max 170 chars
  description_long: string;  // 500-1000 chars
};

// ── JSON extraction ──────────────────────────────────────────────────────────
function extractJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const md  = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md)  { try { return JSON.parse(md[1].trim()); }  catch {} }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); }         catch {} }
  throw new Error('Geen geldige JSON in Claude response');
}

function calcCost(inp: number, out: number) {
  return (inp / 1_000_000) * INPUT_CPM + (out / 1_000_000) * OUTPUT_CPM;
}

// ── Channel-specific prompt additions ────────────────────────────────────────
const CHANNEL_INSTRUCTIONS: Record<string, string> = {
  google: `GOOGLE SHOPPING: keywords vooraan, technische specs, zakelijk, max 150 tekens, geen emotie, geen uitroeptekens.`,
  meta:   `META CATALOG: lifestyle-gericht, emotioneel, voordelen voorop, mag levendiger. Beschrijving mag conversationeel.`,
  awin:   `AWIN AFFILIATE: vergelijkbaar met Google maar met nadruk op waarde-propositie voor affiliate bezoekers. Duidelijke CTA-achtige taal in beschrijving.`,
  all:    `Genereer universeel inzetbare content die voor alle kanalen werkt.`,
};

// ── Seasonal prompt additions ─────────────────────────────────────────────────
const SEASON_INSTRUCTIONS: Record<string, string> = {
  winter:    `WINTER-SEIZOEN: focus op warmte, comfort, donkere dagen, herstel van kou, binnenactiviteiten, cocooning.`,
  summer:    `ZOMER-SEIZOEN: focus op herstel na sport/buiten, zonbescherming, energie, buitenactiviteiten.`,
  christmas: `KERST-SEIZOEN: focus op cadeau, gezondheid-als-cadeau, verwennen, bijzonder moment, wellness-cadeau.`,
  spring:    `LENTE-SEIZOEN: focus op nieuw begin, energie, buiten komen, frisheid, vitaal gevoel.`,
};

// ── Build full prompt ─────────────────────────────────────────────────────────
function buildPrompt(opts: {
  product:      any;
  content:      any;
  language:     string;
  channel:      string;
  season:       string | null;
  competitors:  string[];
  ctrFeedback:  string | null;
  learnings:    string[];
}): string {
  const { product, content, language, channel, season, competitors, ctrFeedback, learnings } = opts;

  const langNames: Record<string, string> = { nl: 'Nederlands', de: 'Deutsch', fr: 'Français', en: 'English' };
  const langRules: Record<string, string> = {
    nl: 'Schrijf zakelijk en keyword-rijk. Geen "u", gebruik "je/jouw".',
    de: 'Professionell schreiben. Sie-Form. Deutsche Marktterminilogie.',
    fr: 'Professionnel. Vouvoiement. Terminologie marché français.',
    en: 'Professional, keyword-rich. British English spellings preferred.',
  };

  const baseTitle = content?.title ?? product.name_nl ?? '';
  const baseDesc  = (content?.description ?? product.description_nl ?? '').substring(0, 600);

  const learningsSection = learnings.length
    ? `\nINZICHTEN UIT EERDERE A/B TESTS (pas deze toe):\n${learnings.map(l => `• ${l}`).join('\n')}\n`
    : '';

  const competitorSection = competitors.length
    ? `\nCONCURRENTIE-TITELS (onderscheid je hiervan — maak iets beters):\n${competitors.map(t => `• ${t}`).join('\n')}\n`
    : '';

  const ctrSection = ctrFeedback
    ? `\nPERFORMANCE FEEDBACK:\n${ctrFeedback}\n`
    : '';

  const seasonSection = season
    ? `\nSEIZOEN GEVRAAGD: ${season.toUpperCase()}\n${SEASON_INSTRUCTIONS[season] ?? ''}\n`
    : '';

  const channelInstr = CHANNEL_INSTRUCTIONS[channel] ?? CHANNEL_INSTRUCTIONS.all;

  return `Je bent een senior SEO copywriter voor Mvolo, een Nederlandse webshop voor lichttherapie en wellness producten.
${learningsSection}
PRODUCT:
• Naam (NL):    ${product.name_nl ?? ''}
• Merk:         ${product.brand ?? 'Mvolo'}
• Categorie:    ${product.category ?? 'Wellness'}
• EAN:          ${product.ean ?? 'onbekend'}
• Prijs:        €${product.price_eur ?? '?'}
• Huidige titel (${language}): ${baseTitle}
• Huidige beschrijving (basis): ${baseDesc}
${competitorSection}${ctrSection}${seasonSection}
SCHRIJFTAAL: ${langNames[language] ?? language}
${langRules[language] ?? ''}

KANAAL: ${channel.toUpperCase()}
${channelInstr}

COMPLIANCE — STRIKT (overtreed NOOIT):
❌ VERBODEN:   geneest · behandelt · medisch · klinisch bewezen · therapeutisch · diagnostiseert · ziektenamen als primair voordeel
✅ VEILIG:      ondersteunt · kan bijdragen aan · helpt bij het gevoel van · bevordert comfort · draagt bij aan
✅ GRENS:       vermindert spierpijn · verbetert slaapkwaliteit · verhoogt energieniveau · ondersteunt herstel na inspanning

STRUCTUURREGELS:
Titel A/B: begin met "Mvolo [productnaam]" — exact 1 spatie, geen leestekens na het merk
Titel C/D: begin DIRECT met het primaire keyword — NOOIT "Mvolo" vooraan
MAX TITELLENGTE: 150 tekens — tel elk teken zorgvuldig
description_short: MAX 170 tekens — één krachtige zin met kernvoordeel + USP
description_long:  500-1000 tekens — structuur: 1 intro-zin + 3-5 bullets (•) + 1 gebruikstip

Genereer EXACT dit JSON zonder andere tekst:
{
  "variants": [
    {
      "id": "A",
      "label": "Met merknaam + veilige claims",
      "compliance": "green",
      "title": "...",
      "description_short": "...",
      "description_long": "..."
    },
    {
      "id": "B",
      "label": "Met merknaam + grens-claims",
      "compliance": "orange",
      "title": "...",
      "description_short": "...",
      "description_long": "..."
    },
    {
      "id": "C",
      "label": "Zonder merknaam + veilige claims",
      "compliance": "green",
      "title": "...",
      "description_short": "...",
      "description_long": "..."
    },
    {
      "id": "D",
      "label": "Zonder merknaam + grens-claims",
      "compliance": "orange",
      "title": "...",
      "description_short": "...",
      "description_long": "..."
    }${season ? `,
    {
      "id": "S",
      "label": "Seizoens-variant (${season})",
      "compliance": "green",
      "season": "${season}",
      "title": "...",
      "description_short": "...",
      "description_long": "..."
    }` : ''}
  ]
}`;
}

// ── Fetch competitor titles for category ──────────────────────────────────────
async function fetchCompetitorTitles(category: string | null): Promise<string[]> {
  if (!category) return [];
  const { data } = await supabase
    .from('competitor_listings')
    .select('title')
    .ilike('category', `%${category}%`)
    .limit(6);
  return (data ?? []).map((r: any) => r.title).filter(Boolean);
}

// ── Build CTR feedback string ─────────────────────────────────────────────────
async function buildCtrFeedback(productId: string, language: string, category: string | null): Promise<string | null> {
  // Check if this specific product has CTR data
  const { data: own } = await supabase
    .from('feed_product_content')
    .select('ctr_14d, selected_variant_id, ai_variants')
    .eq('product_id', productId)
    .eq('language', language)
    .not('ctr_14d', 'is', null)
    .single();

  const lines: string[] = [];

  if (own?.ctr_14d != null) {
    const variantLabel = (own.ai_variants as Variant[] | null)?.find(v => v.id === own.selected_variant_id)?.label ?? own.selected_variant_id ?? 'vorige variant';
    lines.push(`Huidige goedgekeurde variant ("${variantLabel}") had een CTR van ${own.ctr_14d}% in de afgelopen 14 dagen.`);
  }

  // Category-level patterns (only if enough data)
  if (category) {
    const { data: catData, count } = await supabase
      .from('feed_product_content')
      .select('ctr_14d, selected_variant_id', { count: 'exact' })
      .not('ctr_14d', 'is', null)
      .gte('ctr_14d', 0);

    if (count && count >= MIN_CTR_DATAPOINTS) {
      const avgCtr = ((catData ?? []).reduce((s, r: any) => s + (r.ctr_14d ?? 0), 0) / (catData ?? []).length).toFixed(2);
      lines.push(`Gemiddelde CTR in categorie "${category}": ${avgCtr}%. Streef hier duidelijk boven.`);
    }
  }

  return lines.length ? lines.join(' ') : null;
}

// ── Validate & trim variants ──────────────────────────────────────────────────
function validateVariants(variants: Variant[]): Variant[] {
  return variants.map(v => ({
    ...v,
    title:             (v.title ?? '').substring(0, 150),
    description_short: (v.description_short ?? '').substring(0, 170),
    description_long:  v.description_long ?? '',
  }));
}

// ── POST — run enrichment ────────────────────────────────────────────────────
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.product_ids?.length || !body?.language) {
    return NextResponse.json({ error: 'product_ids en language zijn verplicht' }, { status: 400 });
  }

  const {
    product_ids,
    language,
    field   = 'both',
    channel = 'all',
    season  = null,
  } = body as {
    product_ids: string[];
    language:    string;
    field:       string;
    channel:     string;
    season:      string | null;
  };

  // Create batch record
  const { data: batch } = await supabase
    .from('feed_enrichment_batches')
    .insert({ language, field, channel, season, status: 'running', product_count: product_ids.length })
    .select('id').single();
  const batchId = batch?.id ?? null;

  let totalInput  = 0;
  let totalOutput = 0;
  const errors: string[] = [];
  let enriched = 0;

  for (const productId of product_ids) {
    try {
      // Fetch product
      const { data: product, error: pErr } = await supabase
        .from('products')
        .select('id,name_nl,description_nl,category,brand,ean,sku,price_eur,shopify_handle,image_url')
        .eq('id', productId).single();
      if (pErr || !product) { errors.push(`${productId}: product niet gevonden`); continue; }

      // Fetch existing content
      const { data: content } = await supabase
        .from('feed_product_content')
        .select('id,title,description,product_url,ctr_14d,selected_variant_id,ai_variants')
        .eq('product_id', productId).eq('language', language).single();

      // Competitor titles + CTR feedback + learnings (parallel)
      const [competitors, ctrFeedback, learningsRes] = await Promise.all([
        fetchCompetitorTitles(product.category),
        buildCtrFeedback(productId, language, product.category),
        supabase.from('feed_learnings')
          .select('learning,category,impact_pct,confidence')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      const learnings = (learningsRes.data ?? []).map(l =>
        `[${l.category}${l.impact_pct ? `, impact ${l.impact_pct > 0 ? '+' : ''}${l.impact_pct}%` : ''}${l.confidence === 'high' ? ', hoog vertrouwen' : ''}] ${l.learning}`
      );

      // Build prompt & call Claude
      const prompt = buildPrompt({ product, content, language, channel, season, competitors, ctrFeedback, learnings });
      const msg = await anthropic.messages.create({
        model:      MODEL,
        max_tokens: 5120,
        messages:   [{ role: 'user', content: prompt }],
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      totalInput  += msg.usage.input_tokens;
      totalOutput += msg.usage.output_tokens;

      const parsed   = extractJSON(text);
      const variants = validateVariants(parsed.variants ?? []);

      // Upsert into feed_product_content
      await supabase.from('feed_product_content').upsert({
        product_id:           productId,
        language,
        ai_variants:          variants,
        ai_status:            'pending',
        channel_optimized_for: channel,
      }, { onConflict: 'product_id,language' }).select();

      enriched++;
    } catch (e: any) {
      errors.push(`${productId}: ${e.message?.substring(0, 200) ?? 'onbekende fout'}`);
    }
  }

  const cost = calcCost(totalInput, totalOutput);

  if (batchId) {
    await supabase.from('feed_enrichment_batches').update({
      status:        errors.length === product_ids.length ? 'failed' : 'completed',
      tokens_input:  totalInput,
      tokens_output: totalOutput,
      cost_usd:      cost,
      errors:        errors.length ? errors : null,
      completed_at:  new Date().toISOString(),
    }).eq('id', batchId);
  }

  return NextResponse.json({
    batch_id:      batchId,
    enriched,
    total:         product_ids.length,
    tokens_input:  totalInput,
    tokens_output: totalOutput,
    cost_usd:      Number(cost.toFixed(6)),
    errors:        errors.length ? errors : undefined,
  });
}

// ── GET — recent batches ──────────────────────────────────────────────────────
export async function GET() {
  const { data } = await supabase
    .from('feed_enrichment_batches')
    .select('id,language,field,channel,season,status,product_count,tokens_input,tokens_output,cost_usd,created_at,completed_at')
    .order('created_at', { ascending: false })
    .limit(20);
  return NextResponse.json({ batches: data ?? [] });
}
