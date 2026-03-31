(function () {
  const NAV_VERSION = 'nav-fix-2026-03-31-v26';
  window.MIDEA_NAV_VERSION = NAV_VERSION;

  const wraps = Array.from(document.querySelectorAll('.phone-wrap'));
  if (wraps.length === 0) return;

  function screenIndexBySelector(selector, fallback) {
    const idx = wraps.findIndex((wrap) => wrap.querySelector(selector));
    return idx >= 0 ? idx : fallback;
  }

  const SCREEN = {
    SPLASH: screenIndexBySelector('#screen-splash', 0),
    HOME: screenIndexBySelector('#screen-home', 1),
    CONTROL: screenIndexBySelector('#screen-control', 1),
    ALERTS: screenIndexBySelector('#screen-alerts', -1),
    PANDUAN: screenIndexBySelector('#screen-panduan', 2),
    RECIPE: screenIndexBySelector('#screen-resep, [data-screen="recipe"]', 1),
    TANYA: screenIndexBySelector('#screen-tanya', 3),
  };
  SCREEN.VIDEO_GALLERY = screenIndexBySelector('#screen-video-gallery, [data-screen="video-gallery"]', -1);

  const CHAPTER_SCREENS = wraps
    .map((wrap, idx) => (wrap.querySelector('.chapter-progress-bar') ? idx : -1))
    .filter((idx) => idx >= 0);

  function safeUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    try {
      return new URL(value, window.location.href).href;
    } catch (_err) {
      return '';
    }
  }

  function withDefaultScheme(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(value) || value.startsWith('/')) return value;
    if (/^[\w.-]+\.[a-z]{2,}/i.test(value)) return `https://${value}`;
    return value;
  }

  function normalizeOriginUrl(raw) {
    const url = withDefaultScheme(raw).replace(/\/+$/, '');
    return safeUrl(url);
  }

  function isPlaceholderUrl(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return true;
    if (/(nama-backend|your-backend|contoh-backend|example\.com|placeholder)/i.test(value)) return true;
    if (/[<{][^>}]*(backend|onrender|url)[^>}]?[>}]/i.test(value)) return true;
    return false;
  }

  function normalizeChatApiUrl(raw) {
    let url = withDefaultScheme(raw);
    if (!url) return '';
    url = url.replace(/\/+$/, '');

    if (/\/api\/translate-ui$/i.test(url)) {
      url = url.replace(/\/api\/translate-ui$/i, '/api/chat');
    } else if (/\/v1$/i.test(url)) {
      url = `${url}/chat/completions`;
    } else if (/^https?:\/\/[^/]+$/i.test(url)) {
      url = `${url}/api/chat`;
    }

    return safeUrl(url);
  }

  function deriveTranslateApiFromChat(chatUrl) {
    const url = String(chatUrl || '').trim();
    if (!url) return '';
    if (/\/api\/chat\/?$/i.test(url)) {
      return url.replace(/\/api\/chat\/?$/i, '/api/translate-ui');
    }
    return '';
  }

  function uniqueUrls(values) {
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
      const normalized = String(value || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      out.push(normalized);
    });
    return out;
  }

  function readBackendHints() {
    const params = new URLSearchParams(window.location.search || '');
    const queryBackend = params.get('backend') || '';
    const queryChatApi = params.get('chat_api') || '';

    if (queryBackend) {
      try {
        localStorage.setItem('midea_backend_origin', queryBackend);
      } catch (_err) {}
    }
    if (queryChatApi) {
      try {
        localStorage.setItem('midea_chat_api_url', queryChatApi);
      } catch (_err) {}
    }

    let storedBackend = '';
    let storedChatApi = '';
    try {
      storedBackend = localStorage.getItem('midea_backend_origin') || '';
      storedChatApi = localStorage.getItem('midea_chat_api_url') || '';
    } catch (_err) {}

    return { queryBackend, queryChatApi, storedBackend, storedChatApi };
  }

  const backendHints = readBackendHints();

  function buildBackendOriginCandidates() {
    const hints = [
      window.MIDEA_BACKEND_ORIGIN || '',
      backendHints.queryBackend,
      backendHints.storedBackend,
      'https://midea-chat-proxy.onrender.com',
    ];
    return uniqueUrls(
      hints
        .filter((hint) => !isPlaceholderUrl(hint))
        .map(normalizeOriginUrl)
        .filter(Boolean)
    );
  }

  function buildChatApiCandidates() {
    const directHints = [
      window.MIDEA_CHAT_API_URL || '',
      backendHints.queryChatApi,
      backendHints.storedChatApi,
    ];

    const byOrigin = buildBackendOriginCandidates().map((origin) => `${origin}/api/chat`);
    const sameOrigin = ['/api/chat'];

    return uniqueUrls([...directHints, ...byOrigin, ...sameOrigin].map(normalizeChatApiUrl).filter(Boolean));
  }

  function buildTranslateApiCandidates(chatCandidates) {
    const fromChat = (chatCandidates || []).map(deriveTranslateApiFromChat).filter(Boolean);
    const directHints = [window.MIDEA_TRANSLATE_API_URL || '', '/api/translate-ui'];
    return uniqueUrls([...directHints, ...fromChat].map(safeUrl).filter(Boolean));
  }

  const CHAT_API_CANDIDATES = buildChatApiCandidates();
  const TRANSLATE_API_CANDIDATES = buildTranslateApiCandidates(CHAT_API_CANDIDATES);

  const apiRuntime = {
    preferredChatUrl: '',
    preferredTranslateUrl: '',
    lastChatError: '',
    lastTranslateError: '',
  };

  async function fetchWithTimeout(url, options = {}, timeoutMs = 16000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  }

  function parseOpenAICompatibleReply(data) {
    if (!data || typeof data !== 'object') return '';

    const ccContent = data?.choices?.[0]?.message?.content;
    if (typeof ccContent === 'string' && ccContent.trim()) return ccContent.trim();
    if (Array.isArray(ccContent)) {
      const joined = ccContent
        .map((part) => {
          if (typeof part === 'string') return part;
          if (part && typeof part.text === 'string') return part.text;
          return '';
        })
        .join(' ')
        .trim();
      if (joined) return joined;
    }

    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim();
    }

    if (Array.isArray(data.output)) {
      const chunks = [];
      data.output.forEach((item) => {
        if (!item) return;
        if (Array.isArray(item.content)) {
          item.content.forEach((part) => {
            if (typeof part?.text === 'string') chunks.push(part.text);
            else if (typeof part?.output_text === 'string') chunks.push(part.output_text);
          });
        } else if (typeof item.content === 'string') {
          chunks.push(item.content);
        }
      });
      const merged = chunks.join('\n').trim();
      if (merged) return merged;
    }

    return '';
  }

  function orderedCandidates(type) {
    const preferred = type === 'chat' ? apiRuntime.preferredChatUrl : apiRuntime.preferredTranslateUrl;
    const pool = type === 'chat' ? CHAT_API_CANDIDATES : TRANSLATE_API_CANDIDATES;
    if (!preferred) return pool.slice();
    return uniqueUrls([preferred, ...pool]);
  }

  async function postJsonWithFallback(type, payload) {
    const endpoints = orderedCandidates(type);
    const errors = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let data = null;
        let raw = '';
        try {
          data = await response.json();
        } catch (_err) {
          raw = await response.text().catch(() => '');
        }

        if (!response.ok) {
          const errMsg =
            (data && typeof data.error === 'string' && data.error) ||
            (data && typeof data?.error?.message === 'string' && data.error.message) ||
            (raw && raw.trim()) ||
            `HTTP ${response.status}`;
          throw new Error(errMsg);
        }

        if (type === 'chat') {
          const replyFromProxy = data && typeof data.reply === 'string' ? data.reply.trim() : '';
          const replyFromDirect = parseOpenAICompatibleReply(data);
          const reply = replyFromProxy || replyFromDirect;
          if (!reply) throw new Error('Format respons chat tidak valid.');
          apiRuntime.preferredChatUrl = endpoint;
          apiRuntime.lastChatError = '';
          return { reply, raw: data || null, endpoint };
        }

        const translations =
          data && Array.isArray(data.translations)
            ? data.translations.map((v) => (typeof v === 'string' ? v : ''))
            : null;
        if (!translations) throw new Error('Format respons translate tidak valid.');
        apiRuntime.preferredTranslateUrl = endpoint;
        apiRuntime.lastTranslateError = '';
        return { translations, raw: data || null, endpoint };
      } catch (error) {
        const short = String(error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 120);
        errors.push(`${endpoint} -> ${short}`);
      }
    }

    const summary = errors[0] || 'Tidak ada endpoint tersedia.';
    if (type === 'chat') apiRuntime.lastChatError = summary;
    else apiRuntime.lastTranslateError = summary;
    throw new Error(summary);
  }

  window.mideaApiStatus = function () {
    return {
      navVersion: NAV_VERSION,
      chatCandidates: CHAT_API_CANDIDATES,
      translateCandidates: TRANSLATE_API_CANDIDATES,
      preferredChatUrl: apiRuntime.preferredChatUrl,
      preferredTranslateUrl: apiRuntime.preferredTranslateUrl,
      lastChatError: apiRuntime.lastChatError,
      lastTranslateError: apiRuntime.lastTranslateError,
    };
  };

  const SUPPORTED_LANGS = ['id', 'en', 'zh'];

  const UI_TEXT = {
    id: {
      toastChatErrorPrefix: 'ChatGPT gagal',
      toastTranslateErrorPrefix: 'Terjemahan gagal',
      toastBookmark: 'Bab ditandai (bookmark).',
      toastBackChapter: 'Kembali ke bab sebelumnya.',
      toastBackToToc: 'Kembali ke daftar isi.',
      toastVideoNotAvailable: 'Video belum tersedia.',
      toastControlOn: 'Kontrol diaktifkan.',
      toastControlOff: 'Kontrol dimatikan.',
      toastControlPowerRequired: 'Nyalakan kontrol terlebih dahulu.',
      toastControlStopped: 'Proses memasak dihentikan.',
      toastControlModeActive: 'Mode {mode} aktif.',
      toastVideoGalleryRefreshed: 'Galeri video diperbarui.',
      toastVideoLoadError: 'Video gagal dimuat. Cek izin akses file Google Drive.',
      controlPause: '⏸ Jeda',
      controlResume: '▶ Lanjut',
      chapterNext: 'Bab Selanjutnya',
      chapterPrevious: 'Bab Sebelumnya',
      chapterToc: 'Daftar Isi',
      videoTitleDefault: 'Video Panduan',
      videoCountUnit: 'video',
      profileTitle: 'Profil Saya',
      profileSummary: 'Ringkasan akun aplikasi Midea',
      profileMember: 'Member Midea',
      profileChatHistory: 'Riwayat Chat Bantuan',
      profileRegisteredProducts: 'Produk Terdaftar',
      profileLanguageSettings: 'Pengaturan Bahasa',
      videoPlayNow: '▶ Putar Sekarang',
      gallerySearchPlaceholder: 'Cari video (contoh: panduan, bahan, pressure cooker)...',
      galleryEmpty: 'Video tidak ditemukan. Coba kata kunci lain.',
      fallbackRecipeAirfryer:
        'Coba: ayam fillet 180°C 16-18 menit, marinasi bawang putih, garam, lada, sedikit minyak. Balik di menit ke-9.',
      fallbackRecipeGeneral:
        'Saya bisa bantu resep sesuai alat Midea Anda. Sebutkan alat, bahan utama, dan target waktu masak.',
      fallbackWarranty:
        'Untuk klaim garansi, siapkan nomor model, serial number, dan bukti pembelian.',
      fallbackService:
        'Silakan kirim kota Anda. Saya akan bantu arahkan ke service center resmi terdekat.',
      fallbackGeneric:
        'Pesan diterima. Jika API ChatGPT belum aktif, jawaban sekarang memakai mode fallback lokal.',
    },
    en: {
      toastChatErrorPrefix: 'ChatGPT failed',
      toastTranslateErrorPrefix: 'Translation failed',
      toastBookmark: 'Chapter bookmarked.',
      toastBackChapter: 'Returned to previous chapter.',
      toastBackToToc: 'Back to table of contents.',
      toastVideoNotAvailable: 'Video is not available yet.',
      toastControlOn: 'Control enabled.',
      toastControlOff: 'Control turned off.',
      toastControlPowerRequired: 'Turn on control first.',
      toastControlStopped: 'Cooking process stopped.',
      toastControlModeActive: 'Mode {mode} is active.',
      toastVideoGalleryRefreshed: 'Video gallery refreshed.',
      toastVideoLoadError: 'Video failed to load. Check Google Drive file access.',
      controlPause: '⏸ Pause',
      controlResume: '▶ Resume',
      chapterNext: 'Next Chapter',
      chapterPrevious: 'Previous Chapter',
      chapterToc: 'Table of Contents',
      videoTitleDefault: 'Guide Video',
      videoCountUnit: 'videos',
      profileTitle: 'My Profile',
      profileSummary: 'Midea app account summary',
      profileMember: 'Midea Member',
      profileChatHistory: 'Support Chat History',
      profileRegisteredProducts: 'Registered Products',
      profileLanguageSettings: 'Language Settings',
      videoPlayNow: '▶ Play Now',
      gallerySearchPlaceholder: 'Search videos (example: guide, ingredients, pressure cooker)...',
      galleryEmpty: 'No videos found. Try another keyword.',
      fallbackRecipeAirfryer:
        'Try this: chicken fillet at 180°C for 16-18 minutes. Marinate with garlic, salt, pepper, and a little oil. Flip at minute 9.',
      fallbackRecipeGeneral:
        'I can suggest recipes based on your Midea appliance. Tell me the appliance, main ingredients, and desired cooking time.',
      fallbackWarranty:
        'For warranty claims, prepare model number, serial number, and proof of purchase.',
      fallbackService:
        'Please share your city. I will direct you to the nearest official service center.',
      fallbackGeneric:
        'Message received. If ChatGPT API is not active yet, this answer uses local fallback mode.',
    },
    zh: {
      toastChatErrorPrefix: 'ChatGPT 连接失败',
      toastTranslateErrorPrefix: '翻译失败',
      toastBookmark: '章节已收藏。',
      toastBackChapter: '已返回上一章节。',
      toastBackToToc: '已返回目录。',
      toastVideoNotAvailable: '视频暂不可用。',
      toastControlOn: '控制已开启。',
      toastControlOff: '控制已关闭。',
      toastControlPowerRequired: '请先开启控制。',
      toastControlStopped: '烹饪流程已停止。',
      toastControlModeActive: '模式 {mode} 已启用。',
      toastVideoGalleryRefreshed: '视频库已刷新。',
      toastVideoLoadError: '视频加载失败，请检查 Google Drive 文件访问权限。',
      controlPause: '⏸ 暂停',
      controlResume: '▶ 继续',
      chapterNext: '下一章',
      chapterPrevious: '上一章',
      chapterToc: '目录',
      videoTitleDefault: '指南视频',
      videoCountUnit: '个视频',
      profileTitle: '我的资料',
      profileSummary: 'Midea 应用账号概览',
      profileMember: '美的会员',
      profileChatHistory: '客服聊天记录',
      profileRegisteredProducts: '已注册产品',
      profileLanguageSettings: '语言设置',
      videoPlayNow: '▶ 立即播放',
      gallerySearchPlaceholder: '搜索视频（例如：教程、食材、压力锅）...',
      galleryEmpty: '未找到视频，请尝试其他关键词。',
      fallbackRecipeAirfryer:
        '可尝试：鸡胸肉 180°C 烤 16-18 分钟，蒜末+盐+胡椒+少量油腌制，第 9 分钟翻面。',
      fallbackRecipeGeneral: '我可以根据您的美的设备推荐食谱，请提供设备、主要食材和目标烹饪时间。',
      fallbackWarranty: '如需保修，请准备型号、序列号和购买凭证。',
      fallbackService: '请提供您所在城市，我会推荐最近的官方服务中心。',
      fallbackGeneric: '消息已收到。如果 ChatGPT API 未启用，当前回答使用本地兜底模式。',
    },
  };

  const CHAT_MODES = {
    support: {
      title: { id: 'Tanya Kami', en: 'Ask Us', zh: '联系我们' },
      subtitle: {
        id: 'Tim kami siap membantu Anda 24/7',
        en: 'Our team is ready to help 24/7',
        zh: '我们的团队 24/7 为您服务',
      },
      sender: { id: 'Midea Support', en: 'Midea Support', zh: 'Midea 客服' },
      placeholder: {
        id: 'Ketik pertanyaan produk/servis Anda...',
        en: 'Type your product/service question...',
        zh: '请输入您的产品/售后问题...',
      },
      quick: {
        id: ['Garansi Produk', 'Service Center', 'Cara Penggunaan'],
        en: ['Warranty', 'Service Center', 'How to Use'],
        zh: ['保修服务', '服务中心', '使用方法'],
      },
      welcome: {
        id: 'Halo! Saya asisten Midea. Silakan tanya seputar produk, garansi, troubleshooting, atau service center.',
        en: 'Hi! I am your Midea assistant. Ask me about products, warranty, troubleshooting, or service centers.',
        zh: '您好！我是 Midea 助手。您可以咨询产品、保修、故障排查或服务中心。',
      },
    },
    recipe: {
      title: { id: 'Rekomendasi Resep', en: 'Recipe Recommendations', zh: '食谱推荐' },
      subtitle: {
        id: 'Asisten resep cerdas untuk produk Midea',
        en: 'Smart recipe assistant for Midea products',
        zh: '适用于 Midea 产品的智能食谱助手',
      },
      sender: { id: 'Midea Recipe AI', en: 'Midea Recipe AI', zh: 'Midea 食谱 AI' },
      placeholder: {
        id: 'Contoh: Resep ayam untuk air fryer 20 menit',
        en: 'Example: Chicken recipe for air fryer in 20 minutes',
        zh: '示例：空气炸锅鸡肉食谱 20 分钟',
      },
      quick: {
        id: ['Resep Air Fryer', 'Menu Rice Cooker', 'Resep Rendah Kalori'],
        en: ['Air Fryer Recipes', 'Rice Cooker Menu', 'Low-Calorie Recipes'],
        zh: ['空气炸锅食谱', '电饭煲菜单', '低卡食谱'],
      },
      welcome: {
        id: 'Halo! Saya siap rekomendasikan resep berdasarkan alat Midea, bahan yang Anda punya, dan waktu memasak.',
        en: 'Hi! I can recommend recipes based on your Midea appliance, available ingredients, and cooking time.',
        zh: '您好！我可以根据您的 Midea 设备、现有食材和烹饪时间为您推荐食谱。',
      },
    },
  };

  const VIDEO_LIBRARY = [
    {
      src: 'https://drive.google.com/file/d/1TegbaF6pyWUHdCVCbfDF_ZbE_098uzk1/view?usp=sharing',
      thumb: 'https://drive.google.com/thumbnail?id=1TegbaF6pyWUHdCVCbfDF_ZbE_098uzk1&sz=w1000',
      title: {
        id: 'Video Panduan Utama',
        en: 'Main Guide Video',
        zh: '主教程视频',
      },
      description: {
        id: 'Penjelasan lengkap penggunaan pressure cooker MY-CS5039P.',
        en: 'Complete walkthrough for using pressure cooker MY-CS5039P.',
        zh: 'MY-CS5039P 压力锅完整使用讲解。',
      },
      tags: ['panduan', 'guide', 'pressure cooker', 'my-cs5039p', 'tutorial'],
    },
    {
      src: 'https://drive.google.com/file/d/1OSTIefrJqebpTeNW5HqWoYljk_ckdPjG/view?usp=sharing',
      thumb: 'https://drive.google.com/thumbnail?id=1OSTIefrJqebpTeNW5HqWoYljk_ckdPjG&sz=w1000',
      title: {
        id: 'Video Persiapan Bahan',
        en: 'Ingredient Preparation Video',
        zh: '食材准备视频',
      },
      description: {
        id: 'Tutorial menyiapkan bahan agar hasil masak lebih konsisten.',
        en: 'How to prepare ingredients for more consistent cooking results.',
        zh: '食材预处理教程，让烹饪结果更稳定。',
      },
      tags: ['bahan', 'ingredients', 'prep', 'tutorial', 'midea'],
    },
  ];

  const STATIC_TEXT_MAP = {
    en: {
      'Pilihan Bahasa': 'Language',
      'Silakan pilih bahasa yang Anda inginkan': 'Please choose your preferred language',
      'Bahasa Indonesia': 'Indonesian',
      'Lanjutkan →': 'Continue →',
      'Selamat Datang': 'Welcome',
      'Ada yang bisa kami\nbantu hari ini?': 'How can we\nhelp you today?',
      'Ada yang bisa kami bantu hari ini?': 'How can we help you today?',
      'Menu Utama': 'Main Menu',
      'Buku Panduan': 'User Manual',
      'Panduan lengkap penggunaan & perawatan produk Midea':
        'Complete usage and maintenance guide for Midea products',
      'Tanya Kami': 'Ask Us',
      'Chat langsung dengan tim support Midea': 'Chat directly with Midea support team',
      'Rekomendasi Resep': 'Recipe Recommendations',
      'Resep spesial untuk produk masak Midea': 'Special recipes for Midea cooking products',
      'Video Panduan': 'Guide Videos',
      'Buka Galeri Video Lengkap': 'Open Full Video Gallery',
      'Galeri Video': 'Video Gallery',
      'Tutorial visual untuk penggunaan produk Midea': 'Visual tutorials for using Midea products',
      'Daftar Video': 'Video List',
      'Video Panduan Utama': 'Main Guide Video',
      'Penjelasan lengkap penggunaan pressure cooker MY-CS5039P.':
        'Complete walkthrough for using pressure cooker MY-CS5039P.',
      'Video Persiapan Bahan': 'Ingredient Preparation Video',
      'Tutorial menyiapkan bahan agar hasil masak lebih konsisten.':
        'How to prepare ingredients for more consistent cooking results.',
      'Layar 13 · Rekomendasi Resep': 'Screen 13 · Recipe Recommendations',
      'Layar 14 · Galeri Video': 'Screen 14 · Video Gallery',
      'Info Produk Terkini': 'Latest Product Info',
      'AC Inverter Series Terbaru': 'Latest Inverter AC Series',
      'Hemat energi hingga 70% lebih efisien': 'Save energy up to 70%',
      Beranda: 'Home',
      Cari: 'Search',
      Bantuan: 'Help',
      Profil: 'Profile',
      Kembali: 'Back',
      'Daftar Isi': 'Table of Contents',
      'Selesai Membaca': 'Finish Reading',
      'Kembali ke Daftar Isi ↩': 'Back to Table of Contents ↩',
      'Bab Selanjutnya': 'Next Chapter',
      'Keselamatan Penting': 'Important Safety',
      'Spesifikasi & Struktur Produk': 'Specifications & Product Structure',
      'Panel Kontrol & Status Pemasak': 'Control Panel & Cooking Status',
      'Persiapan Sebelum Penggunaan Pertama': 'Preparation Before First Use',
      'Cara Memasak dengan Pressure Cooker': 'How to Cook with a Pressure Cooker',
      'Cara Membuka Tutup dengan Aman': 'How to Open the Lid Safely',
      'Perawatan & Pembersihan': 'Care & Cleaning',
      'Pemecahan Masalah & Kode Error': 'Troubleshooting & Error Codes',
      'Butuh Bantuan Lebih Lanjut?': 'Need More Help?',
      'Hubungi Service Center resmi Midea atau gunakan fitur Tanya Kami di aplikasi ini.':
        'Contact an official Midea Service Center or use the Ask Us feature in this app.',
      'Layar 1 · Pilihan Bahasa': 'Screen 1 · Language Selection',
      'Layar 2 · Menu Utama': 'Screen 2 · Main Menu',
      'Layar 3 · Buku Panduan MY-CS5039P': 'Screen 3 · Manual MY-CS5039P',
      'Layar 4 · Tanya Kami': 'Screen 4 · Ask Us',
      'Layar 5 · Detail Bab 1 — Keselamatan Penting': 'Screen 5 · Chapter 1 Detail — Important Safety',
      'Layar 6 · Detail Bab 2 — Spesifikasi & Struktur':
        'Screen 6 · Chapter 2 Detail — Specs & Structure',
      'Layar 7 · Detail Bab 3 — Panel Kontrol': 'Screen 7 · Chapter 3 Detail — Control Panel',
      'Layar 8 · Detail Bab 4 — Persiapan Pertama':
        'Screen 8 · Chapter 4 Detail — First Preparation',
      'Layar 9 · Detail Bab 5 — Cara Memasak': 'Screen 9 · Chapter 5 Detail — Cooking Guide',
      'Layar 10 · Detail Bab 6 — Membuka Tutup': 'Screen 10 · Chapter 6 Detail — Lid Opening',
      'Layar 11 · Detail Bab 7 — Perawatan & Pembersihan':
        'Screen 11 · Chapter 7 Detail — Care & Cleaning',
      'Layar 12 · Detail Bab 8 — Pemecahan Masalah':
        'Screen 12 · Chapter 8 Detail — Troubleshooting',
      'Masak apa kita': 'What shall we cook',
      'hari ini? 🍳': 'today? 🍳',
      '✨ Resep Hari Ini': '✨ Recipe of the Day',
      'Pressure Cooker · 35 menit': 'Pressure Cooker · 35 min',
      Coba: 'Try',
      LIVE: 'LIVE',
      'Kontrol Jarak Jauh': 'Remote Control',
      'Mode & timer': 'Mode & timer',
      Panduan: 'Guide',
      'Buku & video panduan': 'Manual & video guides',
      BARU: 'NEW',
      '5 video tutorial': '5 tutorial videos',
      'Tanya Teknisi': 'Ask Technician',
      'AI Chatbot 24 jam': '24-hour AI chatbot',
      'Terhubung · Siap Digunakan': 'Connected · Ready to Use',
      Kontrol: 'Control',
      Resep: 'Recipes',
      'Layar 2B · Kontrol Jarak Jauh': 'Screen 2B · Remote Control',
      'Terhubung · Aktif': 'Connected · Active',
      Suhu: 'Temperature',
      Tekanan: 'Pressure',
      'Waktu Sisa': 'Time Left',
      mnt: 'min',
      '⏱ Aktif': '⏱ Active',
      'Mode Memasak': 'Cooking Mode',
      'Atur Timer': 'Set Timer',
      menit: 'minutes',
      'Katup uap normal · Tekanan stabil': 'Steam valve normal · Pressure stable',
      'Jangan buka tutup saat bertekanan': 'Do not open lid while pressurized',
      '⏹ Hentikan Memasak': '⏹ Stop Cooking',
      'Layar 2C · Notifikasi & Safety Alert': 'Screen 2C · Notifications & Safety Alert',
      'Notifikasi & Alert': 'Notifications & Alerts',
      'Riwayat pesan perangkat': 'Device message history',
      'Hari ini · 10:32': 'Today · 10:32',
      Penting: 'Important',
      'Memasak Dimulai': 'Cooking Started',
      'Hari ini · 10:05': 'Today · 10:05',
      'Mode Meat/Chicken aktif. Estimasi selesai pukul 10:45.':
        'Meat/Chicken mode is active. Estimated completion at 10:45.',
      '✅ Masakan Selesai': '✅ Cooking Finished',
      'Kemarin · 19:22': 'Yesterday · 19:22',
      'Rendang Daging selesai dimasak. Keep Warm aktif selama 2 jam.':
        'Beef rendang is finished. Keep Warm stayed active for 2 hours.',
      'Pengingat Perawatan': 'Maintenance Reminder',
      '2 hari lalu · 08:00': '2 days ago · 08:00',
      'Bersihkan sealing ring setelah 10x pemakaian.': 'Clean the sealing ring after 10 uses.',
      'Layar 3 · Panduan MY-CS5039P': 'Screen 3 · Guide MY-CS5039P',
      'Pressure Cooker · Model MY-CS5039P': 'Pressure Cooker · Model MY-CS5039P',
      Volume: 'Volume',
      Hangat: 'Warm',
      'Jangan buka tutup sebelum tekanan benar-benar habis. Uap panas dapat menyebabkan luka bakar serius.':
        'Do not open the lid before pressure is fully released. Hot steam can cause serious burns.',
      'Jenis Panduan': 'Guide Type',
      '📖 Buku Panduan': '📖 User Manual',
      'Daftar isi 8 bab': '8-chapter table of contents',
      '▶ Video Panduan': '▶ Guide Videos',
      'Buka layar video': 'Open video screen',
      'Tim kami siap membantu Anda 24/7': 'Our team is ready to help 24/7',
      'Halo! 👋 Selamat datang di layanan Tanya Kami Midea. Saya siap membantu Anda. Ada yang bisa kami bantu hari ini?':
        'Hello! 👋 Welcome to Midea Ask Us service. I am ready to help. How can we assist you today?',
      'Garansi Produk': 'Product Warranty',
      'Cara Penggunaan': 'How to Use',
      'Tidak puas dengan jawaban ini?': 'Not satisfied with this answer?',
      'Tanya CS': 'Ask Customer Service',
      'BAB 1': 'CHAPTER 1',
      'BAB 2': 'CHAPTER 2',
      'BAB 3': 'CHAPTER 3',
      'BAB 4': 'CHAPTER 4',
      'BAB 5': 'CHAPTER 5',
      'BAB 6': 'CHAPTER 6',
      'BAB 7': 'CHAPTER 7',
      'BAB 8': 'CHAPTER 8',
      '1 dari 8 bab': '1 of 8 chapters',
      '2 dari 8 bab': '2 of 8 chapters',
      '3 dari 8 bab': '3 of 8 chapters',
      '4 dari 8 bab': '4 of 8 chapters',
      '5 dari 8 bab': '5 of 8 chapters',
      '6 dari 8 bab': '6 of 8 chapters',
      '7 dari 8 bab': '7 of 8 chapters',
      '8 dari 8 bab': '8 of 8 chapters',
      Keselamatan: 'Safety',
      '⚠ Peringatan Umum': '⚠ General Warning',
      '🔥 Peringatan Uap Panas': '🔥 Hot Steam Warning',
      '⚡ Peringatan Listrik': '⚡ Electrical Warning',
      'Bab Sebelumnya': 'Previous Chapter',
      'Spesifikasi &': 'Specifications &',
      'Struktur Produk': 'Product Structure',
      '📋 Spesifikasi Teknis': '📋 Technical Specifications',
      Model: 'Model',
      Tegangan: 'Voltage',
      Daya: 'Power',
      'Volume Panci': 'Pot Capacity',
      'Diameter Panci': 'Pot Diameter',
      'Tekanan Kerja': 'Working Pressure',
      'Suhu Keep Warm': 'Keep Warm Temperature',
      '🔩 Komponen Utama': '🔩 Main Components',
      'Katup Uap (Steam Vent)': 'Steam Valve (Steam Vent)',
      'Melepaskan uap tekanan saat memasak selesai atau ditekan manual':
        'Releases pressure steam after cooking or when manually pressed',
      'Indikator tekanan — terangkat saat bertekanan, turun saat aman dibuka':
        'Pressure indicator - rises under pressure, drops when safe to open',
      'Cincin karet untuk memastikan tutup kedap tekanan saat memasak':
        'Rubber ring to keep the lid pressure-sealed while cooking',
      'Pelindung pipa uap agar tidak tersumbat sisa makanan':
        'Protects the steam pipe from food residue blockage',
      'Layar LED + 6 tombol operasi + 5 tombol fungsi cepat':
        'LED screen + 6 operation buttons + 5 quick-function buttons',
      '🎁 Aksesori Bawaan': '🎁 Included Accessories',
      'Sendok Nasi': 'Rice Paddle',
      'Sendok Sup': 'Soup Spoon',
      'Gelas Takar': 'Measuring Cup',
      'Pengumpul Kondensasi': 'Condensation Collector',
    },
    zh: {
      'Pilihan Bahasa': '语言选择',
      'Silakan pilih bahasa yang Anda inginkan': '请选择您偏好的语言',
      'Bahasa Indonesia': '印尼语',
      'Lanjutkan →': '继续 →',
      'Selamat Datang': '欢迎',
      'Ada yang bisa kami bantu hari ini?': '今天我们可以为您做什么？',
      'Menu Utama': '主菜单',
      'Buku Panduan': '使用手册',
      'Panduan lengkap penggunaan & perawatan produk Midea': '美的产品使用与保养完整指南',
      'Tanya Kami': '联系我们',
      'Chat langsung dengan tim support Midea': '与美的客服团队在线聊天',
      'Rekomendasi Resep': '食谱推荐',
      'Resep spesial untuk produk masak Midea': '适用于美的烹饪产品的精选食谱',
      'Video Panduan': '视频教程',
      'Buka Galeri Video Lengkap': '打开完整视频库',
      'Galeri Video': '视频库',
      'Tutorial visual untuk penggunaan produk Midea': '美的产品使用可视化教程',
      'Daftar Video': '视频列表',
      'Video Panduan Utama': '主教程视频',
      'Penjelasan lengkap penggunaan pressure cooker MY-CS5039P.': 'MY-CS5039P 压力锅完整使用讲解。',
      'Video Persiapan Bahan': '食材准备视频',
      'Tutorial menyiapkan bahan agar hasil masak lebih konsisten.': '食材预处理教程，让烹饪结果更稳定。',
      'Layar 13 · Rekomendasi Resep': '第 13 屏 · 食谱推荐',
      'Layar 14 · Galeri Video': '第 14 屏 · 视频库',
      'Info Produk Terkini': '最新产品信息',
      'AC Inverter Series Terbaru': '最新变频空调系列',
      'Hemat energi hingga 70% lebih efisien': '最高可节能 70%',
      Beranda: '首页',
      Cari: '搜索',
      Bantuan: '帮助',
      Profil: '个人资料',
      Kembali: '返回',
      'Daftar Isi': '目录',
      'Selesai Membaca': '完成阅读',
      'Kembali ke Daftar Isi ↩': '返回目录 ↩',
      'Bab Selanjutnya': '下一章',
      'Keselamatan Penting': '重要安全须知',
      'Spesifikasi & Struktur Produk': '规格与产品结构',
      'Panel Kontrol & Status Pemasak': '控制面板与烹饪状态',
      'Persiapan Sebelum Penggunaan Pertama': '首次使用前准备',
      'Cara Memasak dengan Pressure Cooker': '压力锅烹饪方法',
      'Cara Membuka Tutup dengan Aman': '安全开盖方法',
      'Perawatan & Pembersihan': '保养与清洁',
      'Pemecahan Masalah & Kode Error': '故障排查与错误代码',
      'Butuh Bantuan Lebih Lanjut?': '需要更多帮助？',
      'Hubungi Service Center resmi Midea atau gunakan fitur Tanya Kami di aplikasi ini.':
        '请联系美的官方服务中心，或使用本应用中的“联系我们”功能。',
      'Layar 1 · Pilihan Bahasa': '第 1 屏 · 语言选择',
      'Layar 2 · Menu Utama': '第 2 屏 · 主菜单',
      'Layar 3 · Buku Panduan MY-CS5039P': '第 3 屏 · MY-CS5039P 手册',
      'Layar 4 · Tanya Kami': '第 4 屏 · 联系我们',
      'Layar 5 · Detail Bab 1 — Keselamatan Penting': '第 5 屏 · 第 1 章详情 — 重要安全须知',
      'Layar 6 · Detail Bab 2 — Spesifikasi & Struktur': '第 6 屏 · 第 2 章详情 — 规格与结构',
      'Layar 7 · Detail Bab 3 — Panel Kontrol': '第 7 屏 · 第 3 章详情 — 控制面板',
      'Layar 8 · Detail Bab 4 — Persiapan Pertama': '第 8 屏 · 第 4 章详情 — 首次准备',
      'Layar 9 · Detail Bab 5 — Cara Memasak': '第 9 屏 · 第 5 章详情 — 烹饪方法',
      'Layar 10 · Detail Bab 6 — Membuka Tutup': '第 10 屏 · 第 6 章详情 — 开盖方法',
      'Layar 11 · Detail Bab 7 — Perawatan & Pembersihan': '第 11 屏 · 第 7 章详情 — 保养与清洁',
      'Layar 12 · Detail Bab 8 — Pemecahan Masalah': '第 12 屏 · 第 8 章详情 — 故障排查',
      'Masak apa kita': '今天我们做什么',
      'hari ini? 🍳': '呢？🍳',
      '✨ Resep Hari Ini': '✨ 今日食谱',
      'Pressure Cooker · 35 menit': '压力锅 · 35 分钟',
      Coba: '试试',
      LIVE: '直播',
      'Kontrol Jarak Jauh': '远程控制',
      'Mode & timer': '模式与定时',
      Panduan: '指南',
      'Buku & video panduan': '手册与视频教程',
      BARU: '新',
      '5 video tutorial': '5 个教学视频',
      'Tanya Teknisi': '咨询技术员',
      'AI Chatbot 24 jam': '24 小时 AI 聊天助手',
      'Terhubung · Siap Digunakan': '已连接 · 可立即使用',
      Kontrol: '控制',
      Resep: '食谱',
      'Layar 2B · Kontrol Jarak Jauh': '第 2B 屏 · 远程控制',
      'Terhubung · Aktif': '已连接 · 运行中',
      Suhu: '温度',
      Tekanan: '压力',
      'Waktu Sisa': '剩余时间',
      mnt: '分钟',
      '⏱ Aktif': '⏱ 运行中',
      'Mode Memasak': '烹饪模式',
      'Atur Timer': '设置定时',
      menit: '分钟',
      'Katup uap normal · Tekanan stabil': '蒸汽阀正常 · 压力稳定',
      'Jangan buka tutup saat bertekanan': '有压力时请勿开盖',
      '⏹ Hentikan Memasak': '⏹ 停止烹饪',
      'Layar 2C · Notifikasi & Safety Alert': '第 2C 屏 · 通知与安全提醒',
      'Notifikasi & Alert': '通知与提醒',
      'Riwayat pesan perangkat': '设备消息记录',
      'Hari ini · 10:32': '今天 · 10:32',
      Penting: '重要',
      'Memasak Dimulai': '开始烹饪',
      'Hari ini · 10:05': '今天 · 10:05',
      'Mode Meat/Chicken aktif. Estimasi selesai pukul 10:45.': 'Meat/Chicken 模式已启动，预计 10:45 完成。',
      '✅ Masakan Selesai': '✅ 烹饪完成',
      'Kemarin · 19:22': '昨天 · 19:22',
      'Rendang Daging selesai dimasak. Keep Warm aktif selama 2 jam.': '牛肉仁当已完成，保温模式持续 2 小时。',
      'Pengingat Perawatan': '维护提醒',
      '2 hari lalu · 08:00': '2 天前 · 08:00',
      'Bersihkan sealing ring setelah 10x pemakaian.': '使用 10 次后请清洁密封圈。',
      'Layar 3 · Panduan MY-CS5039P': '第 3 屏 · MY-CS5039P 指南',
      'Pressure Cooker · Model MY-CS5039P': '压力锅 · 型号 MY-CS5039P',
      Volume: '容量',
      Hangat: '保温',
      'Jangan buka tutup sebelum tekanan benar-benar habis. Uap panas dapat menyebabkan luka bakar serius.':
        '在压力完全释放前请勿开盖，高温蒸汽可能造成严重烫伤。',
      'Jenis Panduan': '指南类型',
      '📖 Buku Panduan': '📖 使用手册',
      'Daftar isi 8 bab': '8 章目录',
      '▶ Video Panduan': '▶ 视频教程',
      'Buka layar video': '打开视频页面',
      'Tim kami siap membantu Anda 24/7': '我们的团队 24/7 为您服务',
      'Halo! 👋 Selamat datang di layanan Tanya Kami Midea. Saya siap membantu Anda. Ada yang bisa kami bantu hari ini?':
        '您好！👋 欢迎使用 Midea 联系我们服务。我已准备好为您提供帮助。',
      'Garansi Produk': '产品保修',
      'Cara Penggunaan': '使用方法',
      'Tidak puas dengan jawaban ini?': '对这个回答不满意吗？',
      'Tanya CS': '联系人工客服',
      'BAB 1': '第 1 章',
      'BAB 2': '第 2 章',
      'BAB 3': '第 3 章',
      'BAB 4': '第 4 章',
      'BAB 5': '第 5 章',
      'BAB 6': '第 6 章',
      'BAB 7': '第 7 章',
      'BAB 8': '第 8 章',
      '1 dari 8 bab': '8 章中的第 1 章',
      '2 dari 8 bab': '8 章中的第 2 章',
      '3 dari 8 bab': '8 章中的第 3 章',
      '4 dari 8 bab': '8 章中的第 4 章',
      '5 dari 8 bab': '8 章中的第 5 章',
      '6 dari 8 bab': '8 章中的第 6 章',
      '7 dari 8 bab': '8 章中的第 7 章',
      '8 dari 8 bab': '8 章中的第 8 章',
      Keselamatan: '安全',
      '⚠ Peringatan Umum': '⚠ 一般警告',
      '🔥 Peringatan Uap Panas': '🔥 高温蒸汽警告',
      '⚡ Peringatan Listrik': '⚡ 电气安全警告',
      'Bab Sebelumnya': '上一章',
      'Spesifikasi &': '规格与',
      'Struktur Produk': '产品结构',
      '📋 Spesifikasi Teknis': '📋 技术规格',
      Model: '型号',
      Tegangan: '电压',
      Daya: '功率',
      'Volume Panci': '内锅容量',
      'Diameter Panci': '内锅直径',
      'Tekanan Kerja': '工作压力',
      'Suhu Keep Warm': '保温温度',
      '🔩 Komponen Utama': '🔩 主要部件',
      'Katup Uap (Steam Vent)': '蒸汽阀（Steam Vent）',
      'Melepaskan uap tekanan saat memasak selesai atau ditekan manual': '烹饪结束或手动按下时释放压力蒸汽',
      'Indikator tekanan — terangkat saat bertekanan, turun saat aman dibuka': '压力指示器：有压力时升起，安全开盖时下降',
      'Cincin karet untuk memastikan tutup kedap tekanan saat memasak': '用于确保烹饪时锅盖密封增压的橡胶圈',
      'Pelindung pipa uap agar tidak tersumbat sisa makanan': '防止食物残渣堵塞蒸汽管的防护件',
      'Layar LED + 6 tombol operasi + 5 tombol fungsi cepat': 'LED 屏幕 + 6 个操作键 + 5 个快捷功能键',
      '🎁 Aksesori Bawaan': '🎁 随附配件',
      'Sendok Nasi': '饭勺',
      'Sendok Sup': '汤勺',
      'Gelas Takar': '量杯',
      'Pengumpul Kondensasi': '冷凝水收集器',
    },
  };

  const state = {
    language: loadSavedLanguage(),
    languageRequestId: 0,
    translationDebounceTimer: null,
    chatMode: 'support',
    chatBusy: false,
    chatHistory: { support: [], recipe: [] },
    runtimeTranslationCache: {
      en: Object.create(null),
      zh: Object.create(null),
    },
  };

  const translatableNodes = [];
  const trackedTextNodes = new WeakSet();
  const videoThumbCache = Object.create(null);
  const FALLBACK_PHRASE_MAP = {
    en: {
      'Smart Home Experience': 'Smart Home Experience',
      PresstoApp: 'PresstoApp',
      'Masak apa kita': 'What shall we cook',
      'hari ini? 🍳': 'today? 🍳',
      'MY-CS5039P · Pressure Cooker': 'MY-CS5039P · Pressure Cooker',
      'Mongolian Beef': 'Mongolian Beef',
      'Kontrol Jarak Jauh': 'Remote Control',
      'Buku & video panduan': 'Manual & video guides',
      'Tanya Teknisi': 'Ask Technician',
      'AI Chatbot 24 jam': '24-hour AI chatbot',
      'Terhubung · Siap Digunakan': 'Connected · Ready to Use',
      'Terhubung · Aktif': 'Connected · Active',
      'Notifikasi & Alert': 'Notifications & Alerts',
      'Riwayat pesan perangkat': 'Device message history',
      'Jenis Panduan': 'Guide Type',
      'Daftar isi 8 bab': '8-chapter table of contents',
      'Buka layar video': 'Open video screen',
      '5 video tutorial': '5 tutorial videos',
      'Peringatan Umum': 'General Warning',
      'Peringatan Uap Panas': 'Hot Steam Warning',
      'Peringatan Listrik': 'Electrical Warning',
      'Spesifikasi Teknis': 'Technical Specifications',
      'Komponen Utama': 'Main Components',
      'Aksesori Bawaan': 'Included Accessories',
      'Bab Sebelumnya': 'Previous Chapter',
      'Bab Selanjutnya': 'Next Chapter',
      'Daftar Isi': 'Table of Contents',
      'Suhu Keep Warm': 'Keep Warm Temperature',
      'Kontrol': 'Control',
      'Panduan': 'Guide',
      'Resep': 'Recipes',
      'Bantuan': 'Help',
      'Jangan letakkan di tempat tidak stabil atau di atas koran/busa yang dapat menutup':
        'Do not place it on an unstable surface or on newspaper/foam that may block',
      'Alat ini tidak diperuntukkan bagi anak-anak. Jangan gunakan di dekat air atau api, dan jauhkan dari paparan sinar matahari langsung.':
        'This appliance is not intended for children. Do not use near water or fire, and keep away from direct sunlight.',
      'TIDAK BOLEH melebihi': 'MUST NOT exceed',
      'sebelum memastikan tidak ada tekanan di dalam. Tunggu float valve turun sepenuhnya.':
        'before ensuring there is no pressure inside. Wait until the float valve drops completely.',
      'service center resmi': 'official service center',
      'tidak boleh dihubungkan': 'must not be connected',
      'Aktifkan mode jaga hangat kapan saja dari standby': 'Activate Keep Warm mode anytime from standby',
      '🍽 Semua Menu Fungsi': '🍽 All Function Menus',
      'tidak dapat menggunakan preset timer dan tidak mendukung pemilihan tekstur.':
        'cannot use preset timer and does not support texture selection.',
      'Dorong anti-block shield ke samping untuk mengangkatnya ke atas dari pipa uap.':
        'Push the anti-block shield sideways to lift it up from the steam pipe.',
      'Tarik ke atas dari rak penahan secara bertahap, bagian per bagian.':
        'Pull upward from the retaining rack gradually, section by section.',
      '(atas/bawah). Untuk menghilangkan bau, cuci dengan air sabun hangat.':
        '(top/bottom). To remove odor, wash with warm soapy water.',
      '✅ Boleh vs Tidak Boleh': '✅ Do and Don’t',
      'Putar tuas steam vent ke posisi terbuka (panah ke atas) sebelum memulai memasak.':
        'Turn the steam vent lever to the open position (arrow up) before starting to cook.',
      'tidak dapat menggunakan preset timer.': 'cannot use preset timer.',
      'di atas tutup untuk mempercepat pendinginan.': 'on top of the lid to speed up cooling.',
      'Angkat tutup ke atas untuk membuka. Arahkan uap sisa menjauhi tubuh.':
        'Lift the lid up to open. Direct remaining steam away from your body.',
      'Pressure cooker memanas tidak wajar atau mengeluarkan bau terbakar saat dioperasikan.':
        'The pressure cooker overheats abnormally or emits a burning smell during operation.',
      'Suara atau Getaran Tidak Wajar': 'Abnormal Noise or Vibration',
      'Muncul suara aneh atau getaran berlebihan saat alat dinyalakan. Segera cabut dan hubungi service center.':
        'If unusual noise or excessive vibration appears when the appliance is turned on, unplug immediately and contact the service center.',
      '& Kode Error': '& Error Codes',
      'Sealing ring tidak terpasang dengan benar, atau float valve masih terangkat akibat tekanan sisa':
        'The sealing ring is not installed correctly, or the float valve is still raised due to residual pressure.',
      'Sealing ring rusak, kotor, atau tidak terpasang sempurna. Bisa juga karena tutup tidak tertutup rapat':
        'The sealing ring is damaged, dirty, or not installed properly. It can also be due to the lid not being tightly closed.',
      'Float valve tersumbat, silikon float valve aus, atau handle steam release tidak di posisi sealing':
        'The float valve is clogged, the float-valve silicone is worn, or the steam release handle is not in the sealing position.',
      'Float Valve Tidak Bisa Naik': 'Float Valve Cannot Rise',
      'Tambahkan air sesuai resep yang dianjurkan. Jika berlanjut, kirim ke service center':
        'Add water according to the recommended recipe. If it continues, send it to the service center.',
      'Layar Kosong Setelah Dinyalakan': 'Blank Display After Power On',
      'Sambungan listrik buruk, sekring alat putus, atau tutup tidak tertutup sempurna':
        'Poor electrical connection, blown fuse, or lid not fully closed.',
      'Periksa kabel & stopkontak. Pastikan tutup terkunci. Jika berlanjut, hubungi service center resmi Midea':
        'Check the power cable and outlet. Ensure the lid is locked. If it continues, contact an official Midea service center.',
      'Terlalu sedikit air, tutup dibuka terlalu cepat, atau takaran air tidak sesuai':
        'Too little water, lid opened too early, or incorrect water ratio.',
      '🔴 Kode Error & Artinya': '🔴 Error Codes & Meanings',
      'Sensor suhu bagian bawah terputus. Hentikan penggunaan dan kirim ke service center untuk diperiksa.':
        'Bottom temperature sensor open circuit. Stop using and send to service center for inspection.',
      'Sensor suhu bagian bawah mengalami korsleting. Hentikan penggunaan segera dan hubungi service center.':
        'Bottom temperature sensor short circuit. Stop using immediately and contact service center.',
      'Saklar tekanan terputus. Periksa apakah ada air atau makanan yang perlu dibersihkan. Jika berlanjut, kirim ke service center.':
        'Pressure switch open circuit. Check for water/food residue that needs cleaning. If it continues, send to service center.',
      'Alat terlalu panas (overtemperature). Biarkan dingin sepenuhnya lalu coba nyalakan kembali. Pastikan ventilasi tidak tersumbat.':
        'The appliance is too hot (overtemperature). Let it cool completely, then try turning it on again. Ensure vents are not blocked.',
      'Hubungi Service Center resmi Midea atau gunakan fitur':
        'Contact official Midea Service Center or use the feature',
      'Empuk cepat · Cocok untuk menu keluarga': 'Fast tender texture · Suitable for family meals',
      'Menu daging cepat · Bumbu gurih manis': 'Quick meat menu · Savory sweet seasoning',
      'Menu praktis protein tinggi · Cocok meal prep': 'Practical high-protein menu · Great for meal prep',
      'Ketuk kartu video untuk memutar langsung di dalam aplikasi ini. Jika gagal tampil, pastikan file Drive diset ke akses publik':
        'Tap a video card to play directly in this app. If it fails to display, make sure the Drive file is set to public access.',
      '0 video': '0 videos',
    },
    zh: {
      'Smart Home Experience': '智能家居体验',
      PresstoApp: 'PresstoApp',
      'Masak apa kita': '今天我们做什么',
      'hari ini? 🍳': '呢？🍳',
      'MY-CS5039P · Pressure Cooker': 'MY-CS5039P · 压力锅',
      'Mongolian Beef': '蒙古牛肉',
      'Kontrol Jarak Jauh': '远程控制',
      'Buku & video panduan': '手册与视频教程',
      'Tanya Teknisi': '咨询技术员',
      'AI Chatbot 24 jam': '24 小时 AI 聊天助手',
      'Terhubung · Siap Digunakan': '已连接 · 可立即使用',
      'Terhubung · Aktif': '已连接 · 运行中',
      'Notifikasi & Alert': '通知与提醒',
      'Riwayat pesan perangkat': '设备消息记录',
      'Jenis Panduan': '指南类型',
      'Daftar isi 8 bab': '8 章目录',
      'Buka layar video': '打开视频页面',
      '5 video tutorial': '5 个教学视频',
      'Peringatan Umum': '一般警告',
      'Peringatan Uap Panas': '高温蒸汽警告',
      'Peringatan Listrik': '电气安全警告',
      'Spesifikasi Teknis': '技术规格',
      'Komponen Utama': '主要部件',
      'Aksesori Bawaan': '随附配件',
      'Bab Sebelumnya': '上一章',
      'Bab Selanjutnya': '下一章',
      'Daftar Isi': '目录',
      'Suhu Keep Warm': '保温温度',
      'Kontrol': '控制',
      'Panduan': '指南',
      'Resep': '食谱',
      'Bantuan': '帮助',
      'Service Center': '服务中心',
      'Jangan letakkan di tempat tidak stabil atau di atas koran/busa yang dapat menutup':
        '请勿放置在不稳定位置，或放在可能遮挡的报纸/泡沫上',
      'Alat ini tidak diperuntukkan bagi anak-anak. Jangan gunakan di dekat air atau api, dan jauhkan dari paparan sinar matahari langsung.':
        '本设备不适用于儿童。请勿在水源或火源附近使用，并避免阳光直射。',
      'TIDAK BOLEH melebihi': '严禁超过',
      'sebelum memastikan tidak ada tekanan di dalam. Tunggu float valve turun sepenuhnya.':
        '在确认内部无压力之前，请勿开盖。等待浮子阀完全下降。',
      'service center resmi': '官方服务中心',
      'tidak boleh dihubungkan': '不得连接',
      'tidak dapat menggunakan preset timer dan tidak mendukung pemilihan tekstur.':
        '不能使用预约定时，且不支持口感选择。',
      'Dorong anti-block shield ke samping untuk mengangkatnya ke atas dari pipa uap.':
        '向侧面推动防堵罩，将其从蒸汽管向上提起。',
      'Tarik ke atas dari rak penahan secara bertahap, bagian per bagian.':
        '从固定架上逐段向上拉出。',
      '(atas/bawah). Untuk menghilangkan bau, cuci dengan air sabun hangat.':
        '（上/下均可）。如需去味，请用温肥皂水清洗。',
      '✅ Boleh vs Tidak Boleh': '✅ 可做与不可做',
      'Putar tuas steam vent ke posisi terbuka (panah ke atas) sebelum memulai memasak.':
        '在开始烹饪前，将蒸汽阀拨杆旋到开启位置（箭头向上）。',
      'tidak dapat menggunakan preset timer.': '不能使用预约定时。',
      'di atas tutup untuk mempercepat pendinginan.': '可放在锅盖上方以加快降温。',
      'Angkat tutup ke atas untuk membuka. Arahkan uap sisa menjauhi tubuh.':
        '向上提起锅盖即可打开。将剩余蒸汽导向远离身体。',
      'Pressure cooker memanas tidak wajar atau mengeluarkan bau terbakar saat dioperasikan.':
        '压力锅运行时异常发热或出现焦糊气味。',
      'Suara atau Getaran Tidak Wajar': '异常噪音或震动',
      'Muncul suara aneh atau getaran berlebihan saat alat dinyalakan. Segera cabut dan hubungi service center.':
        '开机时若出现异常噪音或过度震动，请立即拔掉电源并联系服务中心。',
      '& Kode Error': '与错误代码',
      'Sealing ring tidak terpasang dengan benar, atau float valve masih terangkat akibat tekanan sisa':
        '密封圈安装不正确，或浮子阀因残余压力仍处于升起状态。',
      'Sealing ring rusak, kotor, atau tidak terpasang sempurna. Bisa juga karena tutup tidak tertutup rapat':
        '密封圈损坏、脏污或安装不到位，也可能是锅盖未完全锁紧。',
      'Float valve tersumbat, silikon float valve aus, atau handle steam release tidak di posisi sealing':
        '浮子阀堵塞、浮子阀硅胶磨损，或蒸汽释放手柄未处于密封位置。',
      'Float Valve Tidak Bisa Naik': '浮子阀无法升起',
      'Tambahkan air sesuai resep yang dianjurkan. Jika berlanjut, kirim ke service center':
        '请按推荐食谱补充水量；若仍持续，请送至服务中心。',
      'Layar Kosong Setelah Dinyalakan': '开机后屏幕无显示',
      'Sambungan listrik buruk, sekring alat putus, atau tutup tidak tertutup sempurna':
        '电源连接不良、保险丝熔断，或锅盖未完全闭合。',
      'Periksa kabel & stopkontak. Pastikan tutup terkunci. Jika berlanjut, hubungi service center resmi Midea':
        '请检查电源线和插座，确认锅盖已锁紧；若仍持续，请联系美的官方服务中心。',
      'Terlalu sedikit air, tutup dibuka terlalu cepat, atau takaran air tidak sesuai':
        '水量过少、开盖过早，或水量比例不正确。',
      '🔴 Kode Error & Artinya': '🔴 错误代码与含义',
      'Sensor suhu bagian bawah terputus. Hentikan penggunaan dan kirim ke service center untuk diperiksa.':
        '底部温度传感器开路。请停止使用并送服务中心检修。',
      'Sensor suhu bagian bawah mengalami korsleting. Hentikan penggunaan segera dan hubungi service center.':
        '底部温度传感器短路。请立即停止使用并联系服务中心。',
      'Saklar tekanan terputus. Periksa apakah ada air atau makanan yang perlu dibersihkan. Jika berlanjut, kirim ke service center.':
        '压力开关开路。请检查是否有水或食物残留需要清理；若仍持续，请送服务中心。',
      'Alat terlalu panas (overtemperature). Biarkan dingin sepenuhnya lalu coba nyalakan kembali. Pastikan ventilasi tidak tersumbat.':
        '设备过热（过温保护）。请完全冷却后再尝试开机，并确保通风口未堵塞。',
      'Hubungi Service Center resmi Midea atau gunakan fitur': '联系美的官方服务中心或使用此功能',
      'Empuk cepat · Cocok untuk menu keluarga': '快速软烂口感 · 适合家庭菜单',
      'Menu daging cepat · Bumbu gurih manis': '快速肉类菜单 · 咸甜风味',
      'Menu praktis protein tinggi · Cocok meal prep': '高蛋白实用菜单 · 适合备餐',
      'Ketuk kartu video untuk memutar langsung di dalam aplikasi ini. Jika gagal tampil, pastikan file Drive diset ke akses publik':
        '点击视频卡片可在应用内直接播放。若无法显示，请确保 Drive 文件已设为公开访问。',
      '0 video': '0 个视频',
    },
  };
  const FALLBACK_WORD_MAP = {
    en: {
      bab: 'chapter',
      dari: 'of',
      keselamatan: 'safety',
      penting: 'important',
      spesifikasi: 'specifications',
      struktur: 'structure',
      produk: 'product',
      panel: 'panel',
      kontrol: 'control',
      status: 'status',
      pemasak: 'cooking',
      persiapan: 'preparation',
      sebelum: 'before',
      penggunaan: 'use',
      pertama: 'first',
      cara: 'how',
      memasak: 'cook',
      dengan: 'with',
      membuka: 'open',
      tutup: 'lid',
      aman: 'safely',
      perawatan: 'care',
      pembersihan: 'cleaning',
      pemecahan: 'troubleshooting',
      masalah: 'problem',
      kode: 'code',
      menu: 'menu',
      utama: 'main',
      panduan: 'guide',
      tanya: 'ask',
      kami: 'us',
      rekomendasi: 'recommendation',
      resep: 'recipe',
      bantuan: 'help',
      kembali: 'back',
      daftar: 'table',
      isi: 'contents',
      selesai: 'finished',
      membaca: 'reading',
      dan: 'and',
      yang: 'that',
      untuk: 'for',
      jangan: 'do not',
      tekan: 'press',
      tekanan: 'pressure',
      suhu: 'temperature',
      daya: 'power',
      tegangan: 'voltage',
      volume: 'volume',
      aktif: 'active',
      terhubung: 'connected',
      siap: 'ready',
      digunakan: 'used',
      hari: 'day',
      ini: 'this',
      kemarin: 'yesterday',
      menit: 'minutes',
      jam: 'hours',
      listrik: 'electric',
      uap: 'steam',
      panas: 'hot',
      tombol: 'button',
      mode: 'mode',
      waktu: 'time',
      sisa: 'remaining',
      masak: 'cook',
      garansi: 'warranty',
      servis: 'service',
      center: 'center',
      atau: 'or',
      cuci: 'wash',
      dalam: 'inside',
      air: 'water',
      jika: 'if',
      alat: 'appliance',
      saat: 'when',
      hingga: 'until',
      bagian: 'part',
      cepat: 'quick',
      putar: 'rotate',
      buku: 'manual',
      buka: 'open',
      fungsi: 'function',
      video: 'video',
      bawah: 'bottom',
      lalu: 'then',
      kabel: 'cable',
      program: 'program',
      pastikan: 'ensure',
      solusi: 'solution',
      katup: 'valve',
      setelah: 'after',
      dapat: 'can',
      ada: 'there is',
      turun: 'down',
      detail: 'detail',
      operasi: 'operation',
      nasi: 'rice',
      mesin: 'machine',
      bodi: 'body',
      penyebab: 'cause',
      batas: 'limit',
      bahan: 'ingredients',
      selanjutnya: 'next',
      terpasang: 'installed',
      terlalu: 'too',
      aplikasi: 'app',
      masih: 'still',
      masakan: 'dish',
      bersihkan: 'clean',
      bisa: 'can',
      dibuka: 'opened',
      makanan: 'food',
      semua: 'all',
      memasang: 'installing',
      terkunci: 'locked',
      pada: 'at',
      posisi: 'position',
      bersih: 'clean',
      lap: 'wipe',
      piring: 'dish',
      hangat: 'warm',
      gunakan: 'use',
      boleh: 'allowed',
      vent: 'vent',
      aksesori: 'accessories',
      terbuka: 'open',
      pot: 'pot',
      luar: 'outer',
      kain: 'cloth',
      secara: 'by',
      sesuai: 'according',
      bahasa: 'language',
      kpa: 'kPa',
      chicken: 'chicken',
      porridge: 'porridge',
      daging: 'meat',
      benar: 'properly',
      tunggu: 'wait',
      macet: 'stuck',
      jauhkan: 'keep away',
      anak: 'child',
      melebihi: 'exceed',
      tangan: 'hands',
      buang: 'release',
      sepenuhnya: 'fully',
      steker: 'plug',
      rusak: 'damaged',
      kirim: 'send',
      indikator: 'indicator',
      pipa: 'pipe',
      tekstur: 'texture',
      sudah: 'already',
      melepas: 'remove',
      pasang: 'attach',
      menekan: 'pressing',
      maksimal: 'maximum',
      masukkan: 'insert',
      kering: 'dry',
      sempurna: 'perfect',
      cocok: 'suitable',
      hubungi: 'contact',
      sensor: 'sensor',
      pilih: 'choose',
      anda: 'you',
      coba: 'try',
      jarak: 'distance',
      jauh: 'far',
      atur: 'set',
      alert: 'alert',
      selama: 'during',
      tinggi: 'high',
      habis: 'depleted',
      karena: 'because',
      pegangan: 'handle',
      dorong: 'push',
      pena: 'pen',
      sumpit: 'chopsticks',
      peringatan: 'warning',
      umum: 'general',
      langsung: 'directly',
      keluar: 'out',
      memastikan: 'ensuring',
      segera: 'immediately',
      resmi: 'official',
      tanda: 'mark',
      kerusakan: 'damage',
      otomatis: 'automatic',
      agar: 'so that',
      tersumbat: 'clogged',
      menyala: 'on',
      mulai: 'start',
      lembut: 'soft',
      menggunakan: 'using',
      angkat: 'lift',
      merata: 'evenly',
      rapat: 'tight',
      keluarkan: 'remove',
      rendam: 'soak',
      bau: 'odor',
      tertutup: 'closed',
      mengembang: 'expand',
      sedikit: 'little',
      stopkontak: 'power outlet',
      biarkan: 'let',
      periksa: 'check',
      berlanjut: 'continue',
      pilihan: 'choice',
      selamat: 'welcome',
      datang: 'welcome',
      baru: 'new',
      tutorial: 'tutorial',
      teknisi: 'technician',
      stabil: 'stable',
      bertekanan: 'pressurized',
      notifikasi: 'notification',
      perangkat: 'device',
      safety: 'safety',
      proses: 'process',
      berlangsung: 'running',
      pukul: 'at',
      rendang: 'rendang',
      dimasak: 'cooked',
      jenis: 'type',
      membantu: 'helping',
      saya: 'I',
      letakkan: 'place',
      tempat: 'place',
      lubang: 'hole',
      ventilasi: 'ventilation',
      jumlah: 'amount',
      berlebih: 'excessive',
      wajah: 'face',
      sedang: 'currently',
      dilarang: 'prohibited',
      eksternal: 'external',
      oleh: 'by',
    },
    zh: {
      bab: '章',
      dari: '中的',
      keselamatan: '安全',
      penting: '重要',
      spesifikasi: '规格',
      struktur: '结构',
      produk: '产品',
      panel: '面板',
      kontrol: '控制',
      status: '状态',
      pemasak: '烹饪',
      persiapan: '准备',
      sebelum: '之前',
      penggunaan: '使用',
      pertama: '首次',
      cara: '方法',
      memasak: '烹饪',
      dengan: '使用',
      membuka: '打开',
      tutup: '锅盖',
      aman: '安全',
      perawatan: '保养',
      pembersihan: '清洁',
      pemecahan: '排查',
      masalah: '问题',
      kode: '代码',
      menu: '菜单',
      utama: '主',
      panduan: '指南',
      tanya: '咨询',
      kami: '我们',
      rekomendasi: '推荐',
      resep: '食谱',
      bantuan: '帮助',
      kembali: '返回',
      daftar: '目录',
      isi: '内容',
      selesai: '完成',
      membaca: '阅读',
      dan: '和',
      yang: '的',
      untuk: '用于',
      jangan: '不要',
      tekan: '按下',
      tekanan: '压力',
      suhu: '温度',
      daya: '功率',
      tegangan: '电压',
      volume: '容量',
      aktif: '运行中',
      terhubung: '已连接',
      siap: '准备',
      digunakan: '使用',
      hari: '天',
      ini: '今天',
      kemarin: '昨天',
      menit: '分钟',
      jam: '小时',
      listrik: '电气',
      uap: '蒸汽',
      panas: '高温',
      tombol: '按钮',
      mode: '模式',
      waktu: '时间',
      sisa: '剩余',
      masak: '烹饪',
      garansi: '保修',
      servis: '服务',
      center: '中心',
      atau: '或',
      cuci: '清洗',
      dalam: '内部',
      air: '水',
      jika: '如果',
      alat: '设备',
      saat: '当',
      hingga: '直到',
      bagian: '部分',
      cepat: '快速',
      putar: '旋转',
      buku: '手册',
      buka: '打开',
      fungsi: '功能',
      video: '视频',
      bawah: '底部',
      lalu: '然后',
      kabel: '电源线',
      program: '程序',
      pastikan: '确保',
      solusi: '解决方案',
      katup: '阀',
      setelah: '之后',
      dapat: '可以',
      ada: '有',
      turun: '下降',
      detail: '详情',
      operasi: '操作',
      nasi: '米饭',
      mesin: '机器',
      bodi: '机身',
      penyebab: '原因',
      batas: '上限',
      bahan: '食材',
      selanjutnya: '下一步',
      terpasang: '已安装',
      terlalu: '过于',
      aplikasi: '应用',
      masih: '仍然',
      masakan: '菜品',
      bersihkan: '清洁',
      bisa: '可以',
      dibuka: '打开',
      makanan: '食物',
      semua: '全部',
      memasang: '安装',
      terkunci: '已锁定',
      pada: '在',
      posisi: '位置',
      bersih: '干净',
      lap: '擦拭',
      piring: '餐具',
      hangat: '保温',
      gunakan: '使用',
      boleh: '可以',
      vent: '通气阀',
      aksesori: '配件',
      terbuka: '打开',
      pot: '内锅',
      luar: '外部',
      kain: '布',
      secara: '以',
      sesuai: '按照',
      bahasa: '语言',
      kpa: 'kPa',
      chicken: '鸡肉',
      porridge: '粥',
      daging: '肉类',
      benar: '正确',
      tunggu: '等待',
      macet: '卡住',
      jauhkan: '远离',
      anak: '儿童',
      melebihi: '超过',
      tangan: '手',
      buang: '释放',
      sepenuhnya: '完全',
      steker: '插头',
      rusak: '损坏',
      kirim: '送修',
      indikator: '指示器',
      pipa: '管道',
      tekstur: '口感',
      sudah: '已经',
      melepas: '拆下',
      pasang: '安装',
      menekan: '按压',
      maksimal: '最大',
      masukkan: '放入',
      kering: '干燥',
      sempurna: '完全',
      cocok: '适合',
      hubungi: '联系',
      sensor: '传感器',
      pilih: '选择',
      anda: '您',
      coba: '尝试',
      jarak: '远程',
      jauh: '远',
      atur: '设置',
      alert: '提醒',
      selama: '期间',
      tinggi: '高',
      habis: '耗尽',
      karena: '因为',
      pegangan: '手柄',
      dorong: '推',
      pena: '笔',
      sumpit: '筷子',
      peringatan: '警告',
      umum: '一般',
      langsung: '直接',
      keluar: '出来',
      memastikan: '确保',
      segera: '立即',
      resmi: '官方',
      tanda: '标记',
      kerusakan: '故障',
      otomatis: '自动',
      agar: '以便',
      tersumbat: '堵塞',
      menyala: '亮起',
      mulai: '开始',
      lembut: '柔软',
      menggunakan: '使用',
      angkat: '抬起',
      merata: '均匀',
      rapat: '紧密',
      keluarkan: '取出',
      rendam: '浸泡',
      bau: '异味',
      tertutup: '关闭',
      mengembang: '膨胀',
      sedikit: '少量',
      stopkontak: '电源插座',
      biarkan: '让其',
      periksa: '检查',
      berlanjut: '继续',
      pilihan: '选项',
      selamat: '欢迎',
      datang: '到来',
      baru: '新',
      tutorial: '教程',
      teknisi: '技术员',
      stabil: '稳定',
      bertekanan: '有压力',
      notifikasi: '通知',
      perangkat: '设备',
      safety: '安全',
      proses: '过程',
      berlangsung: '进行中',
      pukul: '时间',
      rendang: '仁当',
      dimasak: '已烹饪',
      jenis: '类型',
      membantu: '帮助',
      saya: '我',
      letakkan: '放置',
      tempat: '位置',
      lubang: '孔',
      ventilasi: '通风',
      jumlah: '数量',
      berlebih: '过多',
      wajah: '面部',
      sedang: '正在',
      dilarang: '禁止',
      eksternal: '外部',
      oleh: '由',
    },
  };

  function loadSavedLanguage() {
    const saved = localStorage.getItem('midea_lang') || 'id';
    return SUPPORTED_LANGS.includes(saved) ? saved : 'id';
  }

  function tr(key) {
    return UI_TEXT[state.language]?.[key] || UI_TEXT.id[key] || key;
  }

  function chatText(mode, key) {
    const value = CHAT_MODES[mode]?.[key];
    if (!value) return '';
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value;
    return value[state.language] || value.id;
  }

  function langValue(valueByLang) {
    if (!valueByLang || typeof valueByLang !== 'object') return '';
    return valueByLang[state.language] || valueByLang.id || '';
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    const total = Math.round(seconds);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    if (hh > 0) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  function resolveAssetUrl(src) {
    const raw = String(src || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw.replace(/^\.\//, ''), window.location.href).href;
    } catch (_err) {
      return raw;
    }
  }

  function extractDriveFileId(src) {
    const raw = String(src || '').trim();
    if (!raw) return '';
    const byPath = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (byPath && byPath[1]) return byPath[1];
    try {
      const u = new URL(raw);
      return u.searchParams.get('id') || '';
    } catch (_err) {
      return '';
    }
  }

  function toDrivePreviewUrl(fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  function extractYouTubeVideoId(src) {
    const raw = String(src || '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        return (u.pathname || '').replace(/^\//, '').split('/')[0] || '';
      }
      if (host === 'youtube.com' || host === 'm.youtube.com') {
        if (u.pathname === '/watch') return u.searchParams.get('v') || '';
        const embedMatch = (u.pathname || '').match(/^\/embed\/([a-zA-Z0-9_-]+)/);
        if (embedMatch && embedMatch[1]) return embedMatch[1];
      }
    } catch (_err) {
      const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (shortMatch && shortMatch[1]) return shortMatch[1];
      const watchMatch = raw.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (watchMatch && watchMatch[1]) return watchMatch[1];
    }
    return '';
  }

  function toYouTubeEmbedUrl(videoId) {
    const params = new URLSearchParams({
      autoplay: '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
    });
    const origin = window.location && window.location.origin;
    if (origin && origin !== 'null') {
      params.set('origin', origin);
    }
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }

  function toDriveThumbUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  function captureVideoThumbnail(src, seekAtSeconds = 1) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      let settled = false;
      const canvas = document.createElement('canvas');
      const cleanup = () => {
        try {
          video.pause();
        } catch (_err) {}
        video.removeAttribute('src');
        video.load();
      };

      const done = (payload) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(payload);
      };

      const tryCapture = () => {
        if (!video.videoWidth || !video.videoHeight) {
          done({ dataUrl: '', duration: video.duration || 0 });
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          done({ dataUrl: '', duration: video.duration || 0 });
          return;
        }
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          done({ dataUrl: canvas.toDataURL('image/jpeg', 0.78), duration: video.duration || 0 });
        } catch (_err) {
          done({ dataUrl: '', duration: video.duration || 0 });
        }
      };

      video.addEventListener(
        'loadedmetadata',
        () => {
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          if (duration <= 0.3) {
            tryCapture();
            return;
          }
          const target = Math.min(Math.max(seekAtSeconds, 0.1), Math.max(duration - 0.2, 0.1));
          try {
            video.currentTime = target;
          } catch (_err) {
            tryCapture();
          }
        },
        { once: true }
      );
      video.addEventListener('seeked', tryCapture, { once: true });
      video.addEventListener(
        'loadeddata',
        () => {
          if (!settled && (video.currentTime <= 0.1 || !Number.isFinite(video.duration))) {
            tryCapture();
          }
        },
        { once: true }
      );
      video.addEventListener(
        'error',
        () => {
          done({ dataUrl: '', duration: 0 });
        },
        { once: true }
      );

      video.src = resolveAssetUrl(src);
    });
  }

  function nowTimeText() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function getActiveWrap() {
    return wraps.find((wrap) => {
      const style = window.getComputedStyle(wrap);
      return style.display !== 'none';
    });
  }

  function cacheTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('svg')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      if (trackedTextNodes.has(node)) continue;
      node.__baseText = node.nodeValue;
      trackedTextNodes.add(node);
      translatableNodes.push(node);
    }
  }

  function replaceByPhraseMap(text, map) {
    if (!text || !map) return text;
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    let output = text;
    keys.forEach((source) => {
      if (!source || !output.includes(source)) return;
      output = output.split(source).join(map[source]);
    });
    return output;
  }

  function replaceByWordMap(text, map) {
    if (!text || !map) return text;
    return text.replace(/[A-Za-zÀ-ÿ]+/g, (token) => {
      const lower = token.toLowerCase();
      const translated = map[lower];
      if (!translated) return token;
      if (token === token.toUpperCase()) return translated.toUpperCase();
      if (token[0] === token[0].toUpperCase()) {
        return translated.charAt(0).toUpperCase() + translated.slice(1);
      }
      return translated;
    });
  }

  function translateStaticText(baseText, lang) {
    if (lang === 'id') return baseText;

    const dict = STATIC_TEXT_MAP[lang] || {};
    const trimmed = baseText.trim();
    if (!trimmed) return baseText;

    const translated = dict[trimmed];
    if (translated && translated !== trimmed) {
      return baseText.replace(trimmed, translated);
    }

    const phraseMap = FALLBACK_PHRASE_MAP[lang] || {};
    const fallbackTranslated = replaceByPhraseMap(trimmed, phraseMap);
    if (fallbackTranslated && fallbackTranslated !== trimmed) {
      return baseText.replace(trimmed, fallbackTranslated);
    }

    const wordMap = FALLBACK_WORD_MAP[lang] || {};
    const wordTranslated = replaceByWordMap(trimmed, wordMap);
    if (wordTranslated && wordTranslated !== trimmed) {
      return baseText.replace(trimmed, wordTranslated);
    }

    return baseText;
  }

  function applyTextToNode(node, translatedCore) {
    const baseText = node.__baseText;
    const trimmed = baseText.trim();
    if (!trimmed) {
      node.nodeValue = baseText;
      return;
    }

    if (!translatedCore || translatedCore === trimmed) {
      node.nodeValue = baseText;
      return;
    }

    node.nodeValue = baseText.replace(trimmed, translatedCore);
  }

  function shouldCacheUnchangedText(sourceText, lang) {
    const text = (sourceText || '').trim();
    if (!text) return true;
    if (text.length <= 2) return true;
    if (/^[0-9 .,:/%()+-]+$/.test(text)) return true;
    if (/^[A-Z0-9 _\-./:+()]+$/.test(text)) return true;
    if (lang === 'en' && /^(WiFi|MAX|OPEN|Standby|Preset|Keep-Warm|Start|Menu|Timer|Warm)$/i.test(text)) {
      return true;
    }
    return false;
  }

  function purgeWeakUnchangedCache(lang) {
    const cache = state.runtimeTranslationCache[lang];
    if (!cache) return;
    Object.keys(cache).forEach((sourceText) => {
      const translated = cache[sourceText];
      if (translated === sourceText && !shouldCacheUnchangedText(sourceText, lang)) {
        delete cache[sourceText];
      }
    });
  }

  function collectMissingTranslations(lang, options = {}) {
    const missingMap = new Map();
    const scope = options.scope || 'active';
    const activeWrap = getActiveWrap();

    cacheTextNodes();
    translatableNodes.forEach((node) => {
      if (!node.isConnected) return;
      const parent = node.parentElement;
      if (!parent) return;

      const ownerWrap = parent.closest('.phone-wrap');
      const insideProfileOverlay = Boolean(parent.closest('#profile-overlay'));
      const insideToast = Boolean(parent.closest('#prototype-toast'));

      // mode active: fokus ke layar aktif agar cepat
      if (scope === 'active' && activeWrap && ownerWrap && ownerWrap !== activeWrap) return;
      if (!ownerWrap && !insideProfileOverlay && !insideToast) return;

      const baseText = node.__baseText;
      const trimmed = baseText.trim();
      if (!trimmed) {
        node.nodeValue = baseText;
        return;
      }

      if (lang === 'id') {
        node.nodeValue = baseText;
        return;
      }

      const staticTranslatedText = translateStaticText(baseText, lang);
      if (staticTranslatedText !== baseText) {
        node.nodeValue = staticTranslatedText;
        return;
      }

      const cacheValue = state.runtimeTranslationCache[lang]?.[trimmed];
      if (cacheValue) {
        applyTextToNode(node, cacheValue);
        return;
      }

      // default sementara ke teks asli, nanti akan diisi hasil auto-translate
      node.nodeValue = baseText;
      if (!missingMap.has(trimmed)) missingMap.set(trimmed, []);
      missingMap.get(trimmed).push(node);
    });

    return missingMap;
  }

  function updateLanguageButtons() {
    const splash = wraps[SCREEN.SPLASH];
    const langBtns = splash.querySelectorAll('.lang-btn');
    langBtns.forEach((btn) => {
      const code = btn.dataset.lang || 'id';
      btn.classList.toggle('active', code === state.language);
    });
  }

  function initChatHistory() {
    state.chatHistory.support = [{ role: 'assistant', content: chatText('support', 'welcome') }];
    state.chatHistory.recipe = [{ role: 'assistant', content: chatText('recipe', 'welcome') }];
  }

  function hasScreen(idx) {
    return Number.isInteger(idx) && idx >= 0 && idx < wraps.length;
  }

  function showToast(message) {
    let toast = document.getElementById('prototype-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'prototype-toast';
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.bottom = '28px';
      toast.style.transform = 'translateX(-50%)';
      toast.style.padding = '10px 14px';
      toast.style.background = 'rgba(30, 30, 46, 0.92)';
      toast.style.color = '#fff';
      toast.style.borderRadius = '10px';
      toast.style.fontSize = '12px';
      toast.style.fontFamily = 'DM Sans, sans-serif';
      toast.style.zIndex = '9999';
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .2s ease';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 1800);
  }

  function goToScreen(idx) {
    if (!hasScreen(idx)) return;

    wraps.forEach((wrap, i) => {
      wrap.style.display = i === idx ? 'flex' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
    scheduleLanguageRefresh();
  }

  function openControlScreen() {
    if (hasScreen(SCREEN.CONTROL)) {
      goToScreen(SCREEN.CONTROL);
    }
  }

  function openAlertsScreen() {
    if (hasScreen(SCREEN.ALERTS)) {
      goToScreen(SCREEN.ALERTS);
      return;
    }
    if (hasScreen(SCREEN.CONTROL)) {
      goToScreen(SCREEN.CONTROL);
      return;
    }
    goToScreen(SCREEN.HOME);
  }

  function openRecipeScreen() {
    if (hasScreen(SCREEN.RECIPE)) {
      goToScreen(SCREEN.RECIPE);
      return;
    }
    openRecipeChat();
  }

  function routeBottomNav(navKey) {
    const key = String(navKey || '').trim().toLowerCase();
    if (!key) return;

    if (key === 'home' || key === 'beranda') {
      goToScreen(SCREEN.HOME);
      return;
    }
    if (key === 'control' || key === 'kontrol') {
      openControlScreen();
      return;
    }
    if (key === 'guide' || key === 'panduan') {
      goToScreen(SCREEN.PANDUAN);
      return;
    }
    if (key === 'recipe' || key === 'resep') {
      openRecipeScreen();
      return;
    }
    if (key === 'help' || key === 'bantuan') {
      openSupportChat();
      return;
    }
    if (key === 'chat') {
      openSupportChat();
      return;
    }
    if (key === 'profile' || key === 'profil') {
      openProfilePanel();
    }
  }

  function bindBottomNav(container) {
    if (!container) return;
    const navItems = container.querySelectorAll('.bottom-nav .nav-item');
    if (!navItems.length) return;

    const fallbackByIndex = ['home', 'control', 'guide', 'recipe', 'help'];
    navItems.forEach((item, index) => {
      if (item.dataset.navBound === '1') return;
      item.style.cursor = 'pointer';
      item.dataset.navBound = '1';
      item.addEventListener('click', () => {
        const fromData = item.getAttribute('data-nav') || '';
        const fromIndex = fallbackByIndex[index] || '';
        routeBottomNav(fromData || fromIndex);
      });
    });
  }

  async function fetchUiTranslationsChunk(lang, texts) {
    const result = await postJsonWithFallback('translate', { lang, texts });
    return result.translations;
  }

  async function translateMissingTexts(lang, missingMap, requestId) {
    if (lang === 'id') return;
    if (!missingMap || missingMap.size === 0) return;

    const keys = Array.from(missingMap.keys()).filter(
      (textKey) => !state.runtimeTranslationCache[lang]?.[textKey]
    );
    if (keys.length === 0) return;

    const CHUNK_SIZE = 20;
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      if (requestId !== state.languageRequestId || state.language !== lang) return;

      const chunk = keys.slice(i, i + CHUNK_SIZE);
      let translated = null;
      try {
        translated = await fetchUiTranslationsChunk(lang, chunk);
      } catch (chunkErr) {
        // fallback: jika batch gagal, coba satu per satu agar progress tetap jalan
        translated = [];
        for (let j = 0; j < chunk.length; j += 1) {
          if (requestId !== state.languageRequestId || state.language !== lang) return;
          const source = chunk[j];
          try {
            const one = await fetchUiTranslationsChunk(lang, [source]);
            translated.push(one[0] || source);
          } catch (_singleErr) {
            translated.push(source);
          }
        }
      }

      if (requestId !== state.languageRequestId || state.language !== lang) return;

      chunk.forEach((sourceText, index) => {
        const t = translated[index] && translated[index].trim() ? translated[index].trim() : sourceText;
        if (t !== sourceText || shouldCacheUnchangedText(sourceText, lang)) {
          state.runtimeTranslationCache[lang][sourceText] = t;
        }
      });
    }

    if (requestId !== state.languageRequestId || state.language !== lang) return;

    missingMap.forEach((nodes, sourceText) => {
      const translated = state.runtimeTranslationCache[lang][sourceText] || sourceText;
      nodes.forEach((node) => applyTextToNode(node, translated));
    });
  }

  function pretranslateAllScreensInBackground(requestId) {
    if (state.language === 'id') return;

    const passDelays = [220, 900, 1800];
    passDelays.forEach((delay) => {
      setTimeout(() => {
        if (requestId !== state.languageRequestId || state.language === 'id') return;
        const allMissingMap = collectMissingTranslations(state.language, { scope: 'all' });
        if (!allMissingMap.size) return;
        translateMissingTexts(state.language, allMissingMap, requestId).catch(() => {});
      }, delay);
    });
  }

  function scheduleLanguageRefresh() {
    if (state.language === 'id') return;

    if (state.translationDebounceTimer) {
      clearTimeout(state.translationDebounceTimer);
    }

    state.translationDebounceTimer = setTimeout(() => {
      state.translationDebounceTimer = null;
      // requestId hanya berubah saat user ganti bahasa, bukan saat pindah layar.
      const requestId = state.languageRequestId;
      const missingMap = collectMissingTranslations(state.language, { scope: 'active' });
      translateMissingTexts(state.language, missingMap, requestId).catch((error) => {
        if (requestId !== state.languageRequestId || state.language === 'id') return;
        const msg = (error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 90);
        showToast(`${tr('toastTranslateErrorPrefix')}: ${msg}`);
      });
    }, 140);
  }

  function applyLanguage(lang, options = {}) {
    const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'id';
    const resetChat = options.resetChat !== false;
    const requestId = ++state.languageRequestId;

    state.language = safeLang;
    localStorage.setItem('midea_lang', safeLang);
    document.documentElement.lang = safeLang === 'zh' ? 'zh-CN' : safeLang;
    if (safeLang !== 'id') purgeWeakUnchangedCache(safeLang);

    const initialScope = 'all';
    const missingMap = collectMissingTranslations(safeLang, { scope: initialScope });
    updateLanguageButtons();

    if (resetChat) {
      initChatHistory();
    }

    setChatMode(state.chatMode);
    syncVideoGalleryLanguage();
    refreshChapterActionLabels();

    if (safeLang !== 'id') {
      translateMissingTexts(safeLang, missingMap, requestId).catch((error) => {
        if (requestId !== state.languageRequestId || state.language !== safeLang) return;
        const msg = (error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 90);
        showToast(`${tr('toastTranslateErrorPrefix')}: ${msg}`);
      });
      pretranslateAllScreensInBackground(requestId);
    }
  }

  function getProfileCardHtml() {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1E1E2E;">${tr('profileTitle')}</div>
        <button id="profile-close-btn" style="border:0;background:#F3F4F6;width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="font-size:12px;color:#6B6B80;margin-bottom:14px;">${tr('profileSummary')}</div>
      <div style="background:#FAFAFB;border:1px solid #E8E4DF;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:12px;">
        <div style="width:42px;height:42px;border-radius:12px;background:#D72638;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">MR</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1E1E2E;">${tr('profileMember')}</div>
          <div style="font-size:11px;color:#6B6B80;">ID: MID-USER-2026</div>
        </div>
      </div>
      <div style="display:grid;gap:8px;">
        <button style="padding:11px 12px;border-radius:11px;border:1.5px solid #E8E4DF;background:#fff;text-align:left;cursor:pointer;font-size:12px;">${tr('profileChatHistory')}</button>
        <button style="padding:11px 12px;border-radius:11px;border:1.5px solid #E8E4DF;background:#fff;text-align:left;cursor:pointer;font-size:12px;">${tr('profileRegisteredProducts')}</button>
        <button style="padding:11px 12px;border-radius:11px;border:1.5px solid #E8E4DF;background:#fff;text-align:left;cursor:pointer;font-size:12px;">${tr('profileLanguageSettings')}</button>
      </div>
    `;
  }

  function openProfilePanel() {
    let panel = document.getElementById('profile-overlay');

    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'profile-overlay';
      panel.style.position = 'fixed';
      panel.style.inset = '0';
      panel.style.background = 'rgba(0,0,0,0.45)';
      panel.style.backdropFilter = 'blur(4px)';
      panel.style.display = 'none';
      panel.style.alignItems = 'center';
      panel.style.justifyContent = 'center';
      panel.style.zIndex = '9998';

      const card = document.createElement('div');
      card.id = 'profile-overlay-card';
      card.style.width = 'min(360px, 92vw)';
      card.style.background = '#fff';
      card.style.borderRadius = '20px';
      card.style.padding = '18px';
      card.style.boxShadow = '0 20px 40px rgba(0,0,0,0.28)';
      card.style.fontFamily = 'DM Sans, sans-serif';

      panel.appendChild(card);
      document.body.appendChild(panel);

      panel.addEventListener('click', (e) => {
        if (e.target === panel) {
          panel.style.display = 'none';
        }
      });
    }

    const card = panel.querySelector('#profile-overlay-card');
    card.innerHTML = getProfileCardHtml();
    card.querySelector('#profile-close-btn')?.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    panel.style.display = 'flex';
  }

  function applyThumbnailToCard(card, thumbData) {
    if (!card || !card.isConnected || !thumbData) return;
    const thumbEl = card.querySelector('.video-gallery-thumb');
    if (!thumbEl) return;
    if (thumbData.dataUrl) {
      thumbEl.style.backgroundImage = `url(${thumbData.dataUrl})`;
    }
    const durationEl = card.querySelector('.video-duration');
    if (durationEl) {
      durationEl.textContent = formatDuration(thumbData.duration) || '';
    }
  }

  function hydrateVideoGalleryThumbnails(listEl) {
    if (!listEl) return;

    const cards = listEl.querySelectorAll('.gallery-video-card');
    cards.forEach((card) => {
      const src = card.getAttribute('data-video-src') || '';
      if (!src) return;
      const driveId = extractDriveFileId(src);
      const explicitThumb = card.getAttribute('data-video-thumb') || '';
      const thumbUrl = explicitThumb || (driveId ? toDriveThumbUrl(driveId) : '');
      if (thumbUrl) {
        const thumbEl = card.querySelector('.video-gallery-thumb');
        if (thumbEl) thumbEl.style.backgroundImage = `url(${thumbUrl})`;
      }
      if (driveId) {
        const durationEl = card.querySelector('.video-duration');
        if (durationEl) durationEl.textContent = '';
        return;
      }

      const cached = videoThumbCache[src];
      if (cached && cached.ready) {
        applyThumbnailToCard(card, cached.payload);
        return;
      }

      if (cached && cached.promise) {
        cached.promise.then((payload) => applyThumbnailToCard(card, payload)).catch(() => {});
        return;
      }

      const promise = captureVideoThumbnail(src, 1).then((payload) => {
        const safePayload = payload || { dataUrl: '', duration: 0 };
        videoThumbCache[src] = { ready: true, payload: safePayload };
        return safePayload;
      });

      videoThumbCache[src] = { ready: false, promise };
      promise.then((payload) => applyThumbnailToCard(card, payload)).catch(() => {});
    });
  }

  function renderVideoGallery() {
    if (!hasScreen(SCREEN.VIDEO_GALLERY)) return;
    const screen = wraps[SCREEN.VIDEO_GALLERY];
    if (!screen) return;

    const listEl = screen.querySelector('#video-gallery-list');
    const emptyEl = screen.querySelector('#video-gallery-empty');
    const countEl = screen.querySelector('#video-gallery-count');
    const input = screen.querySelector('#video-gallery-search');
    if (!listEl || !emptyEl) return;

    const query = (input?.value || '').trim().toLowerCase();
    const filtered = VIDEO_LIBRARY.filter((item) => {
      if (!query) return true;
      const title = langValue(item.title).toLowerCase();
      const desc = langValue(item.description).toLowerCase();
      const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
      return `${title} ${desc} ${tags}`.includes(query);
    });

    listEl.innerHTML = '';
    filtered.forEach((item) => {
      const title = langValue(item.title);
      const desc = langValue(item.description);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'video-card video-open-btn gallery-video-card';
      card.setAttribute('data-video-src', item.src);
      card.setAttribute('data-video-title', title);
      if (item.thumb) card.setAttribute('data-video-thumb', item.thumb);
      card.innerHTML = `
        <div class="video-gallery-thumb">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="2">
            <polygon points="9 7 18 12 9 17 9 7" fill="rgba(255,255,255,0.92)" stroke="none"></polygon>
            <rect x="3" y="5" width="18" height="14" rx="3"></rect>
          </svg>
          <span class="video-duration"></span>
        </div>
        <div class="video-meta">
          <div class="video-title">${title}</div>
          <div class="video-desc">${desc}</div>
        </div>
        <div class="video-open">${tr('videoPlayNow')}</div>
      `;
      listEl.appendChild(card);
    });

    emptyEl.textContent = tr('galleryEmpty');
    emptyEl.style.display = filtered.length ? 'none' : 'block';
    if (countEl) {
      const n = filtered.length;
      countEl.textContent = `${n} ${tr('videoCountUnit')}`;
    }
    hydrateVideoGalleryThumbnails(listEl);
  }

  function syncVideoGalleryLanguage() {
    if (!hasScreen(SCREEN.VIDEO_GALLERY)) return;
    const screen = wraps[SCREEN.VIDEO_GALLERY];
    if (!screen) return;
    const input = screen.querySelector('#video-gallery-search');
    if (input) input.placeholder = tr('gallerySearchPlaceholder');
    renderVideoGallery();
  }

  function closeVideoPlayer() {
    const overlay = document.getElementById('video-player-overlay');
    const player = document.getElementById('video-player');
    const frame = document.getElementById('video-player-frame');
    if (!overlay || !player || !frame) return;
    player.pause();
    player.removeAttribute('src');
    player.load();
    frame.removeAttribute('src');
    frame.style.display = 'none';
    player.style.display = 'block';
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function openVideoPlayer(src, title) {
    const safeSrc = String(src || '').trim();
    if (!safeSrc) return;
    const resolvedSrc = resolveAssetUrl(safeSrc);
    const driveId = extractDriveFileId(resolvedSrc);
    const youtubeId = extractYouTubeVideoId(resolvedSrc);
    const overlay = document.getElementById('video-player-overlay');
    const player = document.getElementById('video-player');
    const frame = document.getElementById('video-player-frame');
    const titleEl = document.getElementById('video-player-title');

    // Jika overlay player tidak ada di HTML, tetap buka video di tab baru.
    if (!overlay || !player || !frame) {
      const fallbackUrl = driveId
        ? toDrivePreviewUrl(driveId)
        : youtubeId
          ? `https://youtu.be/${youtubeId}`
          : resolvedSrc;
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (titleEl) titleEl.textContent = title || tr('videoTitleDefault');
    if (driveId || youtubeId) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.style.display = 'none';
      frame.style.display = 'block';
      frame.src = driveId ? toDrivePreviewUrl(driveId) : toYouTubeEmbedUrl(youtubeId);
    } else {
      frame.removeAttribute('src');
      frame.style.display = 'none';
      player.style.display = 'block';
      player.src = resolvedSrc;
    }
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');

    if (!driveId && !youtubeId) {
      const playPromise = player.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }
  }

  function wireVideoPlayer() {
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('.video-open-btn');
      if (!btn) return;
      const src = btn.getAttribute('data-video-src') || '';
      const cardTitle = btn.querySelector('.video-title')?.textContent?.trim();
      const title = cardTitle || btn.getAttribute('data-video-title') || btn.textContent.trim();
      openVideoPlayer(src, title);
    });

    const closeButtons = document.querySelectorAll('[data-video-close]');
    closeButtons.forEach((btn) => {
      btn.addEventListener('click', closeVideoPlayer);
    });

    const player = document.getElementById('video-player');
    const overlay = document.getElementById('video-player-overlay');
    if (player) {
      player.addEventListener('error', () => {
        showToast(tr('toastVideoLoadError'));
      });
    }
    if (overlay) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeVideoPlayer();
      });
    }

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeVideoPlayer();
      }
    });
  }

  function wireVideoGallery() {
    if (!hasScreen(SCREEN.VIDEO_GALLERY)) return;
    const galleryWrap = wraps[SCREEN.VIDEO_GALLERY];
    if (!galleryWrap) return;

    const backBtn = galleryWrap.querySelector('.back-btn');
    const searchInput = galleryWrap.querySelector('#video-gallery-search');
    const refreshBtn = galleryWrap.querySelector('#video-gallery-refresh-btn');
    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
    if (searchInput) {
      searchInput.addEventListener('input', () => renderVideoGallery());
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        renderVideoGallery();
        showToast(tr('toastVideoGalleryRefreshed'));
      });
    }

    bindBottomNav(galleryWrap);

    syncVideoGalleryLanguage();
  }

  // expose globally to support existing inline onclick attributes
  window.openChapter = function (num) {
    const target = CHAPTER_SCREENS[Number(num) - 1];
    if (typeof target === 'number') {
      goToScreen(target);
    }
  };

  window.closeChapter = function () {
    goToScreen(SCREEN.PANDUAN);
  };

  function wireSplash() {
    const splash = wraps[SCREEN.SPLASH];
    const langBtns = splash.querySelectorAll('.lang-btn');
    const continueBtn = splash.querySelector('.lang-continue');
    const fallbackLangByIndex = ['id', 'en', 'zh'];

    langBtns.forEach((btn, index) => {
      if (!btn.dataset.lang) {
        btn.dataset.lang = fallbackLangByIndex[index] || 'id';
      }
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => {
        const code = btn.dataset.lang || 'id';
        langBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        applyLanguage(code, { resetChat: true });
      });
    });

    if (continueBtn) {
      continueBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    }
  }

  function setChatMode(mode) {
    const safeMode = mode === 'recipe' ? 'recipe' : 'support';
    state.chatMode = safeMode;

    const screen = wraps[SCREEN.TANYA];
    if (!screen) return;

    const titleEl =
      screen.querySelector('.sub-header-title') ||
      screen.querySelector('#screen-tanya .tanya-header .sub-header-title') ||
      null;
    const subEl =
      screen.querySelector('.sub-header-sub') ||
      screen.querySelector('#screen-tanya .tanya-header .sub-header-sub') ||
      null;
    const input = screen.querySelector('.chat-input');

    if (titleEl) {
      titleEl.textContent = chatText(safeMode, 'title');
    }
    if (subEl) {
      subEl.textContent = chatText(safeMode, 'subtitle');
    }
    if (titleEl && titleEl.firstChild && titleEl.firstChild.nodeType === Node.TEXT_NODE) {
      titleEl.firstChild.__baseText = titleEl.firstChild.nodeValue;
    }
    if (subEl && subEl.firstChild && subEl.firstChild.nodeType === Node.TEXT_NODE) {
      subEl.firstChild.__baseText = subEl.firstChild.nodeValue;
    }
    if (input) input.placeholder = chatText(safeMode, 'placeholder');

    renderChat();
  }

  function openSupportChat() {
    setChatMode('support');
    goToScreen(SCREEN.TANYA);
  }

  // Expose global handler so HTML-level fallback can always call this.
  window.__mideaOpenSupportChat = openSupportChat;

  function openRecipeChat() {
    setChatMode('recipe');
    goToScreen(SCREEN.TANYA);
  }

  function wireHome() {
    const home = wraps[SCREEN.HOME];
    const controlCard = home.querySelector('.card-control');
    const panduanCard = home.querySelector('.card-panduan');
    const tanyaCard = home.querySelector('.card-tanya');
    const resepCard = home.querySelector('.card-resep');
    const notifBtn = home.querySelector('.home-notif-btn');

    if (controlCard) controlCard.addEventListener('click', openControlScreen);
    if (panduanCard) {
      panduanCard.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
    }
    if (tanyaCard) tanyaCard.addEventListener('click', openSupportChat);
    if (resepCard) resepCard.addEventListener('click', openRecipeScreen);
    if (notifBtn) {
      notifBtn.addEventListener('click', openAlertsScreen);
    }

    bindBottomNav(home);
  }

  function wireGlobalSupportFallback() {
    if (document.body.dataset.mideaSupportFallbackBound === '1') return;
    document.body.dataset.mideaSupportFallbackBound = '1';

    document.addEventListener('click', (event) => {
      const helpNav = event.target.closest('.nav-item[data-nav="help"], .nav-item[data-nav="bantuan"]');
      if (helpNav) {
        routeBottomNav(helpNav.getAttribute('data-nav') || 'help');
        return;
      }

      const tanyaCard = event.target.closest('.card-tanya');
      if (tanyaCard && tanyaCard.closest('#screen-home')) {
        openSupportChat();
      }
    });
  }

  function wirePanduanList() {
    const panduan = wraps[SCREEN.PANDUAN];
    if (!panduan) return;
    const backBtn = panduan.querySelector('.back-btn');
    const chapterCards = panduan.querySelectorAll('.chapter-card');
    const openBookBtn = panduan.querySelector('.open-guide-book-btn');
    const openGalleryBtn =
      panduan.querySelector('.open-video-gallery-btn') || panduan.querySelector('.open-guide-video-btn');

    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    if (openBookBtn) {
      openBookBtn.addEventListener('click', () => {
        const sectionTitles = Array.from(panduan.querySelectorAll('.section-title'));
        const tocHeading =
          sectionTitles.find((el) => /daftar isi|table of contents|目录/i.test(el.textContent || '')) ||
          sectionTitles[0] ||
          null;
        if (tocHeading) {
          tocHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    if (openGalleryBtn) {
      openGalleryBtn.addEventListener('click', () => {
        if (hasScreen(SCREEN.VIDEO_GALLERY)) {
          const galleryScreen = wraps[SCREEN.VIDEO_GALLERY];
          const gallerySearch = galleryScreen?.querySelector('#video-gallery-search');
          if (gallerySearch) gallerySearch.value = '';
          goToScreen(SCREEN.VIDEO_GALLERY);
          renderVideoGallery();
          return;
        }
        if (hasScreen(SCREEN.RECIPE)) {
          goToScreen(SCREEN.RECIPE);
          return;
        }
        const firstVideo = VIDEO_LIBRARY[0];
        if (firstVideo?.src) {
          openVideoPlayer(firstVideo.src, langValue(firstVideo.title));
          return;
        }
        showToast(tr('toastVideoNotAvailable'));
      });
    }

    chapterCards.forEach((card, i) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => window.openChapter(i + 1));
    });

    bindBottomNav(panduan);
  }

  function wireControlScreen() {
    const control = wraps[SCREEN.CONTROL];
    if (!control) return;
    const backBtn = control.querySelector('.back-btn');
    const powerBtn = control.querySelector('#control-power-btn, .big-toggle');
    const modeChips = Array.from(control.querySelectorAll('.mode-chip'));
    const timerValueEl = control.querySelector('#control-timer-value');
    const timerMinusBtn = control.querySelector('.control-timer-minus');
    const timerPlusBtn = control.querySelector('.control-timer-plus');
    const pauseBtn = control.querySelector('.control-pause-btn');
    const stopBtn = control.querySelector('.control-stop-btn');

    const initialTimer = parseInt((timerValueEl?.textContent || '').replace(/[^\d]/g, ''), 10);
    const controlState = {
      power: Boolean(powerBtn?.classList.contains('on')),
      paused: false,
      timer: Number.isFinite(initialTimer) ? initialTimer : 28,
      mode:
        modeChips.find((chip) => chip.classList.contains('active'))?.dataset.mode ||
        modeChips[0]?.dataset.mode ||
        '',
    };

    const renderControlUI = () => {
      if (powerBtn) {
        powerBtn.classList.toggle('on', controlState.power);
        powerBtn.style.opacity = controlState.power ? '1' : '0.62';
      }
      if (timerValueEl) timerValueEl.textContent = String(Math.max(0, controlState.timer));
      if (pauseBtn) {
        pauseBtn.textContent = controlState.paused ? tr('controlResume') : tr('controlPause');
      }
      modeChips.forEach((chip) => {
        const mode = chip.dataset.mode || chip.textContent.trim();
        chip.classList.toggle('active', mode === controlState.mode);
      });
    };

    if (backBtn) {
      backBtn.style.cursor = 'pointer';
      backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    }
    if (powerBtn) {
      powerBtn.addEventListener('click', () => {
        controlState.power = !controlState.power;
        if (!controlState.power) controlState.paused = false;
        renderControlUI();
        showToast(controlState.power ? tr('toastControlOn') : tr('toastControlOff'));
      });
    }
    if (timerMinusBtn) {
      timerMinusBtn.addEventListener('click', () => {
        controlState.timer = Math.max(0, controlState.timer - 1);
        renderControlUI();
      });
    }
    if (timerPlusBtn) {
      timerPlusBtn.addEventListener('click', () => {
        controlState.timer = Math.min(240, controlState.timer + 1);
        renderControlUI();
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (!controlState.power) {
          showToast(tr('toastControlPowerRequired'));
          return;
        }
        controlState.paused = !controlState.paused;
        renderControlUI();
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        controlState.power = false;
        controlState.paused = false;
        controlState.timer = 0;
        renderControlUI();
        showToast(tr('toastControlStopped'));
      });
    }
    modeChips.forEach((chip) => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const mode = chip.dataset.mode || chip.textContent.trim();
        controlState.mode = mode;
        renderControlUI();
        if (mode) showToast(tr('toastControlModeActive').replace('{mode}', mode));
      });
    });

    renderControlUI();
    bindBottomNav(control);
  }

  function wireAlertsScreen() {
    if (!hasScreen(SCREEN.ALERTS)) return;
    const alerts = wraps[SCREEN.ALERTS];
    if (!alerts) return;
    const backBtn = alerts.querySelector('.back-btn');
    if (backBtn) {
      backBtn.style.cursor = 'pointer';
      backBtn.addEventListener('click', () => {
        if (hasScreen(SCREEN.CONTROL)) {
          goToScreen(SCREEN.CONTROL);
          return;
        }
        goToScreen(SCREEN.HOME);
      });
    }
    bindBottomNav(alerts);
  }

  function wireRecipeScreen() {
    const recipe = wraps[SCREEN.RECIPE];
    if (!recipe) return;
    const backBtn = recipe.querySelector('.back-btn');
    const openRecipeChatBtn = recipe.querySelector('#open-recipe-chat-btn');
    if (backBtn) {
      backBtn.style.cursor = 'pointer';
      backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    }
    if (openRecipeChatBtn) {
      openRecipeChatBtn.addEventListener('click', openRecipeChat);
    }
    bindBottomNav(recipe);
  }

  function getCurrentHistory() {
    return state.chatHistory[state.chatMode];
  }

  function appendHistory(role, content) {
    const history = getCurrentHistory();
    history.push({ role, content });

    // cap history supaya payload tetap ringan
    if (history.length > 24) {
      const keepFirst = history[0];
      state.chatHistory[state.chatMode] = [keepFirst, ...history.slice(-23)];
    }
  }

  function buildBotNode(text) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="chat-meta">
        <div class="chat-avatar">
          <svg viewBox="0 0 38 38" fill="none" width="12" height="12">
            <path d="M8 28 C8 28 10 16 19 12 C28 8 30 16 30 16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="19" cy="22" r="7" stroke="white" stroke-width="2.5"/>
            <circle cx="19" cy="22" r="2.5" fill="white"/>
          </svg>
        </div>
        <span class="chat-sender">${chatText(state.chatMode, 'sender')}</span>
        <span class="chat-time">${nowTimeText()}</span>
      </div>
    `;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    return wrapper;
  }

  function buildUserNode(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.textContent = text;
    return bubble;
  }

  function renderQuickButtons(container) {
    const quickWrap = document.createElement('div');
    quickWrap.className = 'chat-quick-btns';

    chatText(state.chatMode, 'quick').forEach((label) => {
      const btn = document.createElement('button');
      btn.className = 'quick-btn';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const input = wraps[SCREEN.TANYA].querySelector('.chat-input');
        if (!input || state.chatBusy) return;
        input.value = label;
        sendMessage();
      });
      quickWrap.appendChild(btn);
    });

    container.appendChild(quickWrap);
  }

  function renderChat() {
    const tanya = wraps[SCREEN.TANYA];
    const chatArea = tanya.querySelector('.chat-area');
    const history = getCurrentHistory();
    chatArea.innerHTML = '';

    history.forEach((msg, index) => {
      if (msg.role === 'assistant') {
        const node = buildBotNode(msg.content);
        chatArea.appendChild(node);

        if (index === history.length - 1) {
          const botBubble = node.querySelector('.chat-bubble.bot');
          renderQuickButtons(botBubble);
        }
      } else {
        chatArea.appendChild(buildUserNode(msg.content));
      }
    });

    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function makeFallbackReply(message) {
    const text = message.toLowerCase();

    if (state.chatMode === 'recipe') {
      if (text.includes('air fryer')) {
        return tr('fallbackRecipeAirfryer');
      }
      return tr('fallbackRecipeGeneral');
    }

    if (text.includes('garansi') || text.includes('warranty')) {
      return tr('fallbackWarranty');
    }
    if (text.includes('service') || text.includes('servis')) {
      return tr('fallbackService');
    }

    return tr('fallbackGeneric');
  }

  async function fetchGptReply() {
    const history = getCurrentHistory();
    const payload = {
      mode: state.chatMode,
      lang: state.language,
      messages: history.slice(-12),
    };
    const result = await postJsonWithFallback('chat', payload);
    return result.reply;
  }

  async function sendMessage() {
    if (state.chatBusy) return;

    const tanya = wraps[SCREEN.TANYA];
    const input = tanya.querySelector('.chat-input');
    const sendBtn = tanya.querySelector('.send-btn');
    const text = (input?.value || '').trim();

    if (!text) return;

    appendHistory('user', text);
    input.value = '';
    state.chatBusy = true;
    if (sendBtn) sendBtn.disabled = true;
    renderChat();

    try {
      const reply = await fetchGptReply();
      appendHistory('assistant', reply);
    } catch (error) {
      console.error(error);
      appendHistory('assistant', makeFallbackReply(text));
      const msg = (error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 90);
      showToast(`${tr('toastChatErrorPrefix')}: ${msg}`);
    } finally {
      state.chatBusy = false;
      if (sendBtn) sendBtn.disabled = false;
      renderChat();
    }
  }

  function wireTanyaKami() {
    const tanya = wraps[SCREEN.TANYA];
    const backBtn = tanya.querySelector('.back-btn');
    const input = tanya.querySelector('.chat-input');
    const sendBtn = tanya.querySelector('.send-btn');

    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    if (input) input.removeAttribute('readonly');

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    setChatMode('support');
  }

  function getNextChapterMainLabel(chapterPos) {
    return chapterPos < CHAPTER_SCREENS.length - 1 ? tr('chapterNext') : tr('chapterToc');
  }

  function getPrevChapterMainLabel(chapterPos) {
    return chapterPos > 0 ? tr('chapterPrevious') : tr('chapterToc');
  }

  function refreshChapterActionLabels() {
    CHAPTER_SCREENS.forEach((screenIdx, chapterPos) => {
      const chapter = wraps[screenIdx];
      if (!chapter) return;

      const nextActionBtn = chapter.querySelector('.dab-next');
      if (nextActionBtn) {
        nextActionBtn.textContent = getNextChapterMainLabel(chapterPos);
      }

      const bookmarkBtn = chapter.querySelector('.dab-bookmark');
      if (bookmarkBtn) {
        bookmarkBtn.innerHTML = `<span style="font-size:13px;font-weight:700;color:#1E3A5F;">${getPrevChapterMainLabel(chapterPos)}</span>`;
      }
    });
  }

  function wireChapterDetails() {
    CHAPTER_SCREENS.forEach((screenIdx, chapterPos) => {
      const chapter = wraps[screenIdx];
      const backBtn = chapter.querySelector('.back-btn');
      const navBtns = chapter.querySelectorAll('.chapter-nav-btns .cnav-btn');
      const prevBtn = navBtns[0];
      const nextBtn = navBtns[1];
      const nextActionBtn = chapter.querySelector('.dab-next');
      const bookmarkBtn = chapter.querySelector('.dab-bookmark');

      if (backBtn) {
        backBtn.style.cursor = 'pointer';
        backBtn.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
      }

      if (prevBtn && !prevBtn.classList.contains('disabled') && chapterPos > 0) {
        prevBtn.style.cursor = 'pointer';
        prevBtn.addEventListener('click', () => goToScreen(CHAPTER_SCREENS[chapterPos - 1]));
      }

      if (
        nextBtn &&
        !nextBtn.classList.contains('disabled') &&
        chapterPos < CHAPTER_SCREENS.length - 1
      ) {
        nextBtn.style.cursor = 'pointer';
        nextBtn.addEventListener('click', () => goToScreen(CHAPTER_SCREENS[chapterPos + 1]));
      }

      if (nextActionBtn) {
        nextActionBtn.style.cursor = 'pointer';
        nextActionBtn.addEventListener('click', () => {
          if (chapterPos < CHAPTER_SCREENS.length - 1) {
            goToScreen(CHAPTER_SCREENS[chapterPos + 1]);
          } else {
            goToScreen(SCREEN.PANDUAN);
          }
        });
      }

      if (bookmarkBtn) {
        bookmarkBtn.style.cursor = 'pointer';
        bookmarkBtn.style.width = 'auto';
        bookmarkBtn.style.height = 'auto';
        bookmarkBtn.style.flex = '1';
        bookmarkBtn.style.borderRadius = '11px';
        bookmarkBtn.style.padding = '12px 12px';
        bookmarkBtn.style.display = 'flex';
        bookmarkBtn.style.alignItems = 'center';
        bookmarkBtn.style.justifyContent = 'center';
        bookmarkBtn.style.gap = '8px';
        bookmarkBtn.style.border = '1.5px solid rgba(30,58,95,0.22)';
        bookmarkBtn.style.background = '#fff';

        bookmarkBtn.addEventListener('click', () => {
          if (chapterPos > 0) {
            goToScreen(CHAPTER_SCREENS[chapterPos - 1]);
          } else {
            goToScreen(SCREEN.PANDUAN);
          }
        });
      }
    });

    refreshChapterActionLabels();
  }

  initChatHistory();
  wireSplash();
  wireHome();
  wirePanduanList();
  wireControlScreen();
  wireAlertsScreen();
  wireRecipeScreen();
  wireVideoGallery();
  wireVideoPlayer();
  wireTanyaKami();
  wireGlobalSupportFallback();
  wireChapterDetails();

  const observer = new MutationObserver((mutations) => {
    let hasAddedNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        hasAddedNodes = true;
        break;
      }
    }
    if (hasAddedNodes) scheduleLanguageRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // debug helper: cek sisa teks yang belum punya terjemahan runtime
  window.mideaTranslationAudit = function () {
    const missingMap = collectMissingTranslations(state.language, { scope: 'all' });
    const sample = Array.from(missingMap.keys()).slice(0, 25);
    return {
      version: NAV_VERSION,
      language: state.language,
      missingCount: missingMap.size,
      sample,
    };
  };

  // debug helper: paksa translate ulang semua layar untuk bahasa aktif/non-id
  window.mideaForceRetranslate = function (lang) {
    const target = SUPPORTED_LANGS.includes(lang) ? lang : state.language;
    if (target === 'id') {
      applyLanguage('id', { resetChat: false });
      return { ok: true, language: 'id', action: 'reset-to-id' };
    }

    state.runtimeTranslationCache[target] = Object.create(null);
    const requestId = ++state.languageRequestId;
    state.language = target;
    localStorage.setItem('midea_lang', target);
    document.documentElement.lang = target === 'zh' ? 'zh-CN' : target;

    const missingMap = collectMissingTranslations(target, { scope: 'all' });
    translateMissingTexts(target, missingMap, requestId)
      .then(() => pretranslateAllScreensInBackground(requestId))
      .catch((error) => {
        const msg = (error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 90);
        showToast(`${tr('toastTranslateErrorPrefix')}: ${msg}`);
      });

    return { ok: true, language: target, queued: missingMap.size };
  };

  goToScreen(SCREEN.SPLASH);
  applyLanguage(state.language, { resetChat: true });
})();
