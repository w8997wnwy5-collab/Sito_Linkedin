// site.js: the page around the Landscape world (built from js-a + js-b).
import { createWorld } from './world.js';
import { sound } from './audio.js';

const d = document, root = d.documentElement, W = window;
const mm = (q) => !!(W.matchMedia && W.matchMedia(q).matches);
const calm = mm('(prefers-reduced-motion: reduce)');
const fine = mm('(hover: hover) and (pointer: fine)');
const small = Math.min(screen.width, screen.height) < 700;
const clipOK = !!(W.CSS && CSS.supports && CSS.supports('overflow-x', 'clip'));
root.classList.add('js');
if (!calm) root.classList.add('anim');
if (fine) root.classList.add('fine');

const $ = (s, c) => (c || d).querySelector(s);
const $$ = (s, c) => Array.prototype.slice.call((c || d).querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const r1 = (n) => Math.round(n * 10) / 10;
const scrollY = () => W.scrollY || W.pageYOffset || 0;
const docTop = (el) => el.getBoundingClientRect().top + scrollY();
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const LI = 'https://www.linkedin.com/in/matteo-carva-b503681a3/';

let vw = 0, vh = 0, sy = 0, lastW = 0, lastH = 0, docH = 0;
let px = -9999, py = -9999, hasPointer = false, rafId = 0;
const schedule = () => { if (!rafId) rafId = W.requestAnimationFrame(frame); };

/* ---------- your visit = an SAP transport request ---------- */
const TR = 'DEVK9' + String(Math.floor(Math.random() * 100000)).padStart(5, '0');
$$('.tr-id').forEach((e) => { e.textContent = TR; });
const bootTr = $('#boot-tr'); if (bootTr) bootTr.textContent = TR;

/* ---------- the world ---------- */
const canvas = $('#world');
let world = null;
if (!calm) { try { world = createWorld(canvas, { mobile: small || !fine }); } catch (e) { console.warn(e); world = null; } }
if (world) root.classList.add('world');

/* ---------- sky synced with the time in Lugano ---------- */
let skyLabel = '';
function luganoHour() {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = +p.find((x) => x.type === 'hour').value % 24, m = +p.find((x) => x.type === 'minute').value;
    return h + m / 60;
  } catch (e) { return new Date().getHours(); }
}
const SKY = {
  night: { top: [.008, .014, .04], bot: [.045, .06, .16], glow: [.35, .25, .55], amt: .18 },
  dawn: { top: [.03, .04, .11], bot: [.2, .11, .22], glow: [1, .48, .42], amt: .45 },
  day: { top: [.02, .05, .13], bot: [.08, .16, .34], glow: [.45, .62, 1], amt: .3 },
  dusk: { top: [.02, .025, .07], bot: [.22, .09, .1], glow: [1, .45, .18], amt: .55 }
};
function mixSky(a, b, t) { const o = {}; for (const k of ['top', 'bot', 'glow']) o[k] = a[k].map((v, i) => lerp(v, b[k][i], t)); o.amt = lerp(a.amt, b.amt, t); return o; }
function skyNow() {
  const h = luganoHour();
  const keys = [[0, 'night'], [5.6, 'night'], [7, 'dawn'], [8.6, 'day'], [16, 'day'], [17.2, 'dusk'], [18.6, 'night'], [24, 'night']];
  let i = 0; while (i < keys.length - 2 && h >= keys[i + 1][0]) i++;
  const [h0, k0] = keys[i], [h1, k1] = keys[i + 1];
  skyLabel = h < 5.6 || h >= 18.6 ? 'night' : h < 8.6 ? 'dawn' : h < 16 ? 'day' : 'sunset';
  return mixSky(SKY[k0], SKY[k1], clamp((h - h0) / Math.max(.01, h1 - h0), 0, 1));
}
function applySky() {
  if (!world) return;
  if (theme() === 'light') world.sky([.97, .975, .99], [.92, .935, .97], [1, .62, .32], .12, [.95, .955, .975]);
  else { const s = skyNow(); world.sky(s.top, s.bot, s.glow, s.amt, [.006, .009, .024]); }
  $$('[data-sky]').forEach((e) => { e.textContent = theme() === 'light' ? '' : '· ' + skyLabel; });
}

/* ---------- theme (circular view transition) ---------- */
const themeBtn = $('#theme'), metaTheme = $('meta[name="theme-color"]');
function theme() { return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
function paintThemeBtn() { themeBtn.setAttribute('aria-label', theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); }
function applyTheme(t) {
  root.setAttribute('data-theme', t);
  store.set('mc-theme', t);
  if (metaTheme) metaTheme.setAttribute('content', t === 'light' ? '#F3F5FA' : '#05070E');
  paintThemeBtn();
  if (world) { world.theme(t); applySky(); }
}
function toggleTheme(ev) {
  const next = theme() === 'dark' ? 'light' : 'dark';
  if (d.startViewTransition && !calm) {
    const x = (ev && ev.clientX) || vw - 48, y = (ev && ev.clientY) || 32;
    const rad = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
    const tr = d.startViewTransition(() => applyTheme(next));
    tr.ready.then(() => { root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] }, { duration: 720, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }); }).catch(() => {});
  } else applyTheme(next);
}
themeBtn.addEventListener('click', toggleTheme);
paintThemeBtn();
if (world) world.theme(theme());
applySky();
setInterval(applySky, 60000);

