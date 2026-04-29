import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { product } = await req.json();
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        suggestions: [
          `${product.title?.split(' ').slice(0, 3).join(' ')} - Mvolo Lichttherapie Professioneel`,
          `Mvolo ${product.product_type ?? 'Lichttherapie'} - ${product.title?.split(' ').slice(0, 5).join(' ')}`,
        ]
      });
    }

    const prompt = `Je bent een Google Shopping feed specialist. Genereer 3 geoptimaliseerde producttitels voor dit Mvolo product.

Product info:
- Huidige titel: ${product.title}
- Type: ${product.product_type}
- Prijs: €${product.price}
- SKU: ${product.sku}
- Tags: ${product.tags}

Regels voor Google Shopping titels:
1. Maximaal 150 tekens
2. Begin met het meest zoekbare keyword
3. Voeg merk "Mvolo" toe
4. Gebruik specifieke kenmerken (kleur, materiaal, maat, model)
5. Vermijd promotional tekst zoals "gratis", "beste", "aanbieding"
6. Schrijf in het Nederlands
7. Doelgroep: mensen die zoeken naar lichttherapie producten

Geef ALLEEN een JSON array terug met 3 titelopties, geen uitleg:
["titel 1", "titel 2", "titel 3"]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '[]';
    const clean = text.replace(/```json|```/g, '').trim();
    const suggestions = JSON.parse(clean);

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, suggestions: [] }, { status: 500 });
  }
}
