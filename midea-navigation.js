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
    }, 1700);
  }

  function goToScreen(idx) {
    wraps.forEach((wrap, i) => {
      wrap.style.display = i === idx ? 'flex' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
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

  function wireHome() {
    const home = wraps[SCREEN.HOME];
    const panduanCard = home.querySelector('.card-panduan');
    const tanyaCard = home.querySelector('.card-tanya');
    const resepCard = home.querySelector('.card-resep');

    if (panduanCard) panduanCard.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
    if (tanyaCard) tanyaCard.addEventListener('click', () => goToScreen(SCREEN.TANYA));
    if (resepCard) {
      resepCard.addEventListener('click', () => {
        goToScreen(SCREEN.TANYA);
        showToast('Menu resep diarahkan ke Tanya Kami pada prototype ini.');
      });
    }

    const navItems = home.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach((item) => {
      const label = item.querySelector('span')?.textContent?.trim();
      item.style.cursor = 'pointer';

      if (label === 'Beranda') item.addEventListener('click', () => goToScreen(SCREEN.HOME));
      if (label === 'Cari') item.addEventListener('click', () => goToScreen(SCREEN.PANDUAN));
      if (label === 'Bantuan') item.addEventListener('click', () => goToScreen(SCREEN.TANYA));
      if (label === 'Profil') {
        item.addEventListener('click', () => showToast('Halaman Profil belum tersedia di prototype ini.'));
      }
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
      if (label === 'Bantuan') item.addEventListener('click', () => goToScreen(SCREEN.TANYA));
      if (label === 'Profil') {
        item.addEventListener('click', () => showToast('Halaman Profil belum tersedia di prototype ini.'));
      }
    });
  }

  function makeBotReply(message) {
    const text = message.toLowerCase();

    if (text.includes('garansi')) {
      return 'Untuk garansi, siapkan nomor model dan bukti pembelian. Saya bisa bantu cek prosedurnya.';
    }
    if (text.includes('service') || text.includes('servis')) {
      return 'Silakan kirim kota Anda, nanti saya arahkan ke service center Midea terdekat.';
    }
    if (text.includes('resep')) {
      return 'Untuk resep, sebutkan model produk Anda dan bahan yang tersedia, nanti saya rekomendasikan menu.';
    }
    if (text.includes('ac') && text.includes('dingin')) {
      return 'Coba cek mode pendinginan, suhu setpoint, dan filter AC. Jika tetap tidak dingin, kemungkinan perlu inspeksi teknisi.';
    }

    return 'Terima kasih, pesan Anda sudah diterima. Tim support akan membantu Anda segera.';
  }

  function wireTanyaKami() {
    const tanya = wraps[SCREEN.TANYA];
    const backBtn = tanya.querySelector('.back-btn');
    const input = tanya.querySelector('.chat-input');
    const sendBtn = tanya.querySelector('.send-btn');
    const chatArea = tanya.querySelector('.chat-area');
    const quickBtns = tanya.querySelectorAll('.quick-btn');

    if (backBtn) backBtn.addEventListener('click', () => goToScreen(SCREEN.HOME));
    if (input) input.removeAttribute('readonly');

    function appendUserMessage(text) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble user';
      bubble.textContent = text;
      chatArea.appendChild(bubble);
    }

    function appendBotMessage(text) {
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
          <span class="chat-sender">Midea Support</span>
          <span class="chat-time">Now</span>
        </div>
      `;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble bot';
      bubble.textContent = text;
      wrapper.appendChild(bubble);
      chatArea.appendChild(wrapper);
    }

    function sendMessage() {
      const text = (input?.value || '').trim();
      if (!text) return;

      appendUserMessage(text);
      input.value = '';

      setTimeout(() => {
        appendBotMessage(makeBotReply(text));
        chatArea.scrollTop = chatArea.scrollHeight;
      }, 350);

      chatArea.scrollTop = chatArea.scrollHeight;
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    quickBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!input) return;
        input.value = btn.textContent.trim();
        sendMessage();
      });
    });
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