/* ---------- sound (off by default) ---------- */
const soundBtn = $('#sound');
function paintSound() { soundBtn.classList.toggle('on', sound.on); soundBtn.setAttribute('aria-pressed', sound.on ? 'true' : 'false'); soundBtn.setAttribute('aria-label', sound.on ? 'Turn sound off' : 'Turn sound on'); }
soundBtn.addEventListener('click', async () => { await sound.set(!sound.on); store.set('mc-sound', sound.on ? 'on' : 'off'); paintSound(); });
paintSound();

/* ---------- pointer → world ---------- */
function onPointer(e) {
  px = e.clientX; py = e.clientY;
  if (e.pointerType === 'mouse') hasPointer = true;
  if (world) world.pointer((px / (vw || 1)) * 2 - 1, 1 - (py / (vh || 1)) * 2, e.pointerType === 'mouse' || e.type === 'pointerdown');
  if (calm) schedule();
}
W.addEventListener('pointermove', onPointer, { passive: true });
W.addEventListener('pointerdown', onPointer, { passive: true });
W.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && world) world.pointer(0, 0, false); }, { passive: true });
root.addEventListener('mouseleave', () => { hasPointer = false; if (world) world.pointer(0, 0, false); if (cur) cur.classList.remove('on'); });
// click on empty space = sonar ping across the lake
d.addEventListener('click', (e) => {
  if (!world || e.defaultPrevented) return;
  if (e.target.closest('a,button,input,dialog,.pane,.tile,.card,.cred,.now-card,.pal,.pv,.hud,.bar,.sk-col,.tb-grid')) return;
  if (world.ripple((e.clientX / vw) * 2 - 1, 1 - (e.clientY / vh) * 2)) sound.ping();
});

