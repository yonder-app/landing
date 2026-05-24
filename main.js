/* Yonder — landing page interactions */

(function () {
  // ---------- Time updates ----------
  const $ = (s, root = document) => root.querySelector(s);

  const formatHM = (date, tz) => {
    const opts = { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz };
    return new Intl.DateTimeFormat('en-US', opts).formatToParts(date);
  };
  const partsToTime = (parts) => {
    let h = '', m = '', ap = '';
    for (const p of parts) {
      if (p.type === 'hour') h = p.value;
      else if (p.type === 'minute') m = p.value;
      else if (p.type === 'dayPeriod') ap = p.value.toUpperCase();
    }
    return { time: `${h}:${m}`, ampm: ap };
  };

  const getOffset = (date, tz) => {
    // Returns the local timezone's wall-clock day offset relative to local (browser) day.
    // We compare YYYY-MM-DD in TZ vs in local.
    const fmt = (d, t) => new Intl.DateTimeFormat('en-CA', {
      timeZone: t, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(d);
    const local = fmt(date, Intl.DateTimeFormat().resolvedOptions().timeZone);
    const there = fmt(date, tz);
    if (local === there) return 0;
    return (new Date(there) - new Date(local)) / 86400000;
  };

  const PEOPLE = [
    { id: 'maya', tz: 'Europe/London' },
    { id: 'kenji', tz: 'Asia/Tokyo' },
    { id: 'alex', tz: 'America/Los_Angeles' },
    { id: 'noor', tz: 'Asia/Dubai' },
    { id: 'sam', tz: 'Europe/Berlin' },
  ];

  // Phases definition by hour: night/morning/day/evening/late
  function phaseFor(date, tz) {
    const h = parseInt(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false, timeZone: tz
    }).format(date), 10);
    if (h >= 0 && h < 6) return 'night';
    if (h < 10) return 'morning';
    if (h < 17) return 'day';
    if (h < 21) return 'evening';
    return 'late';
  }

  // sky variant: day / dusk / night
  function skyVariantFor(date, tz) {
    const h = parseInt(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false, timeZone: tz
    }).format(date), 10);
    if (h >= 6 && h < 18) return 'day';
    if (h >= 18 && h < 21) return 'dusk';
    return 'night';
  }

  // We drive both real-time and "scrubbed" time. Scrub offset in minutes from now.
  let scrubOffsetMin = 0;

  function effectiveDate() {
    return new Date(Date.now() + scrubOffsetMin * 60_000);
  }

  function updateAll() {
    const d = effectiveDate();
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Menu bar local time
    const mbT = partsToTime(formatHM(d, localTz));
    const mbEl = $('#mb-local-time');
    if (mbEl) mbEl.textContent = `${mbT.time} ${mbT.ampm}`;

    const mbDate = $('#mb-date');
    if (mbDate) {
      const ds = new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', timeZone: localTz
      }).format(d);
      mbDate.textContent = `${ds}  ${mbT.time} ${mbT.ampm}`;
    }

    // Popover local time
    const pT = partsToTime(formatHM(d, localTz));
    const ptm = $('#pop-local-time');
    if (ptm) ptm.textContent = pT.time;
    const pap = $('#pop-local-ampm');
    if (pap) pap.textContent = pT.ampm;

    const cityEl = $('#pop-local-city');
    if (cityEl) {
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: localTz }).format(d);
      // Strip tz to a friendly city; fallback to "Local"
      const city = localTz.split('/').slice(-1)[0].replace(/_/g, ' ');
      cityEl.textContent = `${city} · ${weekday}`;
    }

    // Sky variant follows local
    const sky = $('#sky');
    if (sky) {
      sky.classList.remove('is-day', 'is-dusk', 'is-night');
      const v = skyVariantFor(d, localTz);
      if (v !== 'day') sky.classList.add(v === 'dusk' ? 'is-dusk' : 'is-night');
    }

    // People rows
    for (const p of PEOPLE) {
      const t = partsToTime(formatHM(d, p.tz));
      const el = $(`#t-${p.id}`);
      if (el) el.textContent = t.time;
      const ampmEl = el && el.parentElement && el.parentElement.querySelector('.ampm');
      if (ampmEl) ampmEl.textContent = t.ampm;

      // Phase dot
      const row = el && el.closest('.person');
      if (row) {
        const dot = row.querySelector('.phase-dot');
        if (dot) {
          dot.className = 'phase-dot phase-' + phaseFor(d, p.tz);
        }
        // Day offset badge
        const timeBox = row.querySelector('.person-time');
        const existingBadge = timeBox.querySelector('.day-badge');
        const offset = getOffset(d, p.tz);
        if (offset === 0 && existingBadge) {
          existingBadge.remove();
        } else if (offset !== 0) {
          const label = offset > 0 ? 'Tomorrow' : 'Yesterday';
          const cls = offset > 0 ? 'day-tomorrow' : 'day-yesterday';
          if (existingBadge) {
            existingBadge.textContent = label;
            existingBadge.className = 'day-badge ' + cls;
          } else {
            const span = document.createElement('span');
            span.className = 'day-badge ' + cls;
            span.textContent = label;
            timeBox.appendChild(span);
          }
        }

        // Also update the "phase" line copy
        const placeText = row.querySelector('.person-place span:last-child');
        if (placeText) {
          const city = placeText.textContent.split('·')[0].trim();
          const phaseName = phaseFor(d, p.tz);
          const human = ({
            night: 'asleep',
            morning: 'morning',
            day: 'work hours',
            evening: 'evening',
            late: 'late evening',
          })[phaseName];
          placeText.textContent = `${city} · ${human}`;
        }
      }
    }
  }

  updateAll();
  setInterval(updateAll, 30_000); // every 30s

  // ---------- Scrubber interaction ----------
  const track = document.querySelector('.scrubber-track');
  const thumb = document.querySelector('#scrub-thumb');
  const scrubLabel = document.querySelector('#scrub-label');

  if (track && thumb && scrubLabel) {
    let dragging = false;

    // Track currently set "now" position. Maps to scrubOffsetMin = 0.
    // Mapping: 0% -> -12h, 100% -> +12h, center 50% -> now.
    // But "now" tick is at 41% in the design; let's keep that consistent.
    // We'll define: 0% = -12h, 100% = +12h linearly; thumb starts at 50% and label = "Now".
    thumb.style.left = '50%';

    const setFromPct = (pct) => {
      const clamped = Math.max(0, Math.min(100, pct));
      thumb.style.left = clamped + '%';
      const minutes = Math.round(((clamped - 50) / 50) * 12 * 60);
      scrubOffsetMin = minutes;
      if (Math.abs(minutes) < 8) {
        scrubLabel.textContent = 'Now';
      } else {
        const abs = Math.abs(minutes);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        const direction = minutes > 0 ? '+' : '−';
        let txt = direction;
        if (h) txt += h + 'h';
        if (m) txt += (h ? ' ' : '') + m + 'm';
        scrubLabel.textContent = txt;
      }
      updateAll();
    };

    const pctFromEvent = (e) => {
      const rect = track.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return (x / rect.width) * 100;
    };

    const onDown = (e) => {
      dragging = true;
      thumb.style.cursor = 'grabbing';
      setFromPct(pctFromEvent(e));
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      setFromPct(pctFromEvent(e));
    };
    const onUp = () => {
      dragging = false;
      thumb.style.cursor = 'grab';
    };

    track.addEventListener('mousedown', onDown);
    track.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // Snap-back to now on double-click of thumb
    thumb.addEventListener('dblclick', () => setFromPct(50));
  }

  // ---------- Copy buttons ----------
  const BREW = 'brew install --cask yonder-app/tap/yonder';
  const toast = $('#toast');
  const toastText = $('#toast-text');
  let toastTimer;

  function showToast(msg, duration = 2200) {
    if (!toast) return;
    if (toastText) toastText.innerHTML = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return true;
    }
  }

  function wireCopy(btnSel) {
    const btn = document.querySelector(btnSel);
    if (!btn) return;
    let timer;
    btn.addEventListener('click', async () => {
      await copyText(BREW);
      btn.classList.add('is-copied');
      clearTimeout(timer);
      timer = setTimeout(() => btn.classList.remove('is-copied'), 2000);
      showToast('Not on Homebrew yet? <strong>Click here</strong>', 7000);
    });
  }

  wireCopy('#brew-pill-hero');
  wireCopy('#brew-copy-main');
  wireCopy('#brew-copy-alt');

  // ── Hero perspective scroll reveal ──
  const heroImageEl = document.getElementById('hero-image');
  if (heroImageEl) {
    function updatePerspective() {
      // Skip 3D tilt on mobile — CSS handles flat crop layout
      if (window.innerWidth <= 599) {
        heroImageEl.style.transform = '';
        return;
      }
      const rect = heroImageEl.getBoundingClientRect();
      const vh = window.innerHeight;
      // raw: 0 when element top hits viewport bottom, 1 after ~1.2vh of scroll
      const raw = (vh - rect.top) / (vh * 1.2);
      const p = Math.max(0, Math.min(1, raw));
      // cubic ease-out: fast start, gentle landing
      const eased = 1 - Math.pow(1 - p, 3);
      const rotX = (16 * (1 - eased)).toFixed(3);
      const scale = (0.91 + 0.09 * eased).toFixed(4);
      heroImageEl.style.transform = `rotateX(${rotX}deg) scale(${scale})`;
    }
    window.addEventListener('scroll', updatePerspective, { passive: true });
    window.addEventListener('resize', updatePerspective, { passive: true });
    updatePerspective();
  }

  // ── Hero theme toggle ──
  const heroImage = document.getElementById('hero-image');
  const themePill = document.getElementById('theme-pill');
  const themeKnob = document.getElementById('theme-knob');
  const segs = themePill ? themePill.querySelectorAll('.theme-seg') : [];

  function positionKnob(btn) {
    if (!themeKnob || !btn) return;
    themeKnob.style.left  = btn.offsetLeft + 'px';
    themeKnob.style.width = btn.offsetWidth + 'px';
  }

  function setHeroTheme(theme) {
    segs.forEach(s => s.classList.toggle('active', s.dataset.theme === theme));
    heroImage.classList.toggle('is-dark', theme === 'dark');
    const activeBtn = themePill.querySelector('.theme-seg.active');
    positionKnob(activeBtn);
  }

  if (themePill) {
    requestAnimationFrame(() => positionKnob(document.getElementById('seg-light')));
    segs.forEach(seg => seg.addEventListener('click', () => setHeroTheme(seg.dataset.theme)));
  }

  // Click anywhere on hero image toggles theme (except the pill itself)
  let _isDark = false;
  if (heroImage) {
    heroImage.addEventListener('click', (e) => {
      if (e.target.closest('.theme-pill')) return;
      _isDark = !_isDark;
      setHeroTheme(_isDark ? 'dark' : 'light');
    });
  }

  // ── Custom smooth scroll for #features nav link ──
  const featuresLink = document.querySelector('a[href="#features"]');
  if (featuresLink) {
    featuresLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('features');
      if (!target) return;
      const startY = window.scrollY;
      const endY = target.getBoundingClientRect().top + startY - 80;
      const duration = 900;
      let startTime = null;
      const ease = t => 1 - Math.pow(1 - t, 3);
      const step = (ts) => {
        if (!startTime) startTime = ts;
        const p = Math.min((ts - startTime) / duration, 1);
        window.scrollTo(0, startY + (endY - startY) * ease(p));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ── macOS download button + install modal ──
  const DMG_URL = 'https://github.com/yonder-app/releases/releases/download/v1.0.0/Yonder-1.0.0.dmg';
  const dlModal = document.getElementById('dl-modal');
  const dlClose = document.getElementById('dl-modal-close');
  const dlBackdrop = document.getElementById('dl-modal-backdrop');
  const dlBtn = document.getElementById('macos-download-btn');

  function openDlModal() {
    if (!dlModal) return;
    dlModal.hidden = false;
    requestAnimationFrame(() => dlModal.classList.add('is-open'));
  }
  function closeDlModal() {
    if (!dlModal) return;
    dlModal.classList.remove('is-open');
    dlModal.addEventListener('transitionend', () => { dlModal.hidden = true; }, { once: true });
  }

  if (dlBtn) {
    dlBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const a = document.createElement('a');
      a.href = DMG_URL;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      openDlModal();
    });
  }
  if (dlClose) dlClose.addEventListener('click', closeDlModal);
  if (dlBackdrop) dlBackdrop.addEventListener('click', closeDlModal);
  const dlDone = document.getElementById('dl-modal-done');
  if (dlDone) dlDone.addEventListener('click', closeDlModal);

  // ── Brew help modal ──
  function makeModal(modalEl, backdropId, closeId) {
    const backdrop = document.getElementById(backdropId);
    const closeBtn = document.getElementById(closeId);
    const open = () => { modalEl.hidden = false; requestAnimationFrame(() => modalEl.classList.add('is-open')); };
    const close = () => {
      modalEl.classList.remove('is-open');
      modalEl.addEventListener('transitionend', () => { modalEl.hidden = true; }, { once: true });
    };
    if (backdrop) backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    return { open, close };
  }
  const brewHelpModal = document.getElementById('brew-help-modal');
  const brewHelpCtrl = makeModal(brewHelpModal, 'brew-help-backdrop', 'brew-help-close');
  if (toast) toast.addEventListener('click', () => { if (toast.classList.contains('show')) brewHelpCtrl.open(); });

  // Brew help copy button
  const brewHelpCopyBtn = document.getElementById('brew-help-copy');
  const BREW_AND_INSTALL = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && brew install --cask yonder-app/tap/yonder';
  if (brewHelpCopyBtn) {
    let bhTimer;
    brewHelpCopyBtn.addEventListener('click', async () => {
      await copyText(BREW_AND_INSTALL);
      brewHelpCopyBtn.classList.add('is-copied');
      clearTimeout(bhTimer);
      bhTimer = setTimeout(() => brewHelpCopyBtn.classList.remove('is-copied'), 2000);
    });
  }

  // ── Word-by-word hero title animation ──
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const titleEl = document.querySelector('.hero-title');
    if (titleEl) {
      const nodes = [...titleEl.childNodes];
      titleEl.innerHTML = '';
      let wordIndex = 0;
      const START = 80, GAP = 100;
      nodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent.split(/(\S+)/).forEach(part => {
            if (!part) return;
            if (/\S/.test(part)) {
              const s = document.createElement('span');
              s.className = 'word-reveal';
              s.style.animationDelay = `${START + wordIndex++ * GAP}ms`;
              s.textContent = part;
              titleEl.appendChild(s);
            } else {
              titleEl.appendChild(document.createTextNode(part));
            }
          });
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const s = document.createElement('span');
          s.className = 'word-reveal';
          s.style.animationDelay = `${START + wordIndex++ * GAP}ms`;
          s.appendChild(node.cloneNode(true));
          titleEl.appendChild(s);
        }
      });
    }
  }

  // ── Scroll-triggered entrance reveals ──
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObs = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.feature').forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${i * 110}ms`;
      revealObs.observe(el);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (dlModal && !dlModal.hidden) closeDlModal();
    if (brewHelpModal && !brewHelpModal.hidden) brewHelpCtrl.close();
    closeMobileMenu();
  });

  // ── Mobile hamburger menu ──
  const navMenuBtn = document.getElementById('nav-menu-btn');
  const navMobileOverlay = document.getElementById('nav-mobile-overlay');
  const navMobileBackdropEl = document.getElementById('nav-mobile-backdrop');
  const navMobileCloseBtn = document.getElementById('nav-mobile-close');
  const navMobileFeaturesLink = document.getElementById('nav-mobile-features');
  const navMobileCoffeeLink = document.getElementById('nav-mobile-coffee');

  function openMobileMenu() {
    if (!navMobileOverlay) return;
    navMobileOverlay.classList.add('is-open');
    navMobileOverlay.removeAttribute('aria-hidden');
    if (navMenuBtn) navMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMobileMenu() {
    if (!navMobileOverlay) return;
    navMobileOverlay.classList.remove('is-open');
    navMobileOverlay.setAttribute('aria-hidden', 'true');
    if (navMenuBtn) navMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  // Entire nav header = tap to open menu on mobile (button click bubbles up; that's fine)
  const mainNav = document.querySelector('.nav');
  if (mainNav) {
    mainNav.addEventListener('click', () => {
      if (window.innerWidth > 599) return;
      openMobileMenu();
    });
  }
  if (navMenuBtn) navMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMobileMenu(); });
  if (navMobileCloseBtn) navMobileCloseBtn.addEventListener('click', closeMobileMenu);
  if (navMobileBackdropEl) navMobileBackdropEl.addEventListener('click', closeMobileMenu);
  if (navMobileFeaturesLink) navMobileFeaturesLink.addEventListener('click', closeMobileMenu);
  if (navMobileCoffeeLink) navMobileCoffeeLink.addEventListener('click', closeMobileMenu);

  // Feature grid tuning panel: add ?debug=features to the URL.
  const featureDebug = $('#feature-debug');
  if (featureDebug && new URLSearchParams(window.location.search).get('debug') === 'features') {
    const root = document.documentElement;
    const storageKey = 'yonder-feature-grid-debug';
    const defaults = { gridWidth: 850, rowGap: 80, columnGap: 0 };
    const controls = {
      gridWidth: $('#feature-grid-width'),
      rowGap: $('#feature-row-gap'),
      columnGap: $('#feature-column-gap')
    };
    const outputs = {
      gridWidth: $('#feature-grid-width-value'),
      rowGap: $('#feature-row-gap-value'),
      columnGap: $('#feature-column-gap-value')
    };
    const props = {
      gridWidth: '--features-grid-width',
      rowGap: '--features-row-gap-desktop',
      columnGap: '--features-column-gap-desktop'
    };

    function readFeatureDebugValues() {
      try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey)) };
      } catch (_) {
        return defaults;
      }
    }

    function setFeatureDebugValues(values) {
      Object.keys(controls).forEach((key) => {
        const value = Number(values[key]);
        controls[key].value = value;
        outputs[key].textContent = `${value}px`;
        root.style.setProperty(props[key], `${value}px`);
      });
      localStorage.setItem(storageKey, JSON.stringify(values));
    }

    featureDebug.hidden = false;
    setFeatureDebugValues(readFeatureDebugValues());

    Object.keys(controls).forEach((key) => {
      controls[key].addEventListener('input', () => {
        setFeatureDebugValues({
          gridWidth: Number(controls.gridWidth.value),
          rowGap: Number(controls.rowGap.value),
          columnGap: Number(controls.columnGap.value)
        });
      });
    });

    $('#feature-debug-reset').addEventListener('click', () => {
      setFeatureDebugValues(defaults);
    });
  }
})();
