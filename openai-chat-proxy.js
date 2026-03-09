const http = require('http');
const fs = require('fs');
const path = require('path');

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  const lines = fs.readFileSync(filepath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = stripQuotes(rawValue);
    }
  }
}

loadEnvFile(path.join(process.cwd(), '.env'));

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ROOT = process.cwd();

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(body));
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function getSystemPrompt(mode) {
  if (mode === 'recipe') {
    return [
      'Kamu adalah asisten resep Midea berbahasa Indonesia.',
      'Berikan jawaban praktis, jelas, dan aman.',
      'Saat memberi resep: tampilkan bahan, langkah, waktu, suhu/daya, dan tips alat Midea.',
      'Jika info kurang, ajukan maksimal 2 pertanyaan klarifikasi.',
    ].join(' ');
  }

  return [
    'Kamu adalah asisten support Midea berbahasa Indonesia.',
    'Fokus pada troubleshooting, penggunaan produk, garansi, dan service center.',
    'Jawab ringkas, berurutan, aman, dan tidak mengarang data lokasi service center.',
    'Jika perlu data tambahan, minta data penting saja (model, gejala, kota).',
  ].join(' ');
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (!item || !Array.isArray(item.content)) continue;
      for (const c of item.content) {
        if (c && typeof c.text === 'string') {
          parts.push(c.text);
        }
      }
    }
    const joined = parts.join('\n').trim();
    if (joined) return joined;
  }

  return '';
}

async function callOpenAI(mode, messages) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY belum terbaca. Isi file .env lalu restart server.');
  }

  const input = [{ role: 'system', content: getSystemPrompt(mode) }];
  for (const msg of messages) {
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant') || typeof msg.content !== 'string') {
      continue;
    }
    input.push({
      role: msg.role,
      content: msg.content,
    });
  }

  const models = [...new Set([OPENAI_MODEL, 'gpt-4o-mini'])];
  let lastError = null;

  for (const model of models) {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input,
        temperature: 0.4,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const code = data?.error?.code || '';
      const detail = data?.error?.message || `HTTP ${resp.status}`;
      const lower = String(detail).toLowerCase();

      if (resp.status === 401 || code === 'invalid_api_key') {
        throw new Error('API key OpenAI tidak valid atau salah project.');
      }
      if (resp.status === 429 || code === 'insufficient_quota') {
        throw new Error('Kuota/billing OpenAI habis. Cek usage dan billing project.');
      }
      if (code === 'model_not_found' || lower.includes('model') && lower.includes('not found')) {
        lastError = new Error(`Model ${model} tidak tersedia. Mencoba model fallback...`);
        continue;
      }

      throw new Error(`OpenAI API error: ${detail}`);
    }

    const answer = extractOutputText(data);
    if (!answer) {
      throw new Error('Respons OpenAI kosong.');
    }

    return answer;
  }

  throw lastError || new Error('Gagal memanggil model OpenAI.');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Payload terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('JSON tidak valid.'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const reqPath = decodeURIComponent(req.url.split('?')[0]);
  const cleanPath = reqPath === '/' ? '/index.html' : reqPath;
  const fullPath = path.join(ROOT, cleanPath);

  if (!fullPath.startsWith(ROOT)) {
    text(res, 403, 'Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      text(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mime = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    }[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (readErr, content) => {
      if (readErr) {
        text(res, 500, 'Read error');
        return;
      }
      text(res, 200, content, mime);
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/health')) {
    json(res, 200, {
      ok: true,
      model: OPENAI_MODEL,
      apiKeyConfigured: Boolean(OPENAI_API_KEY),
      date: new Date().toISOString(),
    });
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/api/chat')) {
    try {
      const body = await parseBody(req);
      const mode = body?.mode === 'recipe' ? 'recipe' : 'support';
      const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
      const reply = await callOpenAI(mode, messages);
      json(res, 200, { reply });
    } catch (err) {
      json(res, 500, { error: err.message || 'Unknown error' });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  text(res, 405, 'Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Midea chat proxy running on http://localhost:${PORT}`);
  console.log(`Model default: ${OPENAI_MODEL}`);
  console.log(`OpenAI key: ${OPENAI_API_KEY ? 'configured' : 'missing'}`);
  if (!OPENAI_API_KEY) {
    console.log('Tip: buat file .env berisi OPENAI_API_KEY=sk-... lalu restart server.');
  }
});