/* ---------- header: progress, scroll spy, sliding pill ---------- */
const progI = $('.prog i'), nav = $('.nav'), navLinks = $$('.nav a'), pill = $('.nav .pill');
const spyIds = ['profile', 'experience', 'projects', 'skills', 'credentials', 'contact'];
let spyTops = [], here = -2, hov = -1, lastProg = -1;
function movePill(i) {
  if (!pill || !nav) return;
  if (i < 0 || !navLinks[i]) { nav.classList.remove('has'); return; }
  const a = navLinks[i];
  pill.style.width = a.offsetWidth + 'px';
  pill.style.transform = 'translate3d(' + a.offsetLeft + 'px,-50%,0)';
  nav.classList.add('has');
}
navLinks.forEach((a, i) => {
  a.addEventListener('pointerenter', () => { hov = i; movePill(i); sound.tick(); });
  a.addEventListener('focus', () => { hov = i; movePill(i); });
  a.addEventListener('blur', () => { hov = -1; movePill(here); });
});
if (nav) nav.addEventListener('pointerleave', () => { hov = -1; movePill(here); });
function updateHeader() {
  const max = docH - vh, pr = max > 0 ? clamp(sy / max, 0, 1) : 0;
  if (Math.abs(pr - lastProg) > .0005) { lastProg = pr; progI.style.transform = 'scaleX(' + pr.toFixed(4) + ')'; }
  let h = -1;
  for (let i = 0; i < spyTops.length; i++) if (spyTops[i] - sy <= vh * .4) h = i;
  if (h !== here) {
    here = h;
    navLinks.forEach((a, j) => { a.classList.toggle('here', j === h); if (j === h) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (hov < 0) movePill(h);
  }
}

/* ---------- hero pin, camera stations, visitor transport ---------- */
const hero = $('#top'), heroFade = $$('.hero-fade');
let pinExtra = 1, heroPinned = false, anchors = [], intro = calm ? 1 : 0, introT0 = 0, booted = false;
let seg = 0, segDone = false, lastStep = -1, sNow = 0, projIdx = -1, hiSkill = -1;
function sectionAnchor(id, k) { const el = d.getElementById(id); return el ? docTop(el) - vh * (k === undefined ? .18 : k) : 0; }
function measureHero() {
  hero.classList.remove('is-pinned'); hero.style.height = '';
  heroPinned = false;
  if (world && clipOK) { heroPinned = true; pinExtra = Math.round(vh * (vw < 700 ? .9 : 1.05)); hero.classList.add('is-pinned'); hero.style.height = (vh + pinExtra) + 'px'; }
}
function measureStations() {
  // the camera rests on a station while a section is read and flies between sections
  const hold = (id, k) => { const el = d.getElementById(id); if (!el) return; const t = docTop(el), b = t + el.offsetHeight; a.push([t - vh * .3, k], [Math.max(t - vh * .3 + 1, b - vh * .85), k]); };
  const a = [[0, 0], [pinExtra * .9, 1]];
  hold('profile', 2); hold('experience', 3);
  if (wmode === 'h') a.push([workTop - vh * .15, 4], [workTop + travelW, 5]);
  else { const el = d.getElementById('projects'), t = docTop(el); a.push([t - vh * .3, 4], [t + el.offsetHeight - vh * .85, 5]); }
  hold('skills', 6); hold('credentials', 7);
  a.push([Math.min(docTop(d.getElementById('contact')) - vh * .35, docH - vh - 2), 8]);
  for (let i = 1; i < a.length; i++) if (a[i][0] <= a[i - 1][0]) a[i][0] = a[i - 1][0] + 1;
  anchors = a;
}
function stationAt(y) {
  const a = anchors; if (!a.length) return 0;
  if (y <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) if (y < a[i][0]) return lerp(a[i - 1][1], a[i][1], (y - a[i - 1][0]) / (a[i][0] - a[i - 1][0]));
  return a[a.length - 1][1];
}
const hud = $('.hud'), hudSteps = $$('.hud-steps span'), hudBar = $('.hud-bar i'), hudMsg = $('.hud-msg'), hudPct = $('.hud .pct');
const rcSt = $('.c-rc-st');
let hudState = '';
function updateTransport() {
  const max = Math.max(1, docH - vh), p = clamp(sy / max, 0, 1);
  seg = sstep(.035, .44, p) + sstep(.5, .93, p);
  const step = seg >= 1.98 ? 3 : seg >= .98 ? 2 : seg > .02 ? 1 : 0;
  let msg, pct;
  if (step === 0) { msg = 'Created. Scroll to release it.'; pct = 0; }
  else if (step === 1) { pct = Math.round(clamp(seg / .98, 0, 1) * 100); msg = 'Importing into QAS · ' + pct + '%'; }
  else if (step === 2) { pct = Math.round(clamp((seg - 1) / .98, 0, 1) * 100); msg = 'Importing into PRD · ' + pct + '%'; }
  else { pct = 100; msg = 'Imported into PRD · RC 0'; }
  const key = step + '|' + msg;
  if (key !== hudState) {
    hudState = key;
    hudMsg.textContent = msg;
    hudPct.textContent = step === 3 ? 'RC 0' : (step === 0 ? '0%' : (step === 1 ? 'QAS ' : 'PRD ') + pct + '%');
    hudSteps.forEach((el, i) => { el.classList.toggle('ok', i < step); el.classList.toggle('on', i === step); });
    hud.classList.toggle('done', step === 3);
    if (rcSt) rcSt.textContent = step === 3 ? 'imported into PRD · RC 0 ✓' : step === 2 ? 'importing into PRD · ' + pct + '%' : step === 1 ? 'importing into QAS · ' + pct + '%' : 'waiting for release';
  }
  hudBar.style.transform = 'scaleX(' + (seg / 2).toFixed(4) + ')';
  hud.classList.toggle('hide-foot', sy > docH - vh * 1.15);
  if (step !== lastStep) {
    if (lastStep >= 0 && step > lastStep) { if (step === 3) { sound.done(); if (world && !segDone) world.boom(); segDone = true; } else sound.step(); }
    if (step < 3) segDone = false;
    lastStep = step;
  }
}
function updateHero() {
  const p = heroPinned ? clamp(sy / pinExtra, 0, 1) : 0;
  const fade = 1 - sstep(.02, .32, p);
  heroFade.forEach((e) => { e.style.opacity = fade.toFixed(3); e.style.visibility = fade < .01 ? 'hidden' : ''; });
  return p;
}

/* ---------- projected labels ---------- */
const L = {}; $$('.l3').forEach((e) => { L[e.getAttribute('data-a')] = e; });
const A = {};
const bills = ['DEV', 'QAS', 'PRD'].map((k) => L[k] && L[k].firstElementChild);
let billKey = ['', '', ''];
function setBill(i, st, ok) {
  const key = st + ok; if (billKey[i] === key || !bills[i]) return; billKey[i] = key;
  bills[i].querySelector('.st').textContent = st; bills[i].classList.toggle('ok', ok);
}
const skName = $('.sk-name');
const labW = {};
function measureLabels() { for (const k in L) { const c = L[k].firstElementChild; labW[k] = c ? c.offsetWidth : 0; } }
function showLabel(k, on, anchorKey) {
  const e = L[k]; if (!e) return;
  const a = A[anchorKey || k];
  const vis = on && a && a.on && a.x > -40 && a.x < vw + 40 && a.y > 40 && a.y < vh - 20;
  e.classList.toggle('on', !!vis);
  if (!vis) return;
  // keep labels inside the viewport (bills sit to the right of their anchor, tags are centred)
  const w = labW[k] || 0, c = e.firstElementChild;
  const x = c && c.classList.contains('bill3') ? Math.min(a.x, vw - 24 - w) : clamp(a.x, w / 2 + 8, vw - w / 2 - 8);
  e.style.transform = 'translate3d(' + r1(x) + 'px,' + r1(a.y) + 'px,0)';
}
function updateLabels() {
  if (!world) return;
  world.anchors(A);
  const s = sNow, foot = sy > docH - vh * 1.25;
  const plates = ((s > .55 && s < 2.45) || s > 7.55) && !foot;
  ['DEV', 'QAS', 'PRD'].forEach((k) => showLabel(k, plates));
  showLabel('PKT', plates && seg > .02);
  setBill(0, seg > .02 ? 'released' : 'modifiable', seg > .02);
  setBill(1, seg >= .98 ? 'imported · RC 0' : 'in queue', seg >= .98);
  setBill(2, seg >= 1.98 ? 'imported · RC 0' : 'in queue', seg >= 1.98);
  const city = s > 2.45 && s < 3.7;
  showLabel('LUGANO', city); showLabel('ROMA', city);
  for (let i = 0; i < 5; i++) { showLabel('P' + i, s > 3.6 && s < 5.45); const t = L['P' + i] && L['P' + i].firstElementChild; if (t) t.classList.toggle('hot', Math.round(projIdx) === i); }
  showLabel('SK', s > 5.4 && s < 6.65 && hiSkill >= 0, 'S' + (hiSkill + 1));
  ['E1', 'E2', 'E3'].forEach((k, i) => showLabel(k, s > 6.5 && s < 7.6 && (i === 0 || vw > 600)));
}

/* ---------- reveal on scroll ---------- */
const rvEls = $$('[data-rv]');
if (!calm && 'IntersectionObserver' in W) {
  const rio = new IntersectionObserver((es) => { es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } }); }, { rootMargin: '0px 0px -6% 0px', threshold: .1 });
  rvEls.forEach((el) => rio.observe(el));
} else rvEls.forEach((el) => el.classList.add('in'));

