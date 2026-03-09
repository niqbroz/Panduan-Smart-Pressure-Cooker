(function () {
  const NAV_VERSION = 'lang-sync-2026-03-09-v11';
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
    PANDUAN: screenIndexBySelector('#screen-panduan', 2),
    TANYA: screenIndexBySelector('#screen-tanya', 3),
  };
  SCREEN.VIDEO_GALLERY = screenIndexBySelector('#screen-video-gallery', SCREEN.PANDUAN);

  const CHAPTER_SCREENS = wraps
    .map((wrap, idx) => (wrap.querySelector('.chapter-progress-bar') ? idx : -1))
    .filter((idx) => idx >= 0);

  // default same-origin agar tetap jalan saat diakses via IP LAN device lain
  const CHAT_API_URL = window.MIDEA_CHAT_API_URL || '/api/chat';

  function deriveTranslateApiUrl(chatUrl) {
    if (window.MIDEA_TRANSLATE_API_URL) return window.MIDEA_TRANSLATE_API_URL;
    if (/\/api\/chat\/?$/.test(chatUrl)) {
      return chatUrl.replace(/\/api\/chat\/?$/, '/api/translate-ui');
    }
    return '/api/translate-ui';
  }

  const TRANSLATE_API_URL = deriveTranslateApiUrl(CHAT_API_URL);
  const SUPPORTED_LANGS = ['id', 'en', 'zh'];

  const UI_TEXT = {
    id: {
      toastChatErrorPrefix: 'ChatGPT gagal',
      toastBookmark: 'Bab ditandai (bookmark).',
      toastBackChapter: 'Kembali ke bab sebelumnya.',
      toastBackToToc: 'Kembali ke daftar isi.',
      profileTitle: 'Profil Saya',
      profileSummary: 'Ringkasan akun aplikasi Midea',
      profileMember: 'Member Midea',
      profileChatHistory: 'Riwayat Chat Bantuan',
      profileRegisteredProducts: 'Produk Terdaftar',
      profileLanguageSettings: 'Pengaturan Bahasa',
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
      toastBookmark: 'Chapter bookmarked.',
      toastBackChapter: 'Returned to previous chapter.',
      toastBackToToc: 'Back to table of contents.',
      profileTitle: 'My Profile',
      profileSummary: 'Midea app account summary',
      profileMember: 'Midea Member',
      profileChatHistory: 'Support Chat History',
      profileRegisteredProducts: 'Registered Products',
      profileLanguageSettings: 'Language Settings',
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
      toastBookmark: '章节已收藏。',
      toastBackChapter: '已返回上一章节。',
      toastBackToToc: '已返回目录。',
      profileTitle: '我的资料',
      profileSummary: 'Midea 应用账号概览',
      profileMember: '美的会员',
      profileChatHistory: '客服聊天记录',
      profileRegisteredProducts: '已注册产品',
      profileLanguageSettings: '语言设置',
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
      'Layar 13 · Galeri Video': 'Screen 13 · Video Gallery',
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
      'Layar 13 · Galeri Video': '第 13 屏 · 视频库',
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

  function translateStaticText(baseText, lang) {
    if (lang === 'id') return baseText;

    const dict = STATIC_TEXT_MAP[lang] || {};
    const trimmed = baseText.trim();
    if (!trimmed) return baseText;

    const translated = dict[trimmed];
    if (!translated || translated === trimmed) return baseText;

    return baseText.replace(trimmed, translated);
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
    if (typeof idx !== 'number' || idx < 0 || idx >= wraps.length) return;

    wraps.forEach((wrap, i) => {
      wrap.style.display = i === idx ? 'flex' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
    scheduleLanguageRefresh();
  }

  async function fetchUiTranslationsChunk(lang, texts) {
    const response = await fetch(TRANSLATE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang, texts }),
    });

    if (!response.ok) {
      let detail = `API ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error) detail = String(errJson.error);
      } catch (_err) {
        const errText = await response.text().catch(() => '');
        if (errText) detail = `${detail}: ${errText}`;
      }
      throw new Error(detail);
    }

    const data = await response.json();
    if (!Array.isArray(data?.translations)) {
      throw new Error('Format respons translate tidak valid.');
    }
    return data.translations.map((v) => (typeof v === 'string' ? v : ''));
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
        showToast(`Terjemahan gagal: ${msg}`);
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

    const initialScope = safeLang === 'id' ? 'all' : 'active';
    const missingMap = collectMissingTranslations(safeLang, { scope: initialScope });
    updateLanguageButtons();

    if (resetChat) {
      initChatHistory();
    }

    setChatMode(state.chatMode);
    syncVideoGalleryLanguage();

    if (safeLang !== 'id') {
      translateMissingTexts(safeLang, missingMap, requestId).catch((error) => {
        if (requestId !== state.languageRequestId || state.language !== safeLang) return;
        const msg = (error?.message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 90);
        showToast(`Terjemahan gagal: ${msg}`);
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
    const screen = wraps[SCREEN.VIDEO_GALLERY];
    if (!screen) return;

    const listEl = screen.querySelector('#video-gallery-list');
    const emptyEl = screen.querySelector('#video-gallery-empty');
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
        <div class="video-open">Play</div>
      `;
      listEl.appendChild(card);
    });

    emptyEl.textContent = tr('galleryEmpty');
    emptyEl.style.display = filtered.length ? 'none' : 'block';
    hydrateVideoGalleryThumbnails(listEl);
  }

  function syncVideoGalleryLanguage() {
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
    const overlay = document.getElementById('video-player-overlay');
    const player = document.getElementById('video-player');
    const frame = document.getElementById('video-player-frame');
    const titleEl = document.getElementById('video-player-title');
    if (!overlay || !player || !frame) return;

    const safeSrc = String(src || '').trim();
    if (!safeSrc) return;
    const resolvedSrc = resolveAssetUrl(safeSrc);
    const driveId = extractDriveFileId(resolvedSrc);

    if (titleEl) titleEl.textContent = title || 'Video Panduan';
    if (driveId) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.style.display = 'none';
      frame.style.display = 'block';
      frame.src = toDrivePreviewUrl(driveId);
    } else {
      frame.removeAttribute('src');
      frame.style.display = 'none';
      player.style.display = 'block';
      player.src = resolvedSrc;
    }
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');

    if (!driveId) {
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
    if (player) {
      player.addEventListener('error', () => {
        showToast('Video gagal dimuat. Cek izin akses file Google Drive.');
      });
    }

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeVideoPlayer();
      }
    });
  }

  function wireVideoGallery() {
    const galleryWrap = wraps[SCREEN.VIDEO_GALLERY];
    if (!galleryWrap) return;

    const backBtn = galleryWrap.querySelector('.back-btn');
    const searchInput = galleryWrap.querySelector('#video-gallery-search');
    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
    if (searchInput) {
      searchInput.addEventListener('input', () => renderVideoGallery());
    }

    const navItems = galleryWrap.querySelectorAll('.bottom-nav .nav-item');
    const actions = [
      () => goToScreen(SCREEN.HOME),
      () => goToScreen(SCREEN.PANDUAN),
      () => openSupportChat(),
      () => openProfilePanel(),
    ];
    navItems.forEach((item, index) => {
      item.style.cursor = 'pointer';
      if (actions[index]) item.addEventListener('click', actions[index]);
    });

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

    langBtns.forEach((btn) => {
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
    const titleEl = screen.querySelector('.sub-header-title');
    const subEl = screen.querySelector('.sub-header-sub');
    const input = screen.querySelector('.chat-input');

    titleEl.textContent = chatText(safeMode, 'title');
    subEl.textContent = chatText(safeMode, 'subtitle');
    if (titleEl.firstChild && titleEl.firstChild.nodeType === Node.TEXT_NODE) {
      titleEl.firstChild.__baseText = titleEl.firstChild.nodeValue;
    }
    if (subEl.firstChild && subEl.firstChild.nodeType === Node.TEXT_NODE) {
      subEl.firstChild.__baseText = subEl.firstChild.nodeValue;
    }
    if (input) input.placeholder = chatText(safeMode, 'placeholder');

    renderChat();
  }

  function openSupportChat() {
    setChatMode('support');
    goToScreen(SCREEN.TANYA);
  }

  function openRecipeChat() {
    setChatMode('recipe');
    goToScreen(SCREEN.TANYA);
  }

  function wireHome() {
    const home = wraps[SCREEN.HOME];
    const panduanCard = home.querySelector('.card-panduan');
    const tanyaCard = home.querySelector('.card-tanya');
    const resepCard = home.querySelector('.card-resep');

    if (panduanCard) {
      panduanCard.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
      // pastikan area icon/arrow di dalam kartu tetap trigger aksi yang sama
      panduanCard.querySelectorAll('*').forEach((el) => {
        el.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
      });
    }
    if (tanyaCard) tanyaCard.addEventListener('click', openSupportChat);
    if (resepCard) resepCard.addEventListener('click', openRecipeChat);

    const navItems = home.querySelectorAll('.bottom-nav .nav-item');
    const actions = [
      () => goToScreen(SCREEN.HOME),
      () => goToScreen(SCREEN.PANDUAN),
      () => openSupportChat(),
      () => openProfilePanel(),
    ];
    navItems.forEach((item, index) => {
      item.style.cursor = 'pointer';
      if (actions[index]) item.addEventListener('click', actions[index]);
    });
  }

  function wirePanduanList() {
    const panduan = wraps[SCREEN.PANDUAN];
    const backBtn = panduan.querySelector('.back-btn');
    const chapterCards = panduan.querySelectorAll('.chapter-card');
    const openGalleryBtn = panduan.querySelector('.open-video-gallery-btn');

    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    if (openGalleryBtn) {
      openGalleryBtn.addEventListener('click', () => {
        goToScreen(SCREEN.VIDEO_GALLERY);
        renderVideoGallery();
      });
    }

    chapterCards.forEach((card, i) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => window.openChapter(i + 1));
    });

    const navItems = panduan.querySelectorAll('.bottom-nav .nav-item');
    const actions = [
      () => goToScreen(SCREEN.HOME),
      () => goToScreen(SCREEN.PANDUAN),
      () => openSupportChat(),
      () => openProfilePanel(),
    ];
    navItems.forEach((item, index) => {
      item.style.cursor = 'pointer';
      if (actions[index]) item.addEventListener('click', actions[index]);
    });
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
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: state.chatMode,
        lang: state.language,
        messages: history.slice(-12),
      }),
    });

    if (!response.ok) {
      let detail = `API ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error) detail = String(errJson.error);
      } catch (_err) {
        const errText = await response.text().catch(() => '');
        if (errText) detail = `${detail}: ${errText}`;
      }
      throw new Error(detail);
    }

    const data = await response.json();
    if (!data.reply || typeof data.reply !== 'string') {
      throw new Error('Format respons tidak valid.');
    }

    return data.reply.trim();
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
        bookmarkBtn.addEventListener('click', () => {
          if (chapterPos > 0) {
            goToScreen(CHAPTER_SCREENS[chapterPos - 1]);
            showToast(tr('toastBackChapter'));
          } else {
            goToScreen(SCREEN.PANDUAN);
            showToast(tr('toastBackToToc'));
          }
        });
      }
    });
  }

  initChatHistory();
  wireSplash();
  wireHome();
  wirePanduanList();
  wireVideoGallery();
  wireVideoPlayer();
  wireTanyaKami();
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
        showToast(`Terjemahan gagal: ${msg}`);
      });

    return { ok: true, language: target, queued: missingMap.size };
  };

  goToScreen(SCREEN.SPLASH);
  applyLanguage(state.language, { resetChat: true });
})();
