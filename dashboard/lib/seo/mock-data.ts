export type Competition = 'HIGH' | 'MEDIUM' | 'LOW';
export type Category = 'long-tail' | 'questions' | 'commercial' | 'related-topics' | 'semantic';

export interface Keyword {
  id: string;
  keyword: string;
  volume: number;
  trend: number[];
  cpc: number;
  competition: Competition;
  position: number;
  impressions: number;
  clicks: number;
  category: Category;
}

export interface Opportunity extends Keyword {
  opportunityScore: number;
}

export const DOMAINS = ['mvolo.nl', 'mvolo.de', 'mvolo.fr', 'mvolo.be'];

export const KEYWORDS: Keyword[] = [
  { id: 'k1',  keyword: 'lichttherapie lamp',           volume: 2400, trend: [70,72,75,80,82,85,89],          cpc: 1.20, competition: 'MEDIUM', position: 4,  impressions: 1200, clicks: 89,  category: 'commercial'     },
  { id: 'k2',  keyword: 'rood licht therapie',          volume: 1800, trend: [40,45,50,52,55,58,62],          cpc: 0.95, competition: 'LOW',    position: 7,  impressions: 890,  clicks: 45,  category: 'semantic'       },
  { id: 'k3',  keyword: 'infraroodlamp kopen',          volume: 3200, trend: [80,85,82,88,90,92,95],          cpc: 1.80, competition: 'HIGH',   position: 12, impressions: 650,  clicks: 18,  category: 'commercial'     },
  { id: 'k4',  keyword: 'daglichtlamp winterdepressie', volume: 1400, trend: [120,130,135,140,145,148,156],   cpc: 0.70, competition: 'LOW',    position: 3,  impressions: 2100, clicks: 156, category: 'related-topics' },
  { id: 'k5',  keyword: 'beste rood licht apparaat',    volume: 900,  trend: [2,3,4,5,6,7,8],                 cpc: 1.40, competition: 'MEDIUM', position: 15, impressions: 320,  clicks: 8,   category: 'commercial'     },
  { id: 'k6',  keyword: 'lichttherapie pijnklachten',   volume: 1100, trend: [35,40,42,45,48,50,52],          cpc: 0.85, competition: 'LOW',    position: 6,  impressions: 780,  clicks: 52,  category: 'related-topics' },
  { id: 'k7',  keyword: 'infrarood lamp rugpijn',       volume: 2100, trend: [5,6,7,8,9,10,11],               cpc: 1.10, competition: 'MEDIUM', position: 18, impressions: 420,  clicks: 11,  category: 'related-topics' },
  { id: 'k8',  keyword: 'daglichtlamp kopen',           volume: 2800, trend: [180,190,200,215,225,235,245],   cpc: 1.50, competition: 'HIGH',   position: 2,  impressions: 3400, clicks: 245, category: 'commercial'     },
  { id: 'k9',  keyword: 'rood licht therapie huid',     volume: 1300, trend: [20,22,25,28,30,32,34],          cpc: 0.90, competition: 'LOW',    position: 9,  impressions: 560,  clicks: 34,  category: 'related-topics' },
  { id: 'k10', keyword: 'infrarood sauna thuis',        volume: 1900, trend: [2,3,4,4,5,5,6],                 cpc: 1.30, competition: 'MEDIUM', position: 22, impressions: 280,  clicks: 6,   category: 'long-tail'      },
  { id: 'k11', keyword: 'lichttherapie depressie',      volume: 1600, trend: [55,60,62,65,70,74,78],          cpc: 0.75, competition: 'LOW',    position: 5,  impressions: 1100, clicks: 78,  category: 'related-topics' },
  { id: 'k12', keyword: 'rood licht apparaat kopen',    volume: 850,  trend: [1,2,2,3,3,3,3],                 cpc: 1.60, competition: 'HIGH',   position: 28, impressions: 190,  clicks: 3,   category: 'commercial'     },
  { id: 'k13', keyword: 'infraroodtherapie ervaringen', volume: 720,  trend: [18,20,22,24,26,27,29],          cpc: 0.60, competition: 'LOW',    position: 11, impressions: 480,  clicks: 29,  category: 'questions'      },
  { id: 'k14', keyword: 'beste daglichtlamp 2026',      volume: 2200, trend: [40,45,48,52,55,58,61],          cpc: 1.35, competition: 'MEDIUM', position: 8,  impressions: 950,  clicks: 61,  category: 'commercial'     },
  { id: 'k15', keyword: 'lichttherapie werkt niet',     volume: 480,  trend: [8,10,11,12,13,14,15],           cpc: 0.45, competition: 'LOW',    position: 14, impressions: 350,  clicks: 15,  category: 'questions'      },
  { id: 'k16', keyword: 'infraroodlamp reviews',        volume: 650,  trend: [3,4,5,5,6,6,7],                 cpc: 1.00, competition: 'MEDIUM', position: 19, impressions: 210,  clicks: 7,   category: 'questions'      },
  { id: 'k17', keyword: 'rood licht therapie acne',     volume: 980,  trend: [30,35,38,40,42,45,48],          cpc: 0.80, competition: 'LOW',    position: 7,  impressions: 720,  clicks: 48,  category: 'related-topics' },
  { id: 'k18', keyword: 'infrarood lamp gezondheid',    volume: 1050, trend: [5,7,8,9,10,11,12],              cpc: 0.65, competition: 'LOW',    position: 16, impressions: 310,  clicks: 12,  category: 'related-topics' },
  { id: 'k19', keyword: 'lichttherapie sessie duur',    volume: 380,  trend: [25,28,30,32,34,36,38],          cpc: 0.55, competition: 'LOW',    position: 1,  impressions: 450,  clicks: 38,  category: 'questions'      },
];