/* ---------- headings light up word by word ---------- */
const whData = [];
function splitWords(el) {
  const words = [];
  (function walk(node) {
    Array.prototype.slice.call(node.childNodes).forEach((k) => {
      if (k.nodeType === 3) {
        const frag = d.createDocumentFragment();
        k.textContent.split(/(\s+)/).forEach((p) => { if (!p) return; if (/^\s+$/.test(p)) frag.appendChild(d.createTextNode(p)); else { const s = d.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); words.push(s); } });
        node.replaceChild(frag, k);
      } else if (k.nodeType === 1) walk(k);
    });
  })(el);
  $$('.gt', el).forEach((g) => g.classList.add('split'));
  return words;
}
if (!calm) $$('[data-wh]').forEach((el) => whData.push({ el, w: splitWords(el), top: 0, h: 1, last: -1 }));
function measureWH() { whData.forEach((o) => { o.top = docTop(o.el); o.h = o.el.offsetHeight; o.last = -1; }); }
function updateWH() {
  for (const o of whData) {
    const top = o.top - sy; if (top > vh || top + o.h < 0) continue;
    const k = Math.round(clamp((vh * .9 - top) / (vh * .45), 0, 1) * (o.w.length + 1) * 20) / 20;
    if (k === o.last) continue; o.last = k;
    o.w.forEach((w, j) => { w.style.opacity = (.16 + .84 * clamp(k - j, 0, 1)).toFixed(2); });
  }
}

/* ---------- bento: spotlight, clocks, counters ---------- */
const bento = $('.bento'), tiles = $$('.tile'), dims = $$('.dimx');
let bentoTop = 0;
if (fine && bento) bento.addEventListener('pointermove', (e) => { tiles.forEach((t) => { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); t.style.setProperty('--my', (e.clientY - r.top) + 'px'); }); });
const clocks = $$('[data-clock]'), tzEls = $$('[data-tz]');
let fmt = null, tzFmt = null;
try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) {}
try { tzFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', timeZoneName: 'short' }); } catch (e) {}
function tick() {
  if (!fmt) return;
  const now = new Date(), s = fmt.format(now); let tz = '';
  try { tz = (tzFmt.formatToParts(now).find((p) => p.type === 'timeZoneName') || {}).value || ''; } catch (e) {}
  clocks.forEach((c) => { c.textContent = c.getAttribute('data-clock') === 'hm' ? s.slice(0, 5) : s; });
  if (tz) tzEls.forEach((t) => { t.textContent = tz; });
}
tick(); setInterval(tick, 1000);
if (!calm && 'IntersectionObserver' in W) {
  const co = new IntersectionObserver((es) => {
    es.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target, end = parseFloat(el.getAttribute('data-count')), suf = el.getAttribute('data-suffix') || '', t0 = performance.now(), dur = 1300;
      (function step(now) { const p = Math.min((now - t0) / dur, 1), k = 1 - Math.pow(1 - p, 3); el.innerHTML = Math.round(end * k).toLocaleString('en-US') + (suf ? '<small>' + suf + '</small>' : ''); if (p < 1) W.requestAnimationFrame(step); })(t0);
      co.unobserve(el);
    });
  }, { threshold: .6 });
  $$('[data-count]:not([data-plain])').forEach((el) => co.observe(el));
}
function updateProfile() {
  if (calm) return;
  const p = clamp((vh * .95 - (bentoTop - sy)) / (vh * .5), 0, 1);
  dims.forEach((dm, i) => { dm.style.transform = 'scaleX(' + ease(clamp(p * 1.6 - i * .2, 0, 1)).toFixed(3) + ')'; });
}

/* ---------- experience timeline ---------- */
const tl = $('.tl'), tlItems = $$('.tl-i'), acts = $$('.acts li');
let tlTop = 0, tlH = 1, tlDots = [], actTops = [];
function measureExp() { tlTop = docTop(tl); tlH = tl.offsetHeight || 1; tlDots = tlItems.map((li) => li.offsetTop + 14); actTops = acts.map((li) => docTop(li) + li.offsetHeight / 2); }
function updateExp() {
  if (calm) return;
  const p = clamp((vh * .7 - (tlTop - sy)) / tlH, 0, 1);
  tl.style.setProperty('--tp', p.toFixed(3));
  tlItems.forEach((li, i) => li.classList.toggle('on', tlDots[i] <= p * tlH + 2));
  const line = sy + vh * .8;
  acts.forEach((li, j) => li.classList.toggle('on', actTops[j] <= line));
}

