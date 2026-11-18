// cv.js: interactions for the interactive CV.
import { createMesh } from './mesh.js';

const d = document, root = d.documentElement, W = window;
const mm = (q) => !!(W.matchMedia && W.matchMedia(q).matches);
const calm = mm('(prefers-reduced-motion: reduce)');
const fine = mm('(hover: hover) and (pointer: fine)');
root.classList.add('js');
if (!calm) root.classList.add('anim');
if (fine) root.classList.add('fine');
const $ = (s, c) => (c || d).querySelector(s);
const $$ = (s, c) => Array.from((c || d).querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const LI = 'https://www.linkedin.com/in/matteo-carva-b503681a3/';
let vw = root.clientWidth, vh = W.innerHeight, px = -1, py = -1, hasPointer = false;

/* ---------- years in SAP Basis (since November 2019) ---------- */
const years = Math.max(1, Math.floor((Date.now() - new Date(2019, 10, 1).getTime()) / (365.25 * 864e5)));
const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
$$('[data-years]').forEach((e) => { e.textContent = years; });
$$('[data-yw]').forEach((e) => { e.textContent = WORDS[years] || years; });

/* ---------- toast ---------- */
const toastEl = $('.toast'), toastMsg = $('.toast .msg');
let toastT = 0;
function toast(msg) { toastMsg.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }

/* ---------- theme ---------- */
const themeBtn = $('#theme');
const theme = () => root.getAttribute('data-theme') || (mm('(prefers-color-scheme: dark)') ? 'dark' : 'light');
function paintTheme() { themeBtn.setAttribute('aria-label', theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); $$('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', theme() === 'dark' ? '#07090F' : '#F4F5F9')); }
function applyTheme(t) { root.setAttribute('data-theme', t); store.set('mc-theme', t); paintTheme(); if (mesh) mesh.theme(t); }
function toggleTheme(ev) {
  const next = theme() === 'dark' ? 'light' : 'dark';
  if (d.startViewTransition && !calm) {
    const x = (ev && ev.clientX) || vw - 40, y = (ev && ev.clientY) || 30, r = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
    const tr = d.startViewTransition(() => applyTheme(next));
    tr.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  } else applyTheme(next);
}
themeBtn.addEventListener('click', toggleTheme);

/* ---------- hero gradient ---------- */
const hero = $('#top');
let mesh = null;
try { mesh = createMesh($("#mesh"), { calm }); } catch (e) { mesh = null; }
if (mesh) { root.classList.add('gl'); mesh.theme(theme()); }
paintTheme();
if (W.matchMedia) W.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!root.getAttribute('data-theme')) { paintTheme(); if (mesh) mesh.theme(theme()); } });
if (mesh && 'IntersectionObserver' in W) new IntersectionObserver((es) => es.forEach((e) => mesh.visible(e.isIntersecting))).observe(hero);

/* ---------- header: progress, scroll spy, sliding pill ---------- */
const progI = $('.prog i'), nav = $('.nav'), navLinks = $$('.nav a'), pill = $('.nav .pill');
const spy = navLinks.map((a) => d.getElementById(a.getAttribute('href').slice(1)));
let here = -2, hov = -1;
function movePill(i) {
  if (i < 0 || !navLinks[i]) { nav.classList.remove('has'); return; }
  const a = navLinks[i]; pill.style.width = a.offsetWidth + 'px'; pill.style.transform = 'translate3d(' + a.offsetLeft + 'px,-50%,0)'; nav.classList.add('has');
}
navLinks.forEach((a, i) => { a.addEventListener('pointerenter', () => { hov = i; movePill(i); }); a.addEventListener('focus', () => { hov = i; movePill(i); }); a.addEventListener('blur', () => { hov = -1; movePill(here); }); });
nav.addEventListener('pointerleave', () => { hov = -1; movePill(here); });
function updateHeader() {
  const sy = W.scrollY, max = root.scrollHeight - vh;
  progI.style.transform = 'scaleX(' + (max > 0 ? clamp(sy / max, 0, 1) : 0).toFixed(4) + ')';
  let h = -1; spy.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= vh * .35) h = i; });
  if (h !== here) { here = h; navLinks.forEach((a, j) => { a.classList.toggle('here', j === h); if (j === h) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); if (hov < 0) movePill(h); }
}

