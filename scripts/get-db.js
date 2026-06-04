#!/usr/bin/env node
/**
 * scripts/get-db.js
 * Downloads the latest mvolo-db-snapshot artifact from GitHub Actions (main branch)
 * and places it at mvolo.db in the project root.
 *
 * Usage:
 *   npm run get-db
 *
 * Requires GITHUB_TOKEN in .env with `repo` scope (private repo).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const OWNER = 'MGR-1';
const REPO = 'mvolo-dashboard';
const WORKFLOW = 'sync-deploy.yml';
const ARTIFACT_NAME = 'mvolo-db-snapshot';
const TOKEN = process.env.GITHUB_TOKEN;

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const ZIP_PATH = path.join(DATA_DIR, '_snapshot.zip');
const EXTRACT_DIR = path.join(DATA_DIR, '_extract');
const DB_PATH = path.join(ROOT_DIR, 'mvolo.db');

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function main() {
  if (!TOKEN) {
    console.error('❌  GITHUB_TOKEN not set — add it to .env');
    console.error('    Create one at: https://github.com/settings/tokens (needs repo scope)');
    process.exit(1);
  }

  // ── 1. Find latest successful runs on main ───────────────────────────────
  console.log('🔍  Looking for latest artifact on main...');
  const runsRes = await axios.get(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs`,
    { headers, params: { branch: 'main', status: 'success', per_page: 10 } }
  );

  const runs = runsRes.data.workflow_runs;
  if (!runs.length) {
    console.error('❌  No successful runs found on main');
    process.exit(1);
  }

  // ── 2. Find the most recent run that has a non-expired artifact ──────────
  let targetRun = null;
  let artifact = null;

  for (const run of runs) {
    const artifactsRes = await axios.get(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts`,
      { headers }
    );
    const found = artifactsRes.data.artifacts.find(
      (a) => a.name === ARTIFACT_NAME && !a.expired
    );
    if (found) {
      targetRun = run;
      artifact = found;
      break;
    }
  }

  if (!artifact) {
    console.log(`⚡  No artifact found — triggering a manual workflow run on main...`);
    await axios.post(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      { ref: 'main' },
      { headers }
    );
    console.log('🕐  Workflow triggered. Waiting for it to complete (this takes ~5 min)...');

    // Poll until a new run with the artifact appears
    let attempts = 0;
    const maxAttempts = 40; // 40 × 15s = 10 min max
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 15000));
      attempts++;
      process.stdout.write(`   Checking... (${attempts * 15}s elapsed)\r`);

      const pollRes = await axios.get(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs`,
        { headers, params: { branch: 'main', event: 'workflow_dispatch', per_page: 3 } }
      );

      for (const run of pollRes.data.workflow_runs) {
        if (run.status !== 'completed') continue;
        if (run.conclusion !== 'success') {
          console.error(`\n❌  Workflow run #${run.run_number} finished with: ${run.conclusion}`);
          process.exit(1);
        }
        const artifactsRes = await axios.get(
          `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}/artifacts`,
          { headers }
        );
        const found = artifactsRes.data.artifacts.find(
          (a) => a.name === ARTIFACT_NAME && !a.expired
        );
        if (found) {
          targetRun = run;
          artifact = found;
          break;
        }
      }
      if (artifact) break;
    }

    if (!artifact) {
      console.error('\n❌  Timed out waiting for artifact. Check the Actions tab on GitHub.');
      process.exit(1);
    }
    console.log(''); // newline after \r polling output
  }

  const runDate = new Date(targetRun.created_at).toLocaleString('nl-NL');
  const sizeKb = (artifact.size_in_bytes / 1024).toFixed(1);
  console.log(`✅  Found: run #${targetRun.run_number} from ${runDate} (${sizeKb} KB)`);

  // ── 3. Download artifact zip ─────────────────────────────────────────────
  console.log('📥  Downloading...');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const downloadRes = await axios.get(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${artifact.id}/zip`,
    { headers, responseType: 'arraybuffer', maxRedirects: 10 }
  );

  fs.writeFileSync(ZIP_PATH, downloadRes.data);

  // ── 4. Extract ───────────────────────────────────────────────────────────
  console.log('📦  Extracting...');
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });

  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${EXTRACT_DIR}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o "${ZIP_PATH}" -d "${EXTRACT_DIR}"`, { stdio: 'inherit' });
  }

  // ── 5. Move db into place ────────────────────────────────────────────────
  const extracted = path.join(EXTRACT_DIR, 'mvolo.db');
  if (!fs.existsSync(extracted)) {
    console.error('❌  mvolo.db not found inside the zip');
    process.exit(1);
  }

  fs.copyFileSync(extracted, DB_PATH);

  // ── 6. Cleanup ───────────────────────────────────────────────────────────
  fs.rmSync(ZIP_PATH, { force: true });
  fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });

  const sizeMb = (fs.statSync(DB_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`✅  mvolo.db updated — ${sizeMb} MB`);
}

main().catch((err) => {
  // Clean up temp files on failure
  try { fs.rmSync(ZIP_PATH, { force: true }); } catch {}
  try { fs.rmSync(EXTRACT_DIR, { recursive: true, force: true }); } catch {}
  console.error('❌  Error:', err.response?.data?.message ?? err.message);
  process.exit(1);
});