/* ---------- projects: pinned horizontal track (desktop) / swipe (phones) ---------- */
const work = $('#projects'), track = $('.hs-track'), cards = $$('.card'), hsCount = $('#hs-count'), hsBar = $('.hs-bar i'), nReal = cards.length;
let wmode = 'v', travelW = 0, workTop = 0, trackTop = 0, cardX = [], cardW = [], cardD = [], hsIdx = -1, lastBar = -1;
function measureWork() {
  work.classList.remove('is-h'); work.style.height = ''; track.style.transform = ''; wmode = 'v';
  if (!calm && clipOK && vw >= 860 && vh >= 560) { work.classList.add('is-h'); travelW = Math.max(0, track.scrollWidth - vw); work.style.height = (vh + travelW) + 'px'; wmode = 'h'; }
}
function measureCards() { workTop = docTop(work); trackTop = docTop(track); cardX = cards.map((c) => c.offsetLeft); cardW = cards.map((c) => c.offsetWidth); cardD = []; }
function setDraw(i, v) { v = Math.round(v * 200) / 200; if (cardD[i] === v) return; cardD[i] = v; cards[i].style.setProperty('--d', v); }
function setCount(idx, p) {
  if (idx !== hsIdx) { hsIdx = idx; hsCount.textContent = (idx < 9 ? '0' : '') + (idx + 1) + ' / ' + (nReal < 10 ? '0' : '') + nReal; }
  if (Math.abs(p - lastBar) > .0005) { lastBar = p; hsBar.style.transform = 'scaleX(' + p.toFixed(4) + ')'; }
}
function updateWork() {
  if (wmode === 'h') {
    const p = travelW ? clamp((sy - workTop) / travelW, 0, 1) : 0, x = -p * travelW;
    if (sy > workTop - vh && sy < workTop + travelW + vh) track.style.transform = 'translate3d(' + r1(x) + 'px,0,0)';
    cards.forEach((c, i) => setDraw(i, clamp(1 - (Math.abs(cardX[i] + cardW[i] / 2 + x - vw * .5) - vw * .22) / (vw * .3), 0, 1)));
    setCount(Math.min(nReal - 1, Math.floor(p * nReal)), p);
    projIdx = sy < workTop - vh * .6 || sy > workTop + travelW + vh * .6 ? -1 : p * (nReal - 1);
  } else {
    const top = trackTop - sy;
    if (top > vh || top < -vh) { projIdx = -1; return; }
    const sl = track.scrollLeft, max = track.scrollWidth - track.clientWidth, vis = calm ? 1 : clamp((vh * .95 - top) / (vh * .4), 0, 1);
    cards.forEach((c, j) => { const cx = cardX[j] + cardW[j] / 2 - sl; setDraw(j, calm ? 1 : vis * clamp(1 - (Math.abs(cx - vw * .5) - vw * .3) / (vw * .35), 0, 1)); });
    const p2 = max > 0 ? clamp(sl / max, 0, 1) : 0;
    setCount(clamp(Math.round(p2 * (nReal - 1)), 0, nReal - 1), p2);
    projIdx = p2 * (nReal - 1);
  }
}
track.addEventListener('scroll', schedule, { passive: true });
function tiltable(el, maxX, maxY, glare) {
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || calm) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', ((.5 - y) * maxX).toFixed(2) + 'deg'); el.style.setProperty('--ry', ((x - .5) * maxY).toFixed(2) + 'deg');
    if (glare) { el.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); }
    else { el.style.setProperty('--hx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--hy', (y * 100).toFixed(1) + '%'); }
    el.classList.add('tilt');
  });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('tilt'); });
}
if (fine) { cards.forEach((c) => tiltable(c, 7, 9, true)); $$('.cred').forEach((c) => tiltable(c, 10, 12, false)); }

/* ---------- skills: lists drive the 3D satellites ---------- */
$$('[data-sk]').forEach((li) => {
  const k = +li.getAttribute('data-sk') - 1, name = (li.children[1] || li).textContent;
  const on = () => { hiSkill = k; if (skName) { skName.textContent = name; labW.SK = skName.offsetWidth; } li.classList.add('hi'); sound.tick(); };
  const off = () => { if (hiSkill === k) hiSkill = -1; li.classList.remove('hi'); };
  li.addEventListener('pointerenter', on); li.addEventListener('pointerleave', off);
  li.addEventListener('click', () => { if (hiSkill === k) off(); else { $$('[data-sk].hi').forEach((x) => x.classList.remove('hi')); on(); } });
});

/* ---------- magnetic buttons ---------- */
if (fine && !calm) $$('[data-mag]').forEach((b) => {
  const s = parseFloat(b.getAttribute('data-mag')) || .25;
  b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = 'translate3d(' + ((e.clientX - (r.left + r.width / 2)) * s).toFixed(1) + 'px,' + ((e.clientY - (r.top + r.height / 2)) * s).toFixed(1) + 'px,0)'; });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
});

/* ---------- cursor ring ---------- */
const cur = $('.cur'), ring = cur && $('.ring', cur), curLab = cur && $('.ring span', cur);
let cx = -100, cy = -100, curOn = false;
if (cur && fine && !calm) {
  d.addEventListener('pointerover', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-cur],a,button,input,[role="option"],[data-sk]') : null;
    const l = t && t.getAttribute('data-cur');
    cur.classList.toggle('hot', !!t && !l); cur.classList.toggle('lab', !!l); if (l) curLab.textContent = l;
  });
  d.addEventListener('pointerdown', () => cur.classList.add('down'));
  d.addEventListener('pointerup', () => cur.classList.remove('down'));
}
function updateCursor() {
  if (!cur || !fine || calm || !hasPointer) return;
  if (!curOn) { curOn = true; cx = px; cy = py; }
  cur.classList.add('on'); cx = lerp(cx, px, .24); cy = lerp(cy, py, .24);
  ring.style.transform = 'translate3d(' + r1(cx) + 'px,' + r1(cy) + 'px,0)';
}