/* ---------- kinetic name ---------- */
const nameEl = $('.name'), chs = $$('.name .ch'), nW = chs.map(() => 0);
let nameLive = false;
function updateName() {
  if (!fine || calm) return false;
  if (!nameLive && (!hasPointer || py > vh * .8 || W.scrollY > vh)) return false;
  const rects = chs.map((c) => c.getBoundingClientRect()); let any = false;
  rects.forEach((r, i) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dist = Math.hypot(px - cx, (py - cy) * 1.5);
    let f = hasPointer ? clamp(1 - dist / 240, 0, 1) : 0; f = f * f * (3 - 2 * f);
    let v = lerp(nW[i], f, .16); if (Math.abs(v - f) < .003) v = f;
    if (v !== nW[i]) { nW[i] = v; any = true; }
  });
  nameLive = any;
  if (any) chs.forEach((c, j) => { c.style.fontVariationSettings = '"wght" ' + Math.round(820 + 80 * nW[j]) + ', "wdth" ' + (112 + 13 * nW[j]).toFixed(1); });
  return any;
}
function wave() { if (calm) return; nameEl.classList.remove('wave'); void nameEl.offsetWidth; nameEl.classList.add('wave'); }
if (!fine) { nameEl.addEventListener('click', wave); setTimeout(wave, 1700); }

/* ---------- evidence finder + spotlight ---------- */
const REQ = [
  ['S/4HANA & core Basis', 's4', 'S/4HANA conversion', 's4'], ['S/4HANA & core Basis', 'rise', 'RISE with SAP', 'rise'], ['S/4HANA & core Basis', 'upg', 'Upgrades & SUM DMO', 'upg dmo'],
  ['S/4HANA & core Basis', 'hana', 'HANA & System Replication', 'hana'], ['S/4HANA & core Basis', 'dr', 'Backup & disaster recovery', 'dr'], ['S/4HANA & core Basis', 'ops', 'Transports & operations', 'ops'],
  ['BTP & cloud', 'btp', 'SAP BTP', 'btp'], ['BTP & cloud', 'sso', 'Single sign-on & IAS', 'sso'], ['BTP & cloud', 'calm', 'SAP Cloud ALM', 'calm'],
  ['BTP & cloud', 'atc', 'Clean Core & ATC', 'atc'], ['BTP & cloud', 'azure', 'Cloud migration (Azure)', 'azure'], ['BTP & cloud', 'bw', 'SAP BW', 'bw'],
  ['AI & leadership', 'joule', 'Joule', 'joule'], ['AI & leadership', 'docai', 'Document AI', 'docai'], ['AI & leadership', 'genai', 'GenAI & vector search', 'genai'], ['AI & leadership', 'lead', 'Team leadership', 'lead'],
  [null, 'wd', 'Web Dispatcher', 'wd'], [null, 'ecs', 'SAP ECS', 'ecs']
].map(([g, id, label, tags]) => ({ g, id, label, tags: tags.split(' ') }));
const RQ = Object.fromEntries(REQ.map((r) => [r.id, r]));
const EV = $$('[data-ev]').map((el) => ({ el, kind: el.getAttribute('data-ev'), tags: (el.getAttribute('data-tags') || '').split(/\s+/).filter(Boolean), title: el.getAttribute('data-t') || el.textContent.trim() }));
const evFor = (r) => EV.filter((e) => e.tags.some((t) => r.tags.includes(t)));
const groupsEl = $('#groups');
const groups = {};
REQ.filter((r) => r.g).forEach((r) => { (groups[r.g] = groups[r.g] || []).push(r); });
Object.keys(groups).forEach((g) => {
  const box = d.createElement('div'); box.className = 'grp';
  box.innerHTML = '<span class="mono"></span><ul class="chips"></ul>'; box.firstChild.textContent = g;
  groups[g].forEach((r) => { const li = d.createElement('li'); li.innerHTML = '<button class="req" type="button" aria-pressed="false"><span class="lb"></span><span class="ct" aria-hidden="true"></span></button>'; const b = li.firstChild; b.dataset.req = r.id; b.querySelector('.lb').textContent = r.label; b.querySelector('.ct').textContent = evFor(r).length; b.setAttribute('aria-label', r.label + ', ' + evFor(r).length + ' pieces of evidence'); box.lastChild.appendChild(li); });
  groupsEl.appendChild(box);
});
// skill chips show how much evidence they have
$$('.sk [data-req]').forEach((b) => { const r = RQ[b.dataset.req]; if (!r) return; const n = evFor(r).length; const c = d.createElement('span'); c.className = 'ct'; c.setAttribute('aria-hidden', 'true'); c.textContent = n; b.appendChild(c); b.setAttribute('aria-pressed', 'false'); });
$$('.tag[data-req]').forEach((b) => b.setAttribute('aria-pressed', 'false'));

