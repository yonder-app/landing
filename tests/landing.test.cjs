const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const analyticsSource = fs.readFileSync('alternative-analytics.js', 'utf8');
const landingSource = fs.readFileSync('alternative.js', 'utf8');

function analytics(hostname, privacy = {}) {
  const scripts = [];
  const window = {};
  vm.runInNewContext(analyticsSource, {
    window, location: { hostname, search: '' }, navigator: privacy,
    document: { createElement: () => ({}), head: { appendChild: s => scripts.push(s) } },
    URLSearchParams, Date, Set
  });
  return { window, scripts };
}
for (const host of ['localhost', '127.0.0.1', 'preview.example']) {
  const result = analytics(host);
  result.window.trackYonder('install_copy_success');
  assert.equal(result.scripts.length, 0);
  assert.equal(result.window.dataLayer, undefined);
}
for (const privacy of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
  assert.equal(analytics('yonder.site', privacy).scripts.length, 0);
}
const live = analytics('yonder.site');
assert.equal(live.scripts.length, 1);
assert.match(live.scripts[0].src, /G-DDWVMYJ078/);
live.window.trackYonder('demo_engaged', { visible_seconds: 10 }, true);
live.window.trackYonder('demo_engaged', { visible_seconds: 10 }, true);
assert.equal(live.window.dataLayer.filter(e => e[1] === 'demo_engaged').length, 1);
assert.equal(live.window.dataLayer[1][2].allow_google_signals, false);

function landing({ reduced = false, saveData = false, clipboardFails = false } = {}) {
  const events = [], timers = new Map(), intervals = new Map(), observers = [];
  let clock = 0, timerId = 0;
  class Element {
    constructor() {
      this.listeners = {}; this.attributes = {}; this.dataset = {}; this.textContent = '';
      this.classes = new Set(); this.style = { setProperty() {} };
      this.classList = { add: k => this.classes.add(k), contains: k => this.classes.has(k),
        toggle: (k, on) => on ? this.classes.add(k) : this.classes.delete(k) };
    }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    emit(type, event = {}) { return Promise.all((this.listeners[type] || []).map(fn => fn(event))); }
    setAttribute(k, v) { this.attributes[k] = v; }
    removeAttribute(k) { delete this.attributes[k]; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 40 }; }
    cloneNode() { const clone = new Element(); clone.querySelector = () => new Element(); return clone; }
    remove() {} focus() {} contains() { return false; }
  }
  const nodes = Object.fromEntries(['yonder-demo', 'video-control', 'brew-pill-hero', 'copy-label', 'copy-status', 'install-fallback', 'install-tip-trigger', 'install-tip'].map(id => [id, new Element()]));
  const video = nodes['yonder-demo'];
  video.paused = true; video.currentTime = 0; video.duration = 48; video.loop = true; video.readyState = 4; video.videoWidth = video.videoHeight = 1080;
  const source = new Element(); source.dataset.src = 'demo.mp4';
  video.querySelectorAll = () => [source]; video.load = () => {};
  video.play = () => { video.paused = false; video.emit('play'); return Promise.resolve(); };
  video.pause = () => { if (!video.paused) { video.paused = true; video.emit('pause'); } };
  nodes['video-control'].querySelector = () => new Element();
  nodes['install-tip-trigger'].parentElement = new Element();
  const document = new Element(); document.hidden = false;
  document.getElementById = id => nodes[id]; document.querySelectorAll = () => [];
  document.body = { appendChild() {} };
  document.createElement = () => ({ width: 0, height: 0, getContext: () => null });
  const window = new Element(); window.IntersectionObserver = true; window.trackYonder = (...args) => events.push(args);
  const media = new Element(); media.matches = reduced;
  vm.runInNewContext(landingSource, {
    document, window, navigator: { connection: { saveData }, clipboard: {
      writeText: async command => { assert.match(command, /^curl -fsSL .*install-yonder.sh \| bash$/); if (clipboardFails) throw Error('denied'); }
    } }, location: { href: 'https://yonder.site/alternative.html' }, URL,
    matchMedia: () => media, performance: { now: () => clock }, innerWidth: 375,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = ++timerId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    IntersectionObserver: class {
      constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
      observe() {} disconnect() {}
    }
  });
  const visibility = observers.find(o => o.options.threshold);
  return { video, events, nodes, document, timers, intervals,
    visible: ratio => visibility.callback([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]),
    tick: (advance = true) => { clock += 250; if (advance && !video.paused) video.currentTime = (video.currentTime + .25) % video.duration; [...intervals.values()].forEach(fn => fn()); } };
}
(async () => {
  const page = landing();
  page.visible(1);
  assert.equal(page.video.paused, false);
  assert.equal(page.intervals.size, 1);
  for (let i = 0; i < 40; i++) page.tick(false);
  assert.equal(page.events.filter(e => e[0] === 'demo_engaged').length, 0, 'buffering is not watch time');
  for (let i = 0; i < 40; i++) page.tick();
  assert.equal(page.events.filter(e => e[0] === 'demo_engaged').length, 1);
  page.visible(0);
  assert.equal(page.video.paused, true);
  assert.equal(page.intervals.size, 0);
  page.visible(1);
  assert.equal(page.video.paused, false);
  assert.equal(page.events.filter(e => e[0] === 'demo_toggle').length, 0, 'automatic visibility pauses are not manual engagement');
  await page.nodes['video-control'].emit('click');
  assert.equal(page.video.paused, true);
  page.visible(0); page.visible(1);
  assert.equal(page.video.paused, true, 'user pause must survive visibility changes');
  await page.nodes['video-control'].emit('click');
  page.document.hidden = true; await page.document.emit('visibilitychange');
  assert.equal(page.video.paused, true);
  assert.equal(page.intervals.size, 0);
  page.document.hidden = false; await page.document.emit('visibilitychange');
  assert.equal(page.video.paused, false);
  for (let i = 0; i < 45; i++) page.tick();
  assert.equal(page.events.filter(e => e[0] === 'demo_engaged').length, 1);
  await page.nodes['brew-pill-hero'].emit('click');
  assert.equal(page.events.filter(e => e[0] === 'install_copy_success').length, 1);
  const denied = landing({ clipboardFails: true });
  await denied.nodes['brew-pill-hero'].emit('click');
  assert.equal(denied.events.filter(e => e[0] === 'install_copy_error').length, 1);
  assert.equal(denied.events.filter(e => e[0] === 'install_copy_success').length, 0);
  assert.equal(denied.nodes['install-fallback'].hidden, false);
  for (const options of [{ reduced: true }, { saveData: true }]) {
    const page = landing(options); page.visible(1);
    assert.equal(page.video.paused, true);
    assert.equal(page.intervals.size, 0);
    await page.nodes['video-control'].emit('click');
    assert.equal(page.video.paused, false, 'manual playback remains available');
  }
  console.log('Passed: production-only analytics, privacy opt-outs, deduplication, playback visibility, user pause, engagement, copy success/failure, reduced motion and Save-Data.');
})().catch(error => { console.error(error); process.exitCode = 1; });