/* ---------- toast ---------- */
const toastEl = $('.toast'), toastMsg = $('.toast .msg');
let toastT = 0;
function toast(msg, err) { toastMsg.textContent = msg; toastEl.classList.toggle('err', !!err); toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3200); if (err) sound.err(); else sound.tick(); }

/* ---------- smooth auto-scroll (STMS replay) ---------- */
let asRAF = 0, asStop = null;
function autoScroll(to, dur, done) {
  if (asStop) asStop();
  const from = scrollY(), t0 = performance.now(); let stopped = false;
  root.style.scrollBehavior = 'auto';
  const stop = () => { if (stopped) return; stopped = true; W.cancelAnimationFrame(asRAF); root.style.scrollBehavior = ''; asStop = null; W.removeEventListener('wheel', stop); W.removeEventListener('touchstart', stop); W.removeEventListener('keydown', stop); };
  asStop = stop;
  W.addEventListener('wheel', stop, { passive: true }); W.addEventListener('touchstart', stop, { passive: true }); W.addEventListener('keydown', stop);
  (function step(now) { if (stopped) return; const p = clamp((now - t0) / dur, 0, 1); W.scrollTo(0, from + (to - from) * ease(p)); if (p < 1) asRAF = W.requestAnimationFrame(step); else { stop(); if (done) done(); } })(t0);
}
function replay() {
  if (calm) { W.scrollTo(0, docH); return; }
  autoScroll(0, Math.min(1400, 350 + scrollY() * .1), () => setTimeout(() => autoScroll(docH - vh, 9000), 300));
}
function go(hash) {
  if (hash === '#top') { W.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }); return; }
  const el = $(hash); if (el) W.scrollTo({ top: docTop(el) + 1, behavior: calm ? 'auto' : 'smooth' });
}

/* ---------- privacy: popup + full notice ---------- */
const pv = $('#pv'), pdlg = $('#privacy');
function openPrivacy() { if (pdlg && pdlg.showModal) { if (!pdlg.open) pdlg.showModal(); } else if (pdlg) pdlg.setAttribute('open', ''); }
$$('[data-privacy]').forEach((b) => b.addEventListener('click', openPrivacy));
if (pdlg) pdlg.addEventListener('click', (e) => { if (e.target === pdlg) pdlg.close(); });
function showPv() {
  if (!pv || store.get('mc-privacy') === 'ok') { hud.classList.remove('off'); return; }
  pv.hidden = false; requestAnimationFrame(() => pv.classList.add('show'));
}
$('#pv-ok').addEventListener('click', () => {
  store.set('mc-privacy', 'ok'); pv.classList.remove('show'); setTimeout(() => { pv.hidden = true; }, 500);
  hud.classList.remove('off'); toast('Privacy check · RC 0 · nothing collected');
});

