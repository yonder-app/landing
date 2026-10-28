/* One GA4 tag, production hosts only. Development never contacts Google. */
(() => {
  const measurementId = 'G-DDWVMYJ078';
  const enabled = ['yonder.site', 'www.yonder.site'].includes(location.hostname)
    && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl;
  const debug = new URLSearchParams(location.search).get('analytics_debug') === '1';
  const once = new Set();
  window.trackYonder = (name, parameters = {}, oncePerPage = false) => {
    if (!enabled || (oncePerPage && once.has(name))) return;
    if (oncePerPage) once.add(name);
    window.gtag('event', name, { page_variant: 'portfolio', ...parameters });
  };
  if (!enabled) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_variant: 'portfolio',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(debug ? { debug_mode: true } : {})
  });
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(tag);
})();