const sel = new Set();
const out = $('#finder-out'), sumEl = $('#fo-sum'), list = $('#ev-list'), spotbar = $('#spotbar'), spotTxt = $('#spot-txt');
let finderVisible = false;
const KIND = { proj: ['Project', 'proj', 0], cert: ['Certification', 'cert', 1], role: ['Experience', 'role', 2] };
function hitsNow() {
  const tags = new Set(); sel.forEach((id) => RQ[id].tags.forEach((t) => tags.add(t)));
  return EV.map((e) => ({ e, n: e.tags.filter((t) => tags.has(t)).length })).filter((x) => x.n > 0)
    .sort((a, b) => (KIND[a.e.kind][2] - KIND[b.e.kind][2]) || (b.n - a.n));
}
function labels() { return Array.from(sel).map((id) => RQ[id].label); }
function apply(changed) {
  const on = sel.size > 0, hits = hitsNow(), set = new Set(hits.map((h) => h.e.el));
  root.classList.toggle('spot', on);
  EV.forEach((e) => e.el.classList.toggle('hit', set.has(e.el)));
  $$('[data-req]').forEach((b) => { const p = sel.has(b.dataset.req); b.classList.toggle('on', p); if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', p ? 'true' : 'false'); });
  out.hidden = !on;
  if (on) {
    const cnt = { proj: 0, cert: 0, role: 0 }; hits.forEach((h) => cnt[h.e.kind]++);
    const parts = [cnt.proj && cnt.proj + (cnt.proj > 1 ? ' projects' : ' project'), cnt.cert && cnt.cert + (cnt.cert > 1 ? ' certifications and courses' : ' certification or course'), cnt.role && cnt.role + (cnt.role > 1 ? ' responsibilities' : ' responsibility')].filter(Boolean);
    sumEl.innerHTML = '';
    const s1 = d.createElement('span'); s1.textContent = hits.length + ' pieces of evidence for '; const em = d.createElement('em'); em.textContent = labels().join(', '); sumEl.append(s1, em);
    list.innerHTML = '';
    hits.forEach((h, i) => {
      const li = d.createElement('li'), b = d.createElement('button'); b.type = 'button'; b.className = 'ev'; b.style.setProperty('--i', Math.min(i, 12));
      const k = d.createElement('span'); k.className = 'k ' + KIND[h.e.kind][1]; k.textContent = KIND[h.e.kind][0];
      const tx = d.createElement('span'); const bb = d.createElement('b'); bb.textContent = h.e.title; tx.appendChild(bb);
      b.append(k, tx); b.addEventListener('click', () => show(h.e.el)); li.appendChild(b); list.appendChild(li);
    });
    spotTxt.innerHTML = '';
    const sb = d.createElement('b'); sb.textContent = labels().join(', '); spotTxt.append('Evidence for ', sb, ' · ' + parts.join(' · '));
  }
  spotbar.classList.toggle('on', on && !finderVisible);
  if (changed && on && !fine) toast(hits.length + ' pieces of evidence highlighted');
}
function toggle(id) { if (!RQ[id]) return; if (sel.has(id)) sel.delete(id); else sel.add(id); apply(true); }
function clearSel() { sel.clear(); apply(false); }
d.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-req]'); if (b && b.tagName === 'BUTTON') toggle(b.dataset.req); });
$('#fo-clear').addEventListener('click', clearSel);
$('#spot-clear').addEventListener('click', clearSel);
d.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel.size && !$('#privacy').open) clearSel(); });
function show(el) {
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
  const card = el.closest('.card') || el; card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
}
$('#fo-copy').addEventListener('click', async () => {
  const hits = hitsNow(), by = (k) => hits.filter((h) => h.e.kind === k).map((h) => '• ' + h.e.title);
  const lines = ['Matteo Carva · SAP Basis & BTP Specialist · Lugano, Switzerland', 'Evidence for: ' + labels().join(', '), ''];
  const add = (title, arr) => { if (arr.length) lines.push(title, ...arr, ''); };
  add('Projects', by('proj')); add('Certifications and courses', by('cert')); add('Experience', by('role'));
  lines.push('LinkedIn: ' + LI, 'CV: https://matteocarva.ch/');
  const text = lines.join('\n');
  try { await navigator.clipboard.writeText(text); toast('Summary copied'); }
  catch (e) { const ta = d.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; d.body.appendChild(ta); ta.select(); try { d.execCommand('copy'); toast('Summary copied'); } catch (_) { toast('Copy not available'); } ta.remove(); }
});
if ('IntersectionObserver' in W) new IntersectionObserver((es) => es.forEach((e) => { finderVisible = e.isIntersecting; spotbar.classList.toggle('on', sel.size > 0 && !finderVisible); }), { threshold: .15 }).observe($('.finder'));