export const OPPORTUNITIES: Opportunity[] = KEYWORDS
  .filter(k => k.position > 10 && k.impressions > 50)
  .map(k => ({ ...k, opportunityScore: Math.round(k.volume / k.position) }));

export const RANKINGS = {
  top1to3:    { count: 12,  change: 2  },
  top4to10:   { count: 34,  change: 5  },
  top11to25:  { count: 67,  change: -3 },
  top25to100: { count: 156, change: 8  },
  lastProcessed: 'May 28, 2026',
  comparison: '30 dagen',
};

export const HEALTH_SCORE = {
  score: 72,
  strengths: [
    "Alle pagina's hebben meta descriptions",
    'XML sitemap ingediend',
    'robots.txt geconfigureerd',
  ],
  weaknesses: [
    "12 pagina's missen H1-tags",
    "3 pagina's met kapotte interne links",
    "Schema ontbreekt op 8 productpagina's",
  ],
};

export const CATEGORY_TAGS: Array<{ key: Category; label: string; color: string; count: number }> = [
  { key: 'long-tail',     label: 'long-tail',              color: 'blue',   count: 31 },
  { key: 'questions',     label: 'vragen',                 color: 'purple', count: 18 },
  { key: 'commercial',    label: 'commercieel',            color: 'green',  count: 24 },
  { key: 'related-topics', label: 'gerelateerde onderwerpen', color: 'amber', count: 12 },
  { key: 'semantic',      label: 'semantisch',             color: 'gray',   count: 8  },
];

export const GEO_AUDIT_RESULTS = {
  compositeScore: 73,
  checks: [
    { name: 'Crawlability',         score: 85, status: 'good'    as const, message: 'Pagina laadt zonder JavaScript. Goed.' },
    { name: 'Schema',               score: 60, status: 'warning' as const, message: 'Gedeeltelijk JSON-LD gedetecteerd. Ontbrekend: AggregateRating.' },
    { name: 'Answer-First Content', score: 70, status: 'warning' as const, message: 'Kernantwoord staat in 3e alinea. Verplaats naar boven.' },
    { name: 'Informatiedichtheid',  score: 90, status: 'good'    as const, message: 'Rijke feitelijke content met metingen en specificaties.' },
    { name: 'Heading Hiërarchie',   score: 95, status: 'good'    as const, message: 'Correcte H1→H2→H3 opbouw. Goed gestructureerd.' },
    { name: 'Versheid',             score: 40, status: 'bad'     as const, message: 'Laatste update 8 maanden geleden. Update aanbevolen.' },
  ],
  issues: [
    { level: 'HIGH'   as const, message: 'Ontbrekend AggregateRating schema — geen reviewdata in gestructureerde data' },
    { level: 'MEDIUM' as const, message: 'Answer-first content: kernvoordelen product staan niet in eerste 200 woorden' },
    { level: 'HIGH'   as const, message: 'Content verouderd: 8 maanden geleden bijgewerkt (drempel: 6 maanden)' },
  ],
};
