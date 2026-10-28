(() => {
  const track = (name, parameters, once) => window.trackYonder?.(name, parameters, once);
  const video = document.getElementById('yonder-demo');
  const videoControl = document.getElementById('video-control');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = navigator.connection?.saveData === true;
  let wantsPlayback = !reducedMotion.matches && !saveData;
  let videoVisible = false;
  let engagementVisible = false;
  let loaded = false;
  let workTimer;
  let lastTick = 0;
  let lastMediaTime = 0;
  let engagedMs = 0;
  let demoEngaged = false;
  function loadVideo() {
    if (loaded) return;
    loaded = true;
    video.querySelectorAll('source[data-src]').forEach(source => {
      source.src = source.dataset.src;
      source.removeAttribute('data-src');
    });
    video.preload = 'metadata';
    video.load();
  }
  const syncVideo = () => {
    videoControl.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
    videoControl.classList.toggle('is-paused', video.paused);
  };
  function stopVideoWork() {
    clearInterval(workTimer);
    workTimer = undefined;
  }
  function startVideoWork() {
    if (workTimer || !videoVisible || document.hidden || video.paused) return;
    lastTick = performance.now();
    lastMediaTime = video.currentTime;
    updateIconContrast();
    workTimer = setInterval(() => {
      if (document.hidden || !videoVisible || video.paused) { stopVideoWork(); return; }
      const now = performance.now();
      const mediaTime = video.currentTime;
      let advanced = mediaTime - lastMediaTime;
      if (advanced < 0 && video.loop && Number.isFinite(video.duration)) {
        advanced = video.duration - lastMediaTime + mediaTime;
      }
      if (engagementVisible && !demoEngaged && !video.seeking) {
        engagedMs += Math.max(0, Math.min(now - lastTick, advanced * 1000, 1000));
        if (engagedMs >= 10000) {
          demoEngaged = true;
          track('demo_engaged', { visible_seconds: 10 }, true);
        }
      }
      lastTick = now;
      lastMediaTime = mediaTime;
      updateIconContrast();
    }, 250);
  }
  function syncPlayback() {
    if (wantsPlayback && videoVisible && !document.hidden) {
      loadVideo();
      if (video.paused) video.play().catch(syncVideo);
    } else {
      video.pause();
      stopVideoWork();
    }
  }
  videoControl.addEventListener('click', () => {
    const action = video.paused ? 'play' : 'pause';
    wantsPlayback = action === 'play';
    track('demo_toggle', { action });
    syncPlayback();
  });
  video.addEventListener('play', () => { syncVideo(); startVideoWork(); });
  video.addEventListener('pause', () => { syncVideo(); stopVideoWork(); updateIconContrast(); });
  video.addEventListener('error', () => track('demo_error', { media_error_code: video.error?.code || 0 }, true));
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', event => {
    wantsPlayback = !event.matches && !saveData;
    syncPlayback();
  });
  syncVideo();

  // Read only the small video patch beneath the glass control, at most 4x/sec.
  const sample = document.createElement('canvas');
  sample.width = sample.height = 12;
  const context = sample.getContext('2d', { willReadFrequently: true });
  const disc = videoControl.querySelector('.video-control-disc');
  let lastSample = 0;
  let darkIcon = false;
  function updateIconContrast() {
    if (!context || video.readyState < 2 || !videoVisible || document.hidden) return;
    const bounds = video.getBoundingClientRect();
    const control = disc.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scaleX = video.videoWidth / bounds.width;
    const scaleY = video.videoHeight / bounds.height;
    try {
      context.drawImage(video,
        (control.left - bounds.left) * scaleX, (control.top - bounds.top) * scaleY,
        control.width * scaleX, control.height * scaleY, 0, 0, 12, 12);
      const pixels = context.getImageData(0, 0, 12, 12).data;
      let luminance = 0;
      const linear = channel => { const c = channel / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
      for (let i = 0; i < pixels.length; i += 4) {
        luminance += .2126 * linear(pixels[i]) + .7152 * linear(pixels[i + 1]) + .0722 * linear(pixels[i + 2]);
      }
      luminance /= pixels.length / 4;
      if (luminance > .2) darkIcon = true;
      else if (luminance < .16) darkIcon = false;
      disc.style.color = darkIcon ? '#000' : '#fff';
    } catch (_) { /* A cross-origin video keeps the default white icon. */ }
  }
  ['loadeddata', 'seeked'].forEach(event => video.addEventListener(event, () => {
    if (videoVisible && !document.hidden) updateIconContrast();
  }));
  window.addEventListener('resize', () => {
    if (videoVisible && !document.hidden) updateIconContrast();
  });
  if ('IntersectionObserver' in window) {
    const nearby = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && wantsPlayback) {
        loadVideo();
        nearby.disconnect();
      }
    }, { rootMargin: '200px' });
    nearby.observe(video);
    const visible = new IntersectionObserver(entries => {
      const entry = entries[0];
      videoVisible = entry.isIntersecting;
      engagementVisible = entry.intersectionRatio >= .5;
      syncPlayback();
      startVideoWork();
    }, { threshold: [0, .5] });
    visible.observe(video);
  } else {
    videoVisible = engagementVisible = true;
    syncPlayback();
  }
  window.addEventListener('pagehide', () => { video.pause(); stopVideoWork(); });
  window.addEventListener('pageshow', syncPlayback);

  const copyButton = document.getElementById('brew-pill-hero');
  const label = document.getElementById('copy-label');
  const status = document.getElementById('copy-status');
  const fallback = document.getElementById('install-fallback');
  const command = `curl -fsSL ${new URL('install-yonder.sh', location.href).href} | bash`;
  let labelTimer;
  let copyResetTimer;
  let copying = false;
  function setCopyState(text, copied) {
    clearTimeout(labelTimer);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const oldWidth = copyButton.getBoundingClientRect().width;
    const ghost = copyButton.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;visibility:hidden;width:auto;transition:none';
    ghost.querySelector('#copy-label').textContent = text;
    document.body.appendChild(ghost);
    const nextWidth = ghost.getBoundingClientRect().width;
    ghost.remove();
    copyButton.style.width = oldWidth + 'px';
    copyButton.offsetWidth;
    copyButton.style.width = nextWidth + 'px';
    copyButton.classList.toggle('is-copied', copied);
    copyButton.setAttribute('aria-label', copied ? 'Install script copied. Now paste into Terminal' : 'Copy Yonder install script');
    if (reduced) { label.textContent = text; return; }
    label.style.transition = 'transform .14s ease, opacity .14s';
    label.style.transform = 'translateY(-5px)';
    label.style.opacity = '0';
    labelTimer = setTimeout(() => {
      label.textContent = text;
      label.style.transition = 'none';
      label.style.transform = 'translateY(6px)';
      label.offsetHeight;
      label.style.transition = 'transform .22s cubic-bezier(.32,.72,.32,1), opacity .18s';
      label.style.transform = 'translateY(0)';
      label.style.opacity = '1';
    }, 140);
  }
  copyButton.addEventListener('click', async () => {
    if (copying) return;
    copying = true;
    clearTimeout(copyResetTimer);
    fallback.textContent = command;
    try {
      await navigator.clipboard.writeText(command);
      track('install_copy_success', { method: 'clipboard' });
      fallback.hidden = true;
      setCopyState('Now paste into Terminal', true);
      copyResetTimer = setTimeout(() => setCopyState('Copy install script', false), 6000);
      status.textContent = 'Install command copied. Paste into Terminal and press Enter.';
    } catch (_) {
      track('install_copy_error', { reason: 'clipboard_unavailable' });
      fallback.hidden = false;
      setCopyState('Copy install script', false);
      status.textContent = 'Select and copy the command below, then paste it into Terminal.';
      fallback.focus();
    } finally {
      copying = false;
    }
  });

  const tipTrigger = document.getElementById('install-tip-trigger');
  const tip = document.getElementById('install-tip');
  const tipHost = tipTrigger.parentElement;
  let tipTimer;
  let tipMeasureTimer;
  function positionTip() {
    const anchor = tipTrigger.getBoundingClientRect();
    const width = tip.offsetWidth;
    const centeredLeft = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.max(16, Math.min(centeredLeft, innerWidth - width - 16));
    tip.style.setProperty('--tip-shift', `${left - centeredLeft}px`);
  }
  function showTip(show) {
    clearTimeout(tipTimer);
    clearTimeout(tipMeasureTimer);
    if (show) {
      positionTip();
      tipMeasureTimer = setTimeout(() => {
        if (!document.hidden) track('install_help_open', {}, true);
      }, 400);
    }
    tip.classList.toggle('is-visible', show);
    tip.setAttribute('aria-hidden', String(!show));
    tipTrigger.setAttribute('aria-expanded', String(show));
  }
  window.addEventListener('resize', () => { if (tip.classList.contains('is-visible')) positionTip(); });
  tipHost.addEventListener('mouseenter', () => showTip(true));
  tipHost.addEventListener('mouseleave', () => { tipTimer = setTimeout(() => showTip(false), 120); });
  tipTrigger.addEventListener('focus', () => showTip(true));
  tipTrigger.addEventListener('click', event => {
    showTip(true);
    if (event.pointerType === 'touch' || matchMedia('(hover: none)').matches) tipTimer = setTimeout(() => showTip(false), 4000);
  });
  tipHost.addEventListener('focusout', event => { if (!tipHost.contains(event.relatedTarget)) { showTip(false); } });
  document.addEventListener('click', event => { if (!tipHost.contains(event.target)) { showTip(false); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { showTip(false); } });

  document.querySelectorAll('.foot-links a').forEach(link => {
    link.addEventListener('click', () => track('footer_link_click', {
      destination: link.protocol === 'mailto:' ? 'feedback' : 'coffee'
    }));
  });

  // Same stagger and easing as the portfolio's initReveal.
  document.querySelectorAll('.reveal').forEach((element, index) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) element.classList.add('in');
    else setTimeout(() => element.classList.add('in'), 90 + (Number(element.dataset.delay) || index * 70));
  });
})();
