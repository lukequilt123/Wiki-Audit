/**
 * WikiAudit — Cloudflare Worker Proxy
 * Securely proxies requests to Gemini API without exposing the API key.
 *
 * Environment variable required:
 *   GEMINI_API_KEY — your Google Gemini API key (set as a secret in Cloudflare)
 *
 * Deploy via Cloudflare Dashboard:
 *   1. Go to dash.cloudflare.com → Workers & Pages → Create
 *   2. Name it "wikiaudit-proxy" → Deploy
 *   3. Click "Edit Code" → paste this file → Save and Deploy
 *   4. Go to Settings → Variables and Secrets → Add: GEMINI_API_KEY = your key (encrypt)
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Allowed origins — update with your GitHub Pages URL
const ALLOWED_ORIGINS = [
  'https://lukequilt123.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.some(o => origin.startsWith(o));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ALLOWED_ORIGINS[0];

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    // Check origin
    if (!isAllowedOrigin(request)) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check API key is configured
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    try {
      // Parse the incoming request
      const body = await request.json();
      const model = body.model || 'gemini-2.5-flash';

      // Remove model from the body (it's used in the URL)
      delete body.model;

      // Forward to Gemini API
      const geminiUrl = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await geminiResponse.json();

      return new Response(JSON.stringify(data), {
        status: geminiResponse.status,
        headers: {
          ...corsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Proxy error' }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
