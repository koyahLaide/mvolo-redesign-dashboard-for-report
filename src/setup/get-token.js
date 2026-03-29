'use strict';

/**
 * Shopify OAuth token exchange — one-time setup script.
 *
 * Usage:
 *   node src/setup/get-token.js
 *
 * Prerequisites in .env:
 *   SHOPIFY_STORE=yourstore.myshopify.com
 *   SHOPIFY_API_KEY=your_api_key
 *   SHOPIFY_API_SECRET=your_api_secret
 *
 * After completion, SHOPIFY_TOKEN is written to .env automatically.
 */

require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const open = require('open');

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const ENV_PATH = path.resolve(__dirname, '../../.env');

const { SHOPIFY_STORE, SHOPIFY_API_KEY, SHOPIFY_API_SECRET } = process.env;

// ── Validate required env vars ────────────────────────────────────────────────
if (!SHOPIFY_STORE || !SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
  console.error('\nMissing required environment variables. Ensure .env contains:');
  console.error('  SHOPIFY_STORE, SHOPIFY_API_KEY, SHOPIFY_API_SECRET\n');
  process.exit(1);
}

// ── Build the OAuth authorization URL ────────────────────────────────────────
const authUrl =
  `https://${SHOPIFY_STORE}/admin/oauth/authorize` +
  `?client_id=${SHOPIFY_API_KEY}` +
  `&scope=read_orders,read_customers` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

// ── Write / update SHOPIFY_TOKEN in .env ─────────────────────────────────────
function writeTokenToEnv(token) {
  let contents = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';

  if (/^SHOPIFY_TOKEN=/m.test(contents)) {
    // Replace existing line
    contents = contents.replace(/^SHOPIFY_TOKEN=.*$/m, `SHOPIFY_TOKEN=${token}`);
  } else {
    // Append new line
    contents = contents.trimEnd() + `\nSHOPIFY_TOKEN=${token}\n`;
  }

  fs.writeFileSync(ENV_PATH, contents, 'utf8');
}

// ── Start local server and handle OAuth callback ──────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const shop = url.searchParams.get('shop');

  if (!code) {
    res.writeHead(400);
    res.end('Missing code parameter in callback.');
    console.error('\nNo code received in callback URL. OAuth flow aborted.\n');
    server.close();
    return;
  }

  console.log(`\nCallback received from ${shop}`);
  console.log('Exchanging authorization code for access token…');

  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE}/admin/oauth/access_token`,
      {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { access_token, scope } = response.data;

    writeTokenToEnv(access_token);

    console.log('\n✔ Access token received and saved to .env');
    console.log(`  Token  : ${access_token}`);
    console.log(`  Scopes : ${scope}\n`);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Shopify Auth</title></head>
        <body style="font-family:sans-serif;padding:2rem;max-width:480px;margin:auto">
          <h2>✔ Token ontvangen</h2>
          <p>Je access token is opgeslagen in <code>.env</code>.</p>
          <p><strong>Token:</strong> <code>${access_token}</code></p>
          <p><strong>Scopes:</strong> <code>${scope}</code></p>
          <p>Je kunt dit venster sluiten en <code>npm start</code> uitvoeren.</p>
        </body>
      </html>
    `);

  } catch (err) {
    const detail = err.response?.data ?? err.message;
    console.error('\n✖ Token exchange failed:', JSON.stringify(detail, null, 2));

    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <body style="font-family:sans-serif;padding:2rem">
          <h2>✖ Token exchange mislukt</h2>
          <pre>${JSON.stringify(detail, null, 2)}</pre>
        </body>
      </html>
    `);
  } finally {
    server.close(() => {
      console.log('Local server stopped. Setup complete.\n');
    });
  }
});

server.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Shopify OAuth — Token Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n  Store     : ${SHOPIFY_STORE}`);
  console.log(`  Callback  : ${REDIRECT_URI}`);
  console.log('\n  Opening browser for authorization…\n');

  open(authUrl).catch(() => {
    console.log('  Could not open browser automatically.');
    console.log('  Open this URL manually:\n');
    console.log(`  ${authUrl}\n`);
  });
});
