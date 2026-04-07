import path from 'path';
import fs from 'fs';

// Local dev:  repo-root/data/mvolo.db  (dashboard is a subdirectory)
// Vercel:     dashboard/data/mvolo.db  (Next.js project root = dashboard/)
const CANDIDATE_PATHS = [
  path.join(process.cwd(), 'data', 'mvolo.db'),
  path.join(process.cwd(), '..', 'data', 'mvolo.db'),
];

export const DB_PATH: string =
  CANDIDATE_PATHS.find((p) => fs.existsSync(p)) ?? CANDIDATE_PATHS[0];