/* ---------- the SAP stack: hover a layer, see the proof ---------- */
const stk = $('#stack');
const stack = stk ? (function () {
  const lays = $$('.stk-lay', stk), lbs = $$('.stk-lb', stk), spine = $('.stk-spine', stk);
  const ro = $('#stk-ro'), roN = $('.stk-ro-n', ro), roName = $('.stk-ro-name', ro), roTx = $('.stk-ro-tx', ro), roGo = $('.stk-ro-go', ro), roCt = $('.stk-ro-go .ct', ro), roHint = $('.stk-hint', stk);
  const ORDER = [3, 4, 5, 1, 2], CYCLE = 4600;
  const srcOf = (n) => (n === 0 ? spine : lbs.find((b) => +b.dataset.l === n));
  const count = (reqs) => { const tags = new Set(); reqs.split(' ').forEach((id) => RQ[id] && RQ[id].tags.forEach((t) => tags.add(t))); return EV.filter((e) => e.tags.some((t) => tags.has(t))).length; };
  let cur = -1, pin = -1, auto = !calm, idx = 0, timer = 0, vis = true, sx = 0, sy = 0;
  roHint.textContent = fine ? 'Hover a layer' : 'Tap a layer';
  function show(n, user) {
    const src = srcOf(n); if (!src || n === cur) return;
    cur = n;
    lays.forEach((g) => g.classList.toggle('on', +g.dataset.l === n));
    lbs.forEach((b) => { const on = +b.dataset.l === n; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on && pin === n ? 'true' : 'false'); });
    stk.classList.add('focus'); stk.classList.toggle('ops', n === 0);
    ro.setAttribute('data-l', n); stk.setAttribute('data-l', n);
    roN.textContent = n ? '0' + n + ' / 05' : 'Every layer';
    roName.textContent = n ? src.querySelector('b').textContent : 'Run & operate';
    roTx.textContent = src.dataset.proof;
    roGo.dataset.reqs = src.dataset.reqs; roCt.textContent = count(src.dataset.reqs);
    roTx.classList.remove('swap'); void roTx.offsetWidth; roTx.classList.add('swap');
    if (user) roTx.setAttribute('aria-live', 'polite');
  }
  function bar() { ro.classList.remove('run'); if (!auto) return; void ro.offsetWidth; ro.style.setProperty('--cycle', CYCLE + 'ms'); ro.classList.add('run'); }
  function stop() { if (!auto) return; auto = false; clearInterval(timer); ro.classList.remove('run'); roHint.textContent = fine ? 'Click a layer to pin it' : 'Tap a layer'; }
  function tick() { if (!auto || !vis || d.hidden) return; idx = (idx + 1) % ORDER.length; show(ORDER[idx]); bar(); }
  show(ORDER[0]);
  if (auto) { bar(); timer = setInterval(tick, CYCLE); }
  const pick = (n, how) => {
    stop();
    if (how === 'hover') { show(n, true); return; }
    pin = n; cur = -1; show(n, true);
  };
  lays.forEach((g) => {
    const n = +g.dataset.l;
    g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pick(n, 'hover'); });
    g.addEventListener('click', () => pick(n, 'click'));
  });
  lbs.forEach((b) => {
    const n = +b.dataset.l;
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pick(n, 'hover'); });
    b.addEventListener('focus', () => pick(n, 'hover'));
    b.addEventListener('click', () => pick(n, 'click'));
  });
  spine.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pick(0, 'hover'); });
  spine.addEventListener('focus', () => pick(0, 'hover'));
  spine.addEventListener('click', () => pick(0, 'click'));
  stk.addEventListener('pointerleave', () => { if (pin >= 0 && pin !== cur) show(pin); });
  roGo.addEventListener('click', () => {
    stop(); sel.clear(); roGo.dataset.reqs.split(' ').forEach((id) => { if (RQ[id]) sel.add(id); }); apply(true);
    $('#fit').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  });
  if ('IntersectionObserver' in W) new IntersectionObserver((es) => es.forEach((e) => { vis = e.isIntersecting; stk.classList.toggle('off', !vis); })).observe(stk);
  return {
    update() {
      if (!fine || calm || !vis) return;
      const r = stk.getBoundingClientRect();
      const tx = hasPointer ? clamp((px - (r.left + r.width * .35)) / (vw * .5), -1, 1) : 0, ty = hasPointer ? clamp((py - (r.top + r.height * .5)) / (vh * .7), -1, 1) : 0;
      const nx = lerp(sx, tx, .07), ny = lerp(sy, ty, .07);
      if (Math.abs(nx - sx) < .0004 && Math.abs(ny - sy) < .0004) return;
      sx = nx; sy = ny;
      lays.forEach((g) => { const k = +g.dataset.d; g.style.transform = 'translate3d(' + (-sx * k).toFixed(2) + 'px,' + (-sy * .7 * k).toFixed(2) + 'px,0)'; });
    }
  };
})() : null;

