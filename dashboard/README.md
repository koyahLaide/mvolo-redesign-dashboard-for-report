This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy op Vercel (dashboard delen)

Het dashboard is standaard alleen lokaal bereikbaar. Om het te delen deploy je het gratis op Vercel:

### Stap 1 — Installeer Vercel CLI (eenmalig)

```bash
npm install -g vercel
```

### Stap 2 — Login bij Vercel

```bash
vercel login
```

### Stap 3 — Deploy vanuit de dashboard map

```bash
cd ~/Documents/mvolo-dashboard/dashboard
vercel --prod
```

Vercel vraagt een paar dingen:
- **Set up and deploy?** → Y
- **Which scope?** → kies je account
- **Link to existing project?** → N (eerste keer)
- **Project name** → `mvolo-dashboard` (of een eigen naam)
- **Directory** → `.` (de huidige map)

Na het deployen krijg je een publieke URL zoals:
`https://mvolo-dashboard.vercel.app`

Die URL kun je delen via de **Deel** knop in het dashboard.

### Opmerking over de database

Vercel is een serverless platform — de lokale SQLite database (`data/mvolo.db`) is er niet beschikbaar. Het gedeelde dashboard werkt alleen als je de database ook online zet, bijv. via [Turso](https://turso.tech) (gratis SQLite in de cloud). Neem contact op voor hulp bij deze stap.
