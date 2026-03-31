const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

// Load .env from script directory first, then current working directory.
// This avoids config miss when node is run from a different folder.
loadEnvFile(path.join(__dirname, '.env'));
if (process.cwd() !== __dirname) {
  loadEnvFile(path.join(process.cwd(), '.env'));
}

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const RAW_BASE_URL =
  process.env.OPENAI_BASE_URL ||
  process.env.OPENAI_API_BASE_URL ||
  process.env.OPENAI_API_BASE ||
  process.env.LITELLM_BASE_URL ||
  process.env.HOME_BASE ||
  '';
const ROOT = process.cwd();

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'https://api.openai.com/v1';
  let noSlash = raw.replace(/\/+$/, '');
  // user kadang menaruh URL dashboard LiteLLM (/ui), bukan base API.
  if (/\/ui$/i.test(noSlash)) {
    noSlash = noSlash.replace(/\/ui$/i, '');
  }
  if (/\/v\d+$/i.test(noSlash)) return noSlash;
  return `${noSlash}/v1`;
}

const OPENAI_BASE_URL = normalizeBaseUrl(RAW_BASE_URL);
const PREFER_CHAT_COMPLETIONS = !/api\.openai\.com\/v1$/i.test(OPENAI_BASE_URL);

function apiUrl(pathname) {
  const path = String(pathname || '');
  return `${OPENAI_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

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

function normalizeLang(lang) {
  if (lang === 'en' || lang === 'zh') return lang;
  return 'id';
}

function languageName(lang) {
  const code = normalizeLang(lang);
  if (code === 'en') return 'English';
  if (code === 'zh') return 'Simplified Chinese';
  return 'Bahasa Indonesia';
}

const MANUAL_KB = [
  {
    id: 'safety-open-lid',
    mode: 'support',
    keywords: [
      'tutup susah dibuka',
      'sulit dibuka',
      'float valve',
      'pressure',
      'tekanan',
      'open lid',
      'cannot open',
      'quick release',
      'nature release',
      '打不开',
      '开盖',
      '压力',
    ],
    title: {
      id: 'Cara Membuka Tutup dengan Aman',
      en: 'How to Open the Lid Safely',
      zh: '安全开盖方法',
    },
    body: {
      id: 'Jangan buka tutup sebelum tekanan habis. Lakukan quick release atau tunggu nature release 10–15 menit sampai float valve turun, baru buka tutup.',
      en: 'Do not open the lid before pressure is fully released. Use quick release or wait 10-15 minutes for natural release until the float valve drops.',
      zh: '压力未释放前请勿开盖。可执行快速泄压，或等待自然泄压 10-15 分钟，直到浮子阀下降。',
    },
  },
  {
    id: 'safety-steam-burn',
    mode: 'support',
    keywords: ['uap panas', 'steam', 'burn', 'luka bakar', 'katup', '蒸汽', '烫伤'],
    title: {
      id: 'Peringatan Uap Panas',
      en: 'Hot Steam Warning',
      zh: '高温蒸汽警告',
    },
    body: {
      id: 'Jauhkan tangan dan wajah dari katup buang/float valve saat proses memasak atau saat pelepasan uap.',
      en: 'Keep hands and face away from the steam release valve and float valve during cooking and pressure release.',
      zh: '烹饪和泄压时，请让手和面部远离排气阀和浮子阀。',
    },
  },
  {
    id: 'max-fill',
    mode: 'support',
    keywords: ['max', 'melebihi', 'overflow', 'isi panci', 'overfill', '超过', '容量'],
    title: {
      id: 'Batas Pengisian Panci',
      en: 'Pot Fill Limit',
      zh: '内锅装载上限',
    },
    body: {
      id: 'Bahan+air tidak boleh melebihi garis MAX. Umumnya maksimal 2/3 panci, dan untuk bahan mengembang maksimal 1/2 panci.',
      en: 'Ingredients plus water must not exceed the MAX line. In general, fill up to 2/3, and for expanding ingredients up to 1/2.',
      zh: '食材和水量不得超过 MAX 刻度。一般不超过 2/3，易膨胀食材不超过 1/2。',
    },
  },
  {
    id: 'sealing-ring-leak',
    mode: 'support',
    keywords: ['uap bocor', 'leak', 'sealing ring', 'ring', 'tutup bocor', '漏气', '密封圈'],
    title: {
      id: 'Uap Bocor dari Tutup',
      en: 'Steam Leaking from Lid',
      zh: '锅盖漏气',
    },
    body: {
      id: 'Periksa sealing ring: bersihkan, pasang ulang dengan benar, atau ganti jika retak/aus. Pastikan tutup terkunci rapat.',
      en: 'Check the sealing ring: clean it, reinstall correctly, or replace if cracked/worn. Ensure the lid is fully locked.',
      zh: '检查密封圈：清洁、重新正确安装，若老化或开裂请更换，并确认锅盖已锁紧。',
    },
  },
  {
    id: 'cleaning-care',
    mode: 'support',
    keywords: ['bersihkan', 'cuci', 'perawatan', 'clean', 'dishwasher', '清洁', '保养'],
    title: {
      id: 'Perawatan & Pembersihan',
      en: 'Care & Cleaning',
      zh: '保养与清洁',
    },
    body: {
      id: 'Cabut listrik dan tunggu dingin sebelum dibersihkan. Inner pot/sealing ring/aksesori boleh dishwasher. Tutup & bodi housing jangan masuk dishwasher.',
      en: 'Unplug and let the unit cool before cleaning. Inner pot, sealing ring, and accessories are dishwasher-safe. Lid and housing are not.',
      zh: '清洁前请断电并完全冷却。内锅、密封圈和配件可用洗碗机；锅盖和机身不可。',
    },
  },
  {
    id: 'error-codes',
    mode: 'support',
    keywords: ['e1', 'e2', 'e8', 'c1', 'error', 'kode', '错误代码', '故障代码'],
    title: {
      id: 'Kode Error',
      en: 'Error Codes',
      zh: '错误代码',
    },
    body: {
      id: 'E1/E2/E8 terkait sensor/saklar tekanan; C1 overtemperature. Hentikan penggunaan, dinginkan unit, lalu hubungi service center resmi jika berlanjut.',
      en: 'E1/E2/E8 relate to sensor/pressure switch faults; C1 is overtemperature. Stop use, cool down, and contact official service center if it persists.',
      zh: 'E1/E2/E8 多与传感器或压力开关有关，C1 为过温保护。请停止使用、冷却后若仍出现请联系官方售后。',
    },
  },
  {
    id: 'warranty',
    mode: 'support',
    keywords: ['garansi', 'warranty', 'klaim', 'claim', '保修'],
    title: {
      id: 'Informasi Garansi',
      en: 'Warranty Information',
      zh: '保修信息',
    },
    body: {
      id: 'Untuk klaim garansi, siapkan nomor model, serial number, bukti pembelian, gejala kerusakan, dan kota domisili.',
      en: 'For warranty claims, prepare model number, serial number, proof of purchase, issue symptoms, and your city.',
      zh: '申请保修请准备型号、序列号、购买凭证、故障现象及所在城市。',
    },
  },
  {
    id: 'service-center',
    mode: 'support',
    keywords: ['service center', 'servis', 'teknisi', '维修', '服务中心'],
    title: {
      id: 'Arahkan ke Service Center',
      en: 'Service Center Guidance',
      zh: '服务中心指引',
    },
    body: {
      id: 'Minta kota pengguna untuk rekomendasi service center resmi terdekat. Hindari memberi alamat jika tidak yakin.',
      en: 'Ask user city to recommend the nearest official service center. Avoid giving specific address if uncertain.',
      zh: '先询问用户所在城市，再推荐最近官方服务中心；不确定时不要编造具体地址。',
    },
  },
  {
    id: 'recipe-basic-ratio',
    mode: 'recipe',
    keywords: ['rasio', 'air', 'nasi', 'rice', 'ratio', '水量', '米饭'],
    title: {
      id: 'Rasio Dasar Pressure Cooker',
      en: 'Basic Pressure Cooker Ratio',
      zh: '压力锅基础水量比例',
    },
    body: {
      id: 'Untuk nasi: mulai dari rasio 1:1 sampai 1:1.2 (beras:air) sesuai jenis beras. Jangan melebihi 1/2 panci untuk beras yang mengembang.',
      en: 'For rice, start at 1:1 to 1:1.2 (rice:water) depending on rice type. Do not exceed 1/2 pot for expanding grains.',
      zh: '煮饭可从 1:1 到 1:1.2（米:水）起步，视米种调整。易膨胀食材不超过内锅 1/2。',
    },
  },
  {
    id: 'recipe-rendang',
    mode: 'recipe',
    keywords: ['rendang', 'beef', 'daging', 'sapi', '仁当'],
    title: {
      id: 'Panduan Rendang Pressure Cooker',
      en: 'Pressure Cooker Rendang Guide',
      zh: '压力锅仁当指南',
    },
    body: {
      id: 'Gunakan potongan daging sapi berlemak sedang, tumis bumbu dulu, lalu pressure cook ±35-45 menit. Setelah itu reduksi kuah dengan mode open-lid jika perlu.',
      en: 'Use medium-fat beef cuts, sauté spices first, then pressure-cook for about 35-45 minutes. Reduce sauce on open-lid mode if needed.',
      zh: '建议使用中等脂肪牛肉，先炒香香料后高压烹饪约 35-45 分钟，必要时开盖收汁。',
    },
  },
  {
    id: 'recipe-chicken',
    mode: 'recipe',
    keywords: ['ayam', 'chicken', 'tulang lunak', '鸡肉'],
    title: {
      id: 'Panduan Ayam Pressure Cooker',
      en: 'Pressure Cooker Chicken Guide',
      zh: '压力锅鸡肉指南',
    },
    body: {
      id: 'Untuk ayam berpotongan, gunakan waktu awal 12-20 menit tergantung ukuran. Tambahkan cairan secukupnya agar tekanan stabil.',
      en: 'For cut chicken, start with 12-20 minutes depending on size. Add enough liquid to keep pressure stable.',
      zh: '鸡肉块可先设 12-20 分钟，按块大小调整；需加入足够液体以稳定建立压力。',
    },
  },
];

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function latestUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const m = list[i];
    if (m && m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      return m.content.trim();
    }
  }
  return '';
}

function retrieveManualEntries(mode, messages) {
  const query = normalizeSearchText(latestUserText(messages));
  if (!query) return [];

  const scored = [];
  for (const entry of MANUAL_KB) {
    if (entry.mode !== 'both' && entry.mode !== mode) continue;
    let score = 0;
    for (const keyword of entry.keywords || []) {
      const kw = normalizeSearchText(keyword);
      if (!kw) continue;
      if (query.includes(kw)) score += Math.max(2, Math.min(8, kw.length / 3));
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.entry);
}

function manualLine(entry, lang) {
  const code = normalizeLang(lang);
  const title = entry?.title?.[code] || entry?.title?.id || '';
  const body = entry?.body?.[code] || entry?.body?.id || '';
  return { title, body };
}

function buildManualContext(entries, lang) {
  if (!entries || entries.length === 0) return '';
  const lines = entries.map((entry, i) => {
    const item = manualLine(entry, lang);
    return `[${i + 1}] ${item.title}\n${item.body}`;
  });
  return lines.join('\n\n');
}

function buildManualOnlyReply(mode, lang, entries) {
  const code = normalizeLang(lang);
  if (!entries || entries.length === 0) {
    if (code === 'en') {
      return 'I can help from the user manual and AI. Please describe your issue or recipe target in one sentence.';
    }
    if (code === 'zh') {
      return '我可以基于用户手册与 AI 为您提供帮助。请用一句话描述您的问题或食谱目标。';
    }
    return 'Saya bisa bantu dari buku panduan dan AI. Tolong jelaskan masalah/tujuan resep Anda dalam satu kalimat.';
  }

  const header =
    code === 'en'
      ? 'I found guidance from the built-in user manual:'
      : code === 'zh'
      ? '我在内置用户手册中找到以下参考：'
      : 'Saya menemukan panduan dari buku manual bawaan:';
  const footer =
    code === 'en'
      ? 'If needed, I can continue with detailed step-by-step actions.'
      : code === 'zh'
      ? '如需，我可以继续给出更细的分步操作。'
      : 'Kalau perlu, saya bisa lanjutkan dengan langkah yang lebih detail.';

  const bullets = entries
    .map((entry) => {
      const item = manualLine(entry, code);
      return `- ${item.title}: ${item.body}`;
    })
    .join('\n');

  return `${header}\n${bullets}\n\n${footer}`.trim();
}

function getSystemPrompt(mode, lang, manualContext = '') {
  const outputLanguage = languageName(lang);
  const contextBlock = String(manualContext || '').trim();

  if (mode === 'recipe') {
    const lines = [
      'Kamu adalah asisten resep Midea.',
      'Produk yang digunakan selalu Pressure Cooker Midea model MY-CS5039P.',
      'Jangan menanyakan jenis/model produk ke user.',
      'Berikan jawaban praktis, jelas, dan aman.',
      'Sumber jawaban harus menggabungkan: (1) referensi buku panduan jika tersedia, lalu (2) penalaran AI.',
      'Saat memberi resep: tampilkan bahan, langkah, waktu, suhu/daya, dan tips alat Midea.',
      'Jika info kurang, ajukan maksimal 2 pertanyaan klarifikasi (misal bahan yang tersedia atau target waktu).',
      `Selalu jawab dalam ${outputLanguage}.`,
    ];
    if (contextBlock) {
      lines.push('Gunakan konteks manual berikut sebagai referensi utama bila relevan:');
      lines.push(contextBlock);
    }
    return lines.join(' ');
  }

  const lines = [
    'Kamu adalah asisten support Midea.',
    'Produk yang dibahas selalu Pressure Cooker Midea model MY-CS5039P.',
    'Jangan menanyakan jenis/model produk ke user.',
    'Fokus pada troubleshooting, penggunaan produk, garansi, dan service center.',
    'Sumber jawaban harus menggabungkan: (1) referensi buku panduan jika tersedia, lalu (2) penalaran AI.',
    'Jawab ringkas, berurutan, aman, dan tidak mengarang data lokasi service center.',
    'Jika perlu data tambahan, minta data penting saja (gejala, kapan terjadi, kota).',
    `Selalu jawab dalam ${outputLanguage}.`,
  ];
  if (contextBlock) {
    lines.push('Gunakan konteks manual berikut sebagai referensi utama bila relevan:');
    lines.push(contextBlock);
  }
  return lines.join(' ');
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

function normalizeCodeBlock(textValue) {
  if (typeof textValue !== 'string') return '';
  let out = textValue.trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return out;
}

function parseJsonObjectFromText(textValue) {
  const normalized = normalizeCodeBlock(textValue);
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch (_err) {
    // try extract first JSON object block
    const start = normalized.indexOf('{');
    const end = normalized.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const maybe = normalized.slice(start, end + 1);
      try {
        return JSON.parse(maybe);
      } catch (_err2) {
        return null;
      }
    }
    return null;
  }
}

function parseTranslationsOutput(rawText, fallbackTexts) {
  const normalizeResult = (list) => {
    if (!Array.isArray(list)) return null;
    const out = [];
    for (let i = 0; i < fallbackTexts.length; i += 1) {
      const value = list[i];
      if (typeof value === 'string' && value.trim()) {
        out.push(value.trim());
      } else {
        out.push(fallbackTexts[i]);
      }
    }
    return out;
  };

  const parsedObject = parseJsonObjectFromText(rawText);
  if (parsedObject && Array.isArray(parsedObject.translations)) {
    return normalizeResult(parsedObject.translations);
  }

  const normalized = normalizeCodeBlock(rawText);
  if (!normalized) return null;

  // fallback 1: pure JSON array
  try {
    const parsedArray = JSON.parse(normalized);
    const normalizedArray = normalizeResult(parsedArray);
    if (normalizedArray) return normalizedArray;
  } catch (_err) {
    // ignore
  }

  // fallback 2: extract first JSON array segment
  const arrayStart = normalized.indexOf('[');
  const arrayEnd = normalized.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    const maybeArray = normalized.slice(arrayStart, arrayEnd + 1);
    try {
      const extractedArray = JSON.parse(maybeArray);
      const normalizedArray = normalizeResult(extractedArray);
      if (normalizedArray) return normalizedArray;
    } catch (_err) {
      // ignore
    }
  }

  // fallback 3: numbered/bulleted lines
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+\s*[\.\)\:\-]\s*/, ''))
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .map((line) => line.replace(/^["']|["'],?$/g, '').trim())
    .filter(Boolean);

  if (lines.length >= fallbackTexts.length) {
    return normalizeResult(lines);
  }

  return null;
}

async function tryChatCompletions(mode, messages, model, lang, manualContext) {
  const ccMessages = [{ role: 'system', content: getSystemPrompt(mode, lang, manualContext) }];
  for (const msg of messages) {
    if (!msg || (msg.role !== 'user' && msg.role !== 'assistant') || typeof msg.content !== 'string') {
      continue;
    }
    ccMessages.push({ role: msg.role, content: msg.content });
  }

  const resp = await fetch(apiUrl('/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: ccMessages,
      temperature: 0.4,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = data?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`chat/completions error: ${detail}`);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (!answer || typeof answer !== 'string') {
    throw new Error('chat/completions respons kosong.');
  }

  return answer.trim();
}

async function tryChatCompletionsRaw(systemPrompt, userPrompt, model) {
  const resp = await fetch(apiUrl('/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = data?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`chat/completions error: ${detail}`);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (!answer || typeof answer !== 'string') {
    throw new Error('chat/completions respons kosong.');
  }

  return answer.trim();
}

async function callOpenAI(mode, messages, lang, manualContext = '') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY belum terbaca. Isi file .env lalu restart server.');
  }

  const input = [{ role: 'system', content: getSystemPrompt(mode, lang, manualContext) }];
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
    if (PREFER_CHAT_COMPLETIONS) {
      try {
        return await tryChatCompletions(mode, messages, model, lang, manualContext);
      } catch (ccErr) {
        lastError = ccErr;
      }
    }

    const resp = await fetch(apiUrl('/responses'), {
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
        throw fail(401, 'API key OpenAI tidak valid atau salah project.');
      }
      if (resp.status === 429 || code === 'insufficient_quota') {
        throw fail(429, 'Kuota/billing OpenAI habis. Cek usage dan billing project.');
      }
      if (code === 'model_not_found' || (lower.includes('model') && lower.includes('not found'))) {
        lastError = new Error(`Model ${model} tidak tersedia. Mencoba model fallback...`);
        continue;
      }

      // fallback compatibility: sebagian akun/library lebih stabil di endpoint chat/completions
      try {
        return await tryChatCompletions(mode, messages, model, lang, manualContext);
      } catch (ccErr) {
        lastError = new Error(`OpenAI API error: ${detail}. ${ccErr.message}`);
        continue;
      }
    }

    const answer = extractOutputText(data);
    if (!answer) {
      if (PREFER_CHAT_COMPLETIONS) {
        // jika base custom dan responses kosong, balik ke chat/completions
        try {
          return await tryChatCompletions(mode, messages, model, lang, manualContext);
        } catch (ccErr) {
          lastError = new Error(`Respons kosong dari /responses. ${ccErr.message}`);
          continue;
        }
      }
      throw new Error('Respons OpenAI kosong.');
    }

    return answer;
  }

  // fallback terakhir lintas model
  if (PREFER_CHAT_COMPLETIONS) {
    for (const model of models) {
      try {
        return await tryChatCompletions(mode, messages, model, lang, manualContext);
      } catch (ccErr) {
        lastError = ccErr;
      }
    }
  }

  throw lastError || new Error('Gagal memanggil model OpenAI.');
}

async function translateUiTexts(lang, texts) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY belum terbaca. Isi file .env lalu restart server.');
  }

  if (!Array.isArray(texts) || texts.length === 0) return [];

  const targetLanguage =
    lang === 'en'
      ? 'English'
      : lang === 'zh'
      ? 'Simplified Chinese'
      : 'Indonesian';

  const systemPrompt = [
    'You are a professional UI translator.',
    'Translate each source text accurately into the requested target language.',
    'Do not add extra explanations.',
    'Return ONLY strict JSON object: {"translations":["..."]}.',
    'The output array must have exactly the same number and order as the input array.',
  ].join(' ');

  const userPrompt = JSON.stringify({
    task: 'translate_ui_texts',
    target_language: targetLanguage,
    texts,
  });

  const models = [...new Set([OPENAI_MODEL, 'gpt-4o-mini'])];
  let lastError = null;

  for (const model of models) {
    if (PREFER_CHAT_COMPLETIONS) {
      try {
        const fallbackRaw = await tryChatCompletionsRaw(systemPrompt, userPrompt, model);
        const fallbackParsed = parseTranslationsOutput(fallbackRaw, texts);
        if (fallbackParsed) return fallbackParsed;
        lastError = new Error('Format terjemahan tidak valid dari chat/completions.');
      } catch (ccErr) {
        lastError = ccErr;
      }
    }

    const resp = await fetch(apiUrl('/responses'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const code = data?.error?.code || '';
      const detail = data?.error?.message || `HTTP ${resp.status}`;
      const lower = String(detail).toLowerCase();

      if (resp.status === 401 || code === 'invalid_api_key') {
        throw fail(401, 'API key OpenAI tidak valid atau salah project.');
      }
      if (resp.status === 429 || code === 'insufficient_quota') {
        throw fail(429, 'Kuota/billing OpenAI habis. Cek usage dan billing project.');
      }
      if (code === 'model_not_found' || (lower.includes('model') && lower.includes('not found'))) {
        lastError = new Error(`Model ${model} tidak tersedia. Mencoba model fallback...`);
        continue;
      }

      try {
        const fallbackRaw = await tryChatCompletionsRaw(systemPrompt, userPrompt, model);
        const fallbackParsed = parseTranslationsOutput(fallbackRaw, texts);
        if (fallbackParsed) return fallbackParsed;
        lastError = new Error('Format terjemahan tidak valid dari chat/completions.');
        continue;
      } catch (ccErr) {
        lastError = new Error(`OpenAI API error: ${detail}. ${ccErr.message}`);
        continue;
      }
    }

    const rawText = extractOutputText(data);
    const parsed = parseTranslationsOutput(rawText, texts);
    if (parsed) return parsed;
    lastError = new Error('Format output terjemahan tidak valid.');
  }

  throw lastError || new Error('Gagal menerjemahkan teks UI.');
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
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
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

  if (
    req.method === 'GET' &&
    (req.url.startsWith('/health') || req.url.startsWith('/api/health'))
  ) {
    json(res, 200, {
      ok: true,
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL,
      apiKeyConfigured: Boolean(OPENAI_API_KEY),
      date: new Date().toISOString(),
    });
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/api/chat')) {
    try {
      const body = await parseBody(req);
      const mode = body?.mode === 'recipe' ? 'recipe' : 'support';
      const lang = normalizeLang(body?.lang);
      const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
      const manualEntries = retrieveManualEntries(mode, messages);
      const manualContext = buildManualContext(manualEntries, lang);

      let reply = '';
      let aiUsed = false;
      let aiError = '';
      try {
        reply = await callOpenAI(mode, messages, lang, manualContext);
        aiUsed = true;
      } catch (aiErr) {
        aiError = String(aiErr?.message || 'AI unavailable');
        reply = buildManualOnlyReply(mode, lang, manualEntries);
      }

      json(res, 200, {
        reply,
        sources: {
          manualUsed: manualEntries.length > 0,
          manualIds: manualEntries.map((entry) => entry.id),
          aiUsed,
          aiError: aiError || undefined,
        },
      });
    } catch (err) {
      const status = Number(err?.status) || 500;
      json(res, status, { error: err.message || 'Unknown error' });
    }
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/api/translate-ui')) {
    try {
      const body = await parseBody(req);
      const lang = body?.lang === 'en' || body?.lang === 'zh' ? body.lang : 'id';
      const rawTexts = Array.isArray(body?.texts) ? body.texts : [];
      const texts = rawTexts
        .filter((v) => typeof v === 'string')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 1000);

      if (lang === 'id') {
        json(res, 200, { translations: texts });
        return;
      }

      const translations = await translateUiTexts(lang, texts);
      json(res, 200, { translations });
    } catch (err) {
      const status = Number(err?.status) || 500;
      json(res, status, { error: err.message || 'Unknown error' });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  text(res, 405, 'Method Not Allowed');
});

function listLanUrls(port) {
  const out = [];
  const nets = os.networkInterfaces();
  Object.values(nets).forEach((entries) => {
    (entries || []).forEach((net) => {
      if (!net || net.internal) return;
      if (net.family === 'IPv4') {
        out.push(`http://${net.address}:${port}`);
      }
    });
  });
  return [...new Set(out)];
}

server.listen(PORT, HOST, () => {
  console.log(`Midea chat proxy running on http://localhost:${PORT}`);
  const lanUrls = listLanUrls(PORT);
  if (lanUrls.length > 0) {
    console.log(`LAN URL: ${lanUrls[0]}`);
  }
  console.log(`Model default: ${OPENAI_MODEL}`);
  console.log(`Base URL: ${OPENAI_BASE_URL}`);
  console.log(`OpenAI key: ${OPENAI_API_KEY ? 'configured' : 'missing'}`);
  if (!OPENAI_API_KEY) {
    console.log('Tip: buat file .env berisi OPENAI_API_KEY=sk-... lalu restart server.');
  }
  console.log('Tip: untuk LiteLLM, isi OPENAI_BASE_URL=https://.../v1 di file .env.');
});
