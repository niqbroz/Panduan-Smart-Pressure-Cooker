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

  const CHAT_MODES = {
    support: {
      title: 'Tanya Kami',
      subtitle: 'Tim kami siap membantu Anda 24/7',
      sender: 'Midea Support',
      placeholder: 'Ketik pertanyaan produk/servis Anda...',
      quick: ['Garansi Produk', 'Service Center', 'Cara Penggunaan'],
      welcome:
        'Halo! Saya asisten Midea. Silakan tanya seputar produk, garansi, troubleshooting, atau service center.',
    },
    recipe: {
      title: 'Rekomendasi Resep',
      subtitle: 'Asisten resep cerdas untuk produk Midea',
      sender: 'Midea Recipe AI',
      placeholder: 'Contoh: Resep ayam untuk air fryer 20 menit',
      quick: ['Resep Air Fryer', 'Menu Rice Cooker', 'Resep Rendah Kalori'],
      welcome:
        'Halo! Saya siap rekomendasikan resep berdasarkan alat Midea, bahan yang Anda punya, dan waktu memasak.',
    },
  };

  const state = {
    chatMode: 'support',
    chatBusy: false,
    chatHistory: {
      support: [{ role: 'assistant', content: CHAT_MODES.support.welcome }],
      recipe: [{ role: 'assistant', content: CHAT_MODES.recipe.welcome }],
    },
  };

  function nowTimeText() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
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
      card.style.width = 'min(360px, 92vw)';
      card.style.background = '#fff';
      card.style.borderRadius = '20px';
      card.style.padding = '18px';
      card.style.boxShadow = '0 20px 40px rgba(0,0,0,0.28)';
      card.style.fontFamily = 'DM Sans, sans-serif';

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1E1E2E;">Profil Saya</div>
          <button id="profile-close-btn" style="border:0;background:#F3F4F6;width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div style="font-size:12px;color:#6B6B80;margin-bottom:14px;">Ringkasan akun aplikasi Midea</div>
        <div style="background:#FAFAFB;border:1px solid #E8E4DF;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:12px;">
          <div style="width:42px;height:42px;border-radius:12px;background:#D72638;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">MR</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#1E1E2E;">Member Midea</div>
            <div style="font-size:11px;color:#6B6B80;">ID: MID-USER-2026</div>
          </div>
        </div>
        <div style="display:grid;gap:8px;">
          <button style="padding:11px 12px;border-radius:11px;border:1.5px solid #E8E4DF;background:#fff;text-align:left;cursor:pointer;font-size:12px;">Riwayat Chat Bantuan</button>
          <button style="padding:11px 12px;border-radius:11px;border:1.5px solid #E8E4DF;background:#fff;text-align:left;cursor:pointer;font-size:12px;">Produk Terdaftar</button>
          <button style="padding:11px 12px;border-radius:11px;border:1.5px solid #E8E4DF;background:#fff;text-align:left;cursor:pointer;font-size:12px;">Pengaturan Bahasa</button>
        </div>
      `;

      panel.appendChild(card);
      document.body.appendChild(panel);

      panel.addEventListener('click', (e) => {
        if (e.target === panel) {
          panel.style.display = 'none';
        }
      });

      panel.querySelector('#profile-close-btn').addEventListener('click', () => {
        panel.style.display = 'none';
      });
    }

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
        langBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
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

    titleEl.textContent = CHAT_MODES[safeMode].title;
    subEl.textContent = CHAT_MODES[safeMode].subtitle;
    if (input) input.placeholder = CHAT_MODES[safeMode].placeholder;

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
        <span class="chat-sender">${CHAT_MODES[state.chatMode].sender}</span>
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

    CHAT_MODES[state.chatMode].quick.forEach((label) => {
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
        return 'Coba: ayam fillet 180°C 16-18 menit, marinasi bawang putih, garam, lada, sedikit minyak. Balik di menit ke-9.';
      }
      return 'Saya bisa bantu resep sesuai alat Midea Anda. Sebutkan alat, bahan utama, dan target waktu masak.';
    }

    if (text.includes('garansi')) {
      return 'Untuk klaim garansi, siapkan nomor model, serial number, dan bukti pembelian.';
    }
    if (text.includes('service') || text.includes('servis')) {
      return 'Silakan kirim kota Anda. Saya akan bantu arahkan ke service center resmi terdekat.';
    }

    return 'Pesan diterima. Jika API ChatGPT belum aktif, jawaban sekarang memakai mode fallback lokal.';
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
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText || 'unknown error'}`);
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
      showToast('Sinkron ChatGPT gagal. Pakai fallback lokal.');
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
        bookmarkBtn.addEventListener('click', () => showToast('Bab ditandai (bookmark).'));
      }
    }
  }

  wireSplash();
  wireHome();
  wirePanduanList();
  wireTanyaKami();
  wireChapterDetails();

  goToScreen(SCREEN.SPLASH);
})();
