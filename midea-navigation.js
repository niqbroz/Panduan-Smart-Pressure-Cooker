(function () {
  const wraps = Array.from(document.querySelectorAll('.phone-wrap'));
  if (wraps.length < 12) return;

  const SCREEN = {
    SPLASH: 0,
    HOME: 1,
    PANDUAN: 2,
    TANYA: 3,
    CHAPTER_START: 4,
    CHAPTER_END: 11,
  };

  const CHAT_API_URL = window.MIDEA_CHAT_API_URL || 'http://localhost:8787/api/chat';
  const SUPPORTED_LANGS = ['id', 'en', 'zh'];

  const UI_TEXT = {
    id: {
      toastChatErrorPrefix: 'ChatGPT gagal',
      toastBookmark: 'Bab ditandai (bookmark).',
      profileTitle: 'Profil Saya',
      profileSummary: 'Ringkasan akun aplikasi Midea',
      profileMember: 'Member Midea',
      profileChatHistory: 'Riwayat Chat Bantuan',
      profileRegisteredProducts: 'Produk Terdaftar',
      profileLanguageSettings: 'Pengaturan Bahasa',
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
      profileTitle: 'My Profile',
      profileSummary: 'Midea app account summary',
      profileMember: 'Midea Member',
      profileChatHistory: 'Support Chat History',
      profileRegisteredProducts: 'Registered Products',
      profileLanguageSettings: 'Language Settings',
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
      profileTitle: '我的资料',
      profileSummary: 'Midea 应用账号概览',
      profileMember: '美的会员',
      profileChatHistory: '客服聊天记录',
      profileRegisteredProducts: '已注册产品',
      profileLanguageSettings: '语言设置',
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
    chatMode: 'support',
    chatBusy: false,
    chatHistory: { support: [], recipe: [] },
  };

  const translatableNodes = [];

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

  function nowTimeText() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function cacheTextNodes() {
    if (translatableNodes.length > 0) return;

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
      node.__baseText = node.nodeValue;
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

  function translatePageText(lang) {
    cacheTextNodes();
    translatableNodes.forEach((node) => {
      node.nodeValue = translateStaticText(node.__baseText, lang);
    });
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
    wraps.forEach((wrap, i) => {
      wrap.style.display = i === idx ? 'flex' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function applyLanguage(lang, options = {}) {
    const safeLang = SUPPORTED_LANGS.includes(lang) ? lang : 'id';
    const resetChat = options.resetChat !== false;

    state.language = safeLang;
    localStorage.setItem('midea_lang', safeLang);
    document.documentElement.lang = safeLang === 'zh' ? 'zh-CN' : safeLang;

    translatePageText(safeLang);
    updateLanguageButtons();

    if (resetChat) {
      initChatHistory();
    }

    setChatMode(state.chatMode);
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

  // expose globally to support existing inline onclick attributes
  window.openChapter = function (num) {
    const target = SCREEN.CHAPTER_START + Number(num) - 1;
    if (target >= SCREEN.CHAPTER_START && target <= SCREEN.CHAPTER_END) {
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

    if (panduanCard) panduanCard.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
    if (tanyaCard) tanyaCard.addEventListener('click', openSupportChat);
    if (resepCard) resepCard.addEventListener('click', openRecipeChat);

    const navItems = home.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach((item) => {
      const label = item.querySelector('span')?.textContent?.trim();
      item.style.cursor = 'pointer';

      if (label === 'Beranda') item.addEventListener('click', () => goToScreen(SCREEN.HOME));
      if (label === 'Cari') item.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
      if (label === 'Bantuan') item.addEventListener('click', openSupportChat);
      if (label === 'Profil') item.addEventListener('click', openProfilePanel);
    });
  }

  function wirePanduanList() {
    const panduan = wraps[SCREEN.PANDUAN];
    const backBtn = panduan.querySelector('.back-btn');
    const chapterCards = panduan.querySelectorAll('.chapter-card');

    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));

    chapterCards.forEach((card, i) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => window.openChapter(i + 1));
    });

    const navItems = panduan.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach((item) => {
      const label = item.querySelector('span')?.textContent?.trim();
      item.style.cursor = 'pointer';

      if (label === 'Beranda') item.addEventListener('click', () => goToScreen(SCREEN.HOME));
      if (label === 'Panduan') item.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
      if (label === 'Bantuan') item.addEventListener('click', openSupportChat);
      if (label === 'Profil') item.addEventListener('click', openProfilePanel);
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
    for (let i = SCREEN.CHAPTER_START; i <= SCREEN.CHAPTER_END; i += 1) {
      const chapter = wraps[i];
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

      if (prevBtn && !prevBtn.classList.contains('disabled')) {
        prevBtn.style.cursor = 'pointer';
        prevBtn.addEventListener('click', () => goToScreen(i - 1));
      }

      if (nextBtn && !nextBtn.classList.contains('disabled')) {
        nextBtn.style.cursor = 'pointer';
        nextBtn.addEventListener('click', () => goToScreen(i + 1));
      }

      if (nextActionBtn) {
        nextActionBtn.style.cursor = 'pointer';
        nextActionBtn.addEventListener('click', () => {
          if (i < SCREEN.CHAPTER_END) {
            goToScreen(i + 1);
          } else {
            goToScreen(SCREEN.PANDUAN);
          }
        });
      }

      if (bookmarkBtn) {
        bookmarkBtn.style.cursor = 'pointer';
        bookmarkBtn.addEventListener('click', () => showToast(tr('toastBookmark')));
      }
    }
  }

  initChatHistory();
  wireSplash();
  wireHome();
  wirePanduanList();
  wireTanyaKami();
  wireChapterDetails();

  goToScreen(SCREEN.SPLASH);
  applyLanguage(state.language, { resetChat: true });
})();