/* ---------- command palette (sections, actions, SAP t-codes) ---------- */
const ICON = {
  home: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>', grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  orbit: '<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9.5" ry="4"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)"/>', badge: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', play: '<path d="M7 4.5v15l12-7.5z"/>', theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor"/>',
  link: '<path d="M7 17 17 7M9 7h8v8"/>', run: '<path d="m5 7 5 5-5 5M12 17h7"/>', shield: '<path d="M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6z"/>', sound: '<path d="M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6"/>'
};
const CMDS = [
  { g: 'Sections', t: 'Home', k: 'SMEN', ic: 'home', run: () => go('#top') },
  { g: 'Sections', t: 'Profile', k: 'SU01', ic: 'user', run: () => go('#profile') },
  { g: 'Sections', t: 'Experience', k: 'SM37', ic: 'case', run: () => go('#experience') },
  { g: 'Sections', t: 'Projects', k: 'SPRO', ic: 'grid', run: () => go('#projects') },
  { g: 'Sections', t: 'Skills', k: 'SM50', ic: 'orbit', run: () => go('#skills') },
  { g: 'Sections', t: 'Credentials', k: 'STRUST', ic: 'badge', run: () => go('#credentials') },
  { g: 'Sections', t: 'Contact', k: 'SBWP', ic: 'chat', run: () => go('#contact') },
  { g: 'Actions', t: 'Replay your transport import', k: 'STMS', ic: 'play', run: replay },
  { g: 'Actions', t: 'Switch light / dark theme', k: 'SU3', ic: 'theme', run: () => toggleTheme() },
  { g: 'Actions', t: 'Sound on / off', k: '', ic: 'sound', run: () => soundBtn.click() },
  { g: 'Actions', t: 'Privacy notice', k: '', ic: 'shield', run: openPrivacy },
  { g: 'Actions', t: 'Open LinkedIn profile', k: 'LINKEDIN', ic: 'link', run: () => W.open(LI, '_blank', 'noopener') }
];
const EGGS = { ST22: 'ST22 · No runtime errors today', SM21: 'SM21 · System log is clean', SICK: 'SICK · No errors reported', SM12: 'SM12 · No lock entries', SM13: 'SM13 · No update records', SU53: 'SU53 · All authorizations granted' };
const pal = $('#pal'), palBox = $('.pal-box'), palQ = $('#pal-q'), palList = $('#pal-list');
let palSel = 0, palView = [], palLast = null;
const svgI = (n) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[n] || '') + '</svg>';
function runCode(code) { if (EGGS[code]) { toast(EGGS[code]); return; } const hit = CMDS.find((c) => c.k === code); if (hit) hit.run(); else toast('Transaction ' + code + ' does not exist', true); }
function renderPal() {
  const raw = palQ.value.trim(), q = raw.toLowerCase().replace(/^\/[no]\s*/, '').trim();
  palView = CMDS.filter((c) => !q || c.t.toLowerCase().includes(q) || (c.k && c.k.toLowerCase().includes(q)) || c.g.toLowerCase().includes(q));
  const code = raw.replace(/^\/[no]/i, '').trim().toUpperCase();
  if (/^[A-Z0-9_]{2,20}$/.test(code) && (raw.charAt(0) === '/' || !palView.length || EGGS[code]) && !palView.some((c) => c.k === code)) palView.push({ g: 'Transaction', t: 'Run /n' + code, k: code, ic: 'run', run: () => runCode(code) });
  palSel = clamp(palSel, 0, Math.max(0, palView.length - 1));
  palList.innerHTML = ''; let grp = '';
  palView.forEach((c, idx) => {
    if (c.g !== grp) { grp = c.g; const hd = d.createElement('li'); hd.className = 'grp'; hd.setAttribute('role', 'presentation'); hd.textContent = grp; palList.appendChild(hd); }
    const li = d.createElement('li'); li.id = 'pal-o' + idx; li.setAttribute('role', 'option');
    li.innerHTML = svgI(c.ic) + '<span class="pt"></span>' + (c.k ? '<span class="tc"></span>' : '');
    li.querySelector('.pt').textContent = c.t; if (c.k) li.querySelector('.tc').textContent = '/n' + c.k;
    li.addEventListener('click', () => { palSel = idx; runSel(); });
    li.addEventListener('pointermove', () => { if (palSel !== idx) { palSel = idx; markSel(); } });
    palList.appendChild(li);
  });
  if (!palView.length) { const em = d.createElement('li'); em.className = 'empty'; em.setAttribute('role', 'presentation'); em.textContent = 'Nothing found. Try a section name or a t-code like /nSTMS.'; palList.appendChild(em); }
  markSel();
}
function markSel() {
  $$('[role="option"]', palList).forEach((li, idx) => li.setAttribute('aria-selected', idx === palSel ? 'true' : 'false'));
  const c = $('#pal-o' + palSel);
  if (c) { palQ.setAttribute('aria-activedescendant', c.id); c.scrollIntoView({ block: 'nearest' }); } else palQ.removeAttribute('aria-activedescendant');
}
function runSel() { const c = palView[palSel]; if (!c) return; closePal(); setTimeout(() => c.run(), 40); }
function openPal() { if (!pal.hidden) return; palLast = d.activeElement; pal.hidden = false; palQ.value = ''; palSel = 0; renderPal(); if (fine) palQ.focus(); else palBox.focus(); sound.tick(); }
function closePal() { if (pal.hidden) return; pal.hidden = true; if (palLast && palLast.focus) palLast.focus({ preventScroll: true }); }
palQ.addEventListener('input', () => { palSel = 0; renderPal(); });
palQ.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palView.length - 1, palSel + 1); markSel(); sound.tick(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); markSel(); sound.tick(); }
  else if (e.key === 'Enter') { e.preventDefault(); runSel(); }
});
pal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePal(); } else if (e.key === 'Tab') { e.preventDefault(); palQ.focus(); } });
pal.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-close]')) closePal(); });
pal.addEventListener('wheel', (e) => { if (!e.target.closest('.pal-list')) e.preventDefault(); }, { passive: false });
$$('[data-pal]').forEach((b) => b.addEventListener('click', openPal));
d.addEventListener('keydown', (e) => {
  const k = e.key, tag = (e.target && e.target.tagName) || '';
  if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'K')) { e.preventDefault(); if (pal.hidden) openPal(); else closePal(); }
  else if (k === '/' && pal.hidden && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag) && !(e.target && e.target.isContentEditable)) { e.preventDefault(); openPal(); }
});
const kbd = $('#kbd');
if (kbd && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')) kbd.textContent = '⌘K';

/* ---------- role decode ---------- */
const dec = $('.role .dec'), decFinal = dec ? dec.textContent : '';
let decBusy = false;
function decode() {
  if (!dec || calm || decBusy) return; decBusy = true;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>*+', n = decFinal.length, t0 = performance.now(), dur = 1100, at = [];
  for (let i = 0; i < n; i++) at.push((i / n) * dur * .65 + Math.random() * dur * .35);
  (function step(now) { const el = now - t0; let out = ''; for (let i = 0; i < n; i++) { const c = decFinal.charAt(i); out += c === ' ' || el >= at[i] ? c : chars.charAt((Math.random() * chars.length) | 0); } dec.textContent = out; if (el < dur) W.requestAnimationFrame(step); else { dec.textContent = decFinal; decBusy = false; } })(t0);
}
if (dec && fine) $('.role').addEventListener('pointerenter', decode);

/* ---------- footer wordmark stretches as it enters ---------- */
const wm = $('.wm'), wmIn = $('.wm span');
let wmTop = 0, wmLast = -1;
function measureWM() { if (!wm) return; wm.style.fontSize = ''; wmIn.style.fontVariationSettings = '"wght" 900, "wdth" 125'; const cs = parseFloat(getComputedStyle(wm).fontSize) || 100, w = wmIn.offsetWidth || 1, cw = wm.clientWidth || vw; wm.style.fontSize = (cs * cw * .97 / w).toFixed(2) + 'px'; wmTop = docTop(wm); wmLast = -1; }
function updateWM() {
  if (!wm) return; const top = wmTop - sy;
  if (top > vh + 50) { if (wmLast !== 0) { wmLast = 0; wmIn.style.fontVariationSettings = '"wght" 250, "wdth" 75'; } return; }
  let p = calm ? 1 : clamp((vh - top) / (vh * .55), 0, 1); p = Math.round(ease(p) * 200) / 200;
  if (p === wmLast) return; wmLast = p; wmIn.style.fontVariationSettings = '"wght" ' + Math.round(250 + 650 * p) + ', "wdth" ' + (75 + 50 * p).toFixed(1);
}

/* ---------- measure + main loop ---------- */
function measure() {
  vw = root.clientWidth; vh = W.innerHeight; sy = scrollY(); lastW = vw; lastH = vh;
  measureHero(); measureWork();
  bentoTop = bento ? docTop(bento) : 0;
  measureExp(); measureCards(); measureWH(); measureWM();
  spyTops = spyIds.map((id) => { const el = d.getElementById(id); return el ? docTop(el) : 1e9; });
  docH = root.scrollHeight; here = -2; hsIdx = -1; lastProg = -1; lastBar = -1;
  measureStations();
  measureLabels();
  if (world) world.resize();
}
let lastNow = 0, slow = 0, fast = 0, qual = 1;
function frame(now) {
  rafId = 0;
  const dt = lastNow ? Math.min(100, now - lastNow) : 16.7; lastNow = now;
  sy = scrollY();
  const hp = updateHero();
  updateHeader(); updateTransport(); updateWH(); updateProfile(); updateExp(); updateWork(); updateWM(); updateCursor();
  if (world) {
    sNow = stationAt(sy);
    if (!calm && booted) intro = clamp((now - introT0) / 2600, 0, 1);
    world.set({ s: sNow, intro, morph: heroPinned ? sstep(.06, .72, hp) : 1, packet: seg, proj: projIdx, hiSkill: sNow > 5.3 && sNow < 6.7 ? hiSkill : -1 });
    world.render(now);
    updateLabels();
    // adaptive quality for slower devices
    if (booted && now - introT0 > 3000) {
      if (dt > 30) slow++; else if (dt < 20) fast++;
      if (slow > 50 && qual > .55) { qual = Math.max(.55, qual - .15); world.quality(qual); slow = 0; fast = 0; }
      if (fast > 400) { slow = 0; fast = 0; }
    }
  }
  if (world || !calm) schedule();
}
W.addEventListener('scroll', schedule, { passive: true });
let rT = 0;
W.addEventListener('resize', () => { const w = root.clientWidth, h = W.innerHeight; if (w === lastW && Math.abs(h - lastH) < 120) return; clearTimeout(rT); rT = setTimeout(() => { measure(); schedule(); }, 140); });
const remeasure = () => { measure(); schedule(); };
W.addEventListener('load', remeasure);

/* ---------- boot ---------- */
const boot = $('.boot'), bootLis = $$('.boot-log li'), bootBar = $('.boot-bar i'), bootPts = $('#boot-pts');
function finishBoot() {
  booted = true; introT0 = performance.now();
  boot.classList.add('out');
  setTimeout(() => { boot.remove(); }, 900);
  if (!calm) { setTimeout(decode, 900); }
  setTimeout(showPv, 1400);
  schedule();
}
measure();
schedule();
const fontsReady = (d.fonts && d.fonts.load ? Promise.all([d.fonts.load('800 100px "MC Outline"'), d.fonts.ready]) : Promise.resolve()).catch(() => {});
if (calm || !world) {
  fontsReady.then(() => { remeasure(); finishBoot(); });
} else {
  const t0 = performance.now();
  bootLis.forEach((li, i) => setTimeout(() => { li.classList.add('on'); bootBar.style.transform = 'scaleX(' + ((i + 1) / bootLis.length) + ')'; if (i === 1 && bootPts) { const n = world.count; let k = 0; const id = setInterval(() => { k = Math.min(n, k + Math.ceil(n / 8)); bootPts.textContent = k.toLocaleString('en-US'); if (k >= n) clearInterval(id); }, 30); } }, 120 + i * 230));
  fontsReady.then(() => {
    world.buildName('"MC Outline", "Mona Sans", sans-serif');
    remeasure();
    setTimeout(finishBoot, Math.max(0, 1250 - (performance.now() - t0)));
  });
}
if (store.get('mc-sound') === 'on') {
  // browsers need a gesture before audio: arm it on the first interaction
  const arm = () => { sound.set(true).then(paintSound); W.removeEventListener('pointerdown', arm); W.removeEventListener('keydown', arm); };
  W.addEventListener('pointerdown', arm); W.addEventListener('keydown', arm);
}