/* ---------- reveal, counters ---------- */
const rv = $$('[data-rv]');
if (!calm && 'IntersectionObserver' in W) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  rv.forEach((el) => io.observe(el));
  const co = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; co.unobserve(e.target);
    const el = e.target, end = +el.getAttribute('data-count'), t0 = performance.now();
    (function step(now) { const p = Math.min((now - t0) / 1300, 1), k = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(end * k).toLocaleString('en-US'); if (p < 1) requestAnimationFrame(step); })(t0);
  }), { threshold: .6 });
  $$('[data-count]').forEach((el) => co.observe(el));
} else rv.forEach((el) => el.classList.add('in'));

/* ---------- pause decorative loops while they are off screen ---------- */
if ('IntersectionObserver' in W) {
  const vo = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('vis', e.isIntersecting)), { rootMargin: '60px 0px' });
  $$('.finder,.pj,.cert').forEach((el) => vo.observe(el));
}

/* ---------- tilt on project and certification cards, magnetic buttons ---------- */
if (fine && !calm) {
  $$('.pj,.cert').forEach((el) => {
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; el.style.setProperty('--tx', ((.5 - y) * 6).toFixed(2) + 'deg'); el.style.setProperty('--ty', ((x - .5) * 8).toFixed(2) + 'deg'); el.style.setProperty('--hx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--hy', (y * 100).toFixed(1) + '%'); el.classList.add('tilt'); });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0deg'); el.style.setProperty('--ty', '0deg'); el.classList.remove('tilt'); });
  });
  $$('[data-mag]').forEach((b) => {
    const s = parseFloat(b.getAttribute('data-mag')) || .2;
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = 'translate3d(' + ((e.clientX - r.left - r.width / 2) * s).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * s).toFixed(1) + 'px,0)'; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ---------- privacy ---------- */
const pv = $('#pv'), pdlg = $('#privacy');
const openPrivacy = () => { if (pdlg.showModal) { if (!pdlg.open) pdlg.showModal(); } else pdlg.setAttribute('open', ''); };
$$('[data-privacy]').forEach((b) => b.addEventListener('click', openPrivacy));
pdlg.addEventListener('click', (e) => { if (e.target === pdlg) pdlg.close(); });
if (store.get('mc-privacy') !== 'ok') setTimeout(() => { pv.hidden = false; requestAnimationFrame(() => pv.classList.add('show')); }, 1400);
$('#pv-ok').addEventListener('click', () => { store.set('mc-privacy', 'ok'); pv.classList.remove('show'); setTimeout(() => { pv.hidden = true; }, 450); });

/* ---------- pointer + loop ---------- */
W.addEventListener('pointermove', (e) => {
  px = e.clientX; py = e.clientY; if (e.pointerType === 'mouse') hasPointer = true;
  if (mesh) { const r = hero.getBoundingClientRect(); mesh.pointer(clamp((px - r.left) / r.width, 0, 1), clamp(1 - (py - r.top) / r.height, 0, 1)); }
}, { passive: true });
root.addEventListener('mouseleave', () => { hasPointer = false; });
W.addEventListener('resize', () => { vw = root.clientWidth; vh = W.innerHeight; if (mesh) mesh.size(); movePill(here); });
function frame(now) {
  updateHeader();
  updateName();
  if (stack) stack.update();
  if (mesh && !calm) mesh.draw(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
