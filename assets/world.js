// world.js: the Landscape, a point-cloud Lake Lugano with the SAP landscape floating above it.
import { TAU, clamp, lerp, sstep, perspective, lookAt, mul, rng, noise, height, lakeDist, contours, sampleText, program, buffer, attribs, resetAttribs } from './world-core.js';
import { SKY, TERRAIN, NAME, GLOW, LINES } from './world-shaders.js';

export const LAYOUT = {
  plates: [6, 11, 16], plateC: [0, -40], plateHalf: 6,
  lugano: [-16, -21], rome: [-6, 32],
  projects: [[-28, -74], [-14, -78], [0, -80], [14, -78], [28, -74]],
  skillsC: [0, 16, -40],
  stars: [[-4, 54, -112], [-20, 48, -108], [12, 49, -110], [-38, 33, -100], [-28, 38, -104], [-15, 34, -100], [-1, 39, -106], [13, 34, -102], [27, 38, -104], [39, 31, -98]]
};

// camera stations: 0 hero, 1 platforms, 2 profile, 3 experience, 4-5 projects, 6 skills, 7 credentials, 8 contact
const ST = [
  { pos: [0, 12, 30], tgt: [0, 13, -26], fov: 50 },
  { pos: [21, 19, -12], tgt: [-3, 11, -41], fov: 50 },
  { pos: [-32, 24, -16], tgt: [-11, 8, -47], fov: 52 },
  { pos: [10, 48, 40], tgt: [14, 0, -10], fov: 50 },
  { pos: [-30, 12, -48], tgt: [-18, 8, -78], fov: 50 },
  { pos: [30, 12, -48], tgt: [18, 8, -78], fov: 50 },
  { pos: [-8, 26, 0], tgt: [11, 16, -35], fov: 50 },
  { pos: [0, 10, 2], tgt: [-22, 36, -104], fov: 54 },
  { pos: [0, 30, 30], tgt: [0, -10, -40], fov: 50 }
];

const COL = {
  dark: {
    low: [.2, .36, .92], high: [.86, .93, 1], lake: [.34, .55, 1], hot: [1, .56, .24], city: [1, .72, .38], nameT: [.42, .58, 1],
    plate: [.48, .66, 1, .6], plateOn: [1, .56, .24, .95], contour: [.36, .52, 1, .11], route: [1, .62, .32, .95],
    mono: [.5, .68, 1, .5], monoOn: [1, .6, .3, .95], ring: [.5, .68, 1, .42], cons: [.8, .85, 1, .5],
    node: [.55, .72, 1], nodeOn: [1, .58, .26], star: [.85, .9, 1], ink: 0, size: 1
  },
  light: {
    low: [.2, .33, .72], high: [.05, .09, .24], lake: [.36, .5, .9], hot: [.9, .36, .07], city: [.9, .4, .08], nameT: [.2, .32, .74],
    plate: [.15, .28, .77, .8], plateOn: [.89, .34, .06, .95], contour: [.15, .28, .77, .2], route: [.89, .34, .06, .95],
    mono: [.15, .28, .77, .65], monoOn: [.89, .34, .06, .95], ring: [.15, .28, .77, .45], cons: [.15, .28, .77, .5],
    node: [.18, .32, .8], nodeOn: [.89, .34, .06], star: [.2, .3, .6], ink: 1, size: 1.15
  }
};

export function createWorld(canvas, opts = {}) {
  let gl = null;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const mobile = !!opts.mobile;
  let P;
  try { P = { sky: program(gl, SKY.vs, SKY.fs), ter: program(gl, TERRAIN.vs, TERRAIN.fs), name: program(gl, NAME.vs, NAME.fs), glow: program(gl, GLOW.vs, GLOW.fs), lines: program(gl, LINES.vs, LINES.fs) }; }
  catch (e) { console.warn('[world] shader error', e); return null; }
  resetAttribs();

  /* ---------- terrain ---------- */
  const R = rng(7), dz = mobile ? 1.3 : .84, dx = mobile ? .44 : .28;
  const tp = [], ti = [], land = [];
  for (let z = -114; z <= 34; z += dz) for (let x = -72; x <= 72; x += dx) {
    const jx = x + (R() - .5) * dx * .7, jz = z + (R() - .5) * dz * .1;
    const ld = lakeDist(jx, jz), lake = ld < 0 ? 1 : 0;
    if (lake && R() < .3) continue;
    const h = lake ? 0 : height(jx, jz);
    const city = !lake && ld < 3.2 && h < 4 && R() < (Math.hypot(jx - LAYOUT.lugano[0], jz - LAYOUT.lugano[1]) < 6 ? .35 : .018);
    tp.push(jx, h + (city ? .15 : 0), jz); ti.push(city ? 2 : lake, R());
    if (!lake && jz > -70 && jz < 18 && Math.abs(jx) < 46) land.push(jx, h, jz);
  }
  // shuffle so any prefix is an even sample (lets us draw fewer points on slow devices)
  const nT = tp.length / 3, order = new Uint32Array(nT);
  for (let i = 0; i < nT; i++) order[i] = i;
  for (let i = nT - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
  const TP = new Float32Array(nT * 3), TI = new Float32Array(nT * 2);
  for (let i = 0; i < nT; i++) { const o = order[i]; TP[i * 3] = tp[o * 3]; TP[i * 3 + 1] = tp[o * 3 + 1]; TP[i * 3 + 2] = tp[o * 3 + 2]; TI[i * 2] = ti[o * 2]; TI[i * 2 + 1] = ti[o * 2 + 1]; }
  const B = { tPos: buffer(gl, TP), tInfo: buffer(gl, TI) };

  /* ---------- contours (topographic lines) ---------- */
  const CT = contours(-72, 72, -114, 34, mobile ? 2.2 : 1.5, [3, 6, 9, 12, 15, 18, 21, 24, 27]);
  B.cPos = buffer(gl, CT); B.cT = buffer(gl, new Float32Array(CT.length / 3));
  const nC = CT.length / 3;

  /* ---------- line objects ---------- */
  const lineObjs = {};
  function addLines(key, pts, ts) {
    lineObjs[key] = { pos: buffer(gl, new Float32Array(pts)), t: buffer(gl, new Float32Array(ts || new Array(pts.length / 3).fill(0))), n: pts.length / 3 };
  }
  const [pcx, pcz] = LAYOUT.plateC, ph = LAYOUT.plateHalf;
  const rot = (x, z) => [pcx + (x - z) * Math.SQRT1_2, pcz + (x + z) * Math.SQRT1_2];
  LAYOUT.plates.forEach((y, k) => {
    const pts = [];
    const seg = (ax, az, bx, bz) => { const a = rot(ax, az), b = rot(bx, bz); pts.push(a[0], y, a[1], b[0], y, b[1]); };
    seg(-ph, -ph, ph, -ph); seg(ph, -ph, ph, ph); seg(ph, ph, -ph, ph); seg(-ph, ph, -ph, -ph);
    for (let g = 1; g < 6; g++) { const v = -ph + g * 2 * ph / 6; seg(v, -ph, v, ph); seg(-ph, v, ph, v); }
    // component boxes, like PAS / AAS / HANA on the old drawing
    const box = (x0, z0, w, d) => { seg(x0, z0, x0 + w, z0); seg(x0 + w, z0, x0 + w, z0 + d); seg(x0 + w, z0 + d, x0, z0 + d); seg(x0, z0 + d, x0, z0); };
    box(-4.6, 1.2, 2.4, 1.8); if (k > 0) box(-1.6, 1.2, 2.4, 1.8); if (k > 1) box(-1.6, 3.6, 2.4, 1.4); box(1.8, .6, 2.8, 2.8);
    addLines('plate' + k, pts);
  });
  addLines('beam', [pcx, LAYOUT.plates[0], pcz, pcx, LAYOUT.plates[2], pcz], [0, 1]);
  // route Rome -> Lugano, following the ground
  const ctrl = [[LAYOUT.rome[0], LAYOUT.rome[1]], [-1, 18], [-9, 6], [-13, -6], [-17, -14], [LAYOUT.lugano[0], LAYOUT.lugano[1]]];
  const route = [], routeT = [];
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  const RP = [];
  for (let i = 0; i < ctrl.length - 1; i++) for (let k = 0; k < 40; k++) {
    const t = k / 40, a = ctrl[Math.max(0, i - 1)], b = ctrl[i], c = ctrl[i + 1], d = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const x = cr(a[0], b[0], c[0], d[0], t), z = cr(a[1], b[1], c[1], d[1], t);
    RP.push([x, Math.max(height(x, z), 0) + 1.3, z]);
  }
  RP.push([LAYOUT.lugano[0], 1.3, LAYOUT.lugano[1]]);
  for (let i = 0; i < RP.length - 1; i++) { route.push(...RP[i], ...RP[i + 1]); routeT.push(i / (RP.length - 1), (i + 1) / (RP.length - 1)); }
  addLines('route', route, routeT);
  const BEADS = 26, beads = Array.from({ length: BEADS }, (_, i) => RP[Math.round(i / (BEADS - 1) * (RP.length - 1))]);
  // project monoliths
  const monoTop = [];
  LAYOUT.projects.forEach(([x, z], i) => {
    const y0 = Math.min(height(x, z), 2.5), hgt = 9 + (i % 2) * 3.5 + (i === 2 ? 3 : 0), w = 1.7, pts = [];
    const c = [[-w, -w], [w, -w], [w, w], [-w, w]];
    for (let k = 0; k < 4; k++) {
      const a = c[k], b = c[(k + 1) % 4];
      pts.push(x + a[0], y0, z + a[1], x + b[0], y0, z + b[1]);
      pts.push(x + a[0], y0 + hgt, z + a[1], x + b[0], y0 + hgt, z + b[1]);
      pts.push(x + a[0], y0, z + a[1], x + a[0], y0 + hgt, z + a[1]);
    }
    for (let s = 1; s < 5; s++) { const yy = y0 + hgt * s / 5; for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; pts.push(x + a[0] * .985, yy, z + a[1] * .985, x + b[0] * .985, yy, z + b[1] * .985); } }
    addLines('mono' + i, pts);
    monoTop.push([x, y0 + hgt + 1.6, z]);
  });
  // skill rings
  const ring = (r, tiltX, rotY) => { const pts = []; for (let k = 0; k < 96; k++) for (const kk of [k, k + 1]) { const a = kk / 96 * TAU; let x = Math.cos(a) * r, y = 0, z = Math.sin(a) * r; const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX), z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX); const x3 = x * Math.cos(rotY) + z2 * Math.sin(rotY), z3 = -x * Math.sin(rotY) + z2 * Math.cos(rotY); pts.push(LAYOUT.skillsC[0] + x3, LAYOUT.skillsC[1] + y2, LAYOUT.skillsC[2] + z3); } return pts; };
  const RING = [{ r: 9.5, tx: .32, ry: .2, n: 6 }, { r: 15, tx: -.22, ry: .7, n: 8 }];
  RING.forEach((g, i) => addLines('ring' + i, ring(g.r, g.tx, g.ry)));
  // credentials constellation
  const cons = [], consT = [], S = LAYOUT.stars;
  const links = [[1, 0], [0, 2], [1, 5], [2, 7], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]];
  links.forEach(([a, b], i) => { cons.push(...S[a], ...S[b]); consT.push(i / links.length, (i + 1) / links.length); });
  addLines('cons', cons, consT);

  /* ---------- sky stars ---------- */
  const SN = mobile ? 700 : 1400, SP = new Float32Array(SN * 3), SC = new Float32Array(SN * 4), SS = new Float32Array(SN);
  for (let i = 0; i < SN; i++) {
    const az = R() * TAU, el = .08 + Math.pow(R(), .7) * 1.2, rad = 150 + R() * 30;
    SP[i * 3] = Math.cos(az) * Math.cos(el) * rad; SP[i * 3 + 1] = Math.sin(el) * rad * .7 + 4; SP[i * 3 + 2] = Math.sin(az) * Math.cos(el) * rad - 40;
    const w = .6 + R() * .4; SC[i * 4] = .8 * w; SC[i * 4 + 1] = .87 * w; SC[i * 4 + 2] = w; SC[i * 4 + 3] = .25 + R() * .6; SS[i] = 2.5 + R() * R() * 9;
  }
  B.sPos = buffer(gl, SP); B.sCol = buffer(gl, SC); B.sSize = buffer(gl, SS);

  /* ---------- dynamic glow nodes ---------- */
  const NN = 1 + 14 + 10 + 5 + 2 + 3 + 27, NP = new Float32Array(NN * 3), NC = new Float32Array(NN * 4), NS = new Float32Array(NN);
  B.nPos = buffer(gl, NP, gl.DYNAMIC_DRAW); B.nCol = buffer(gl, NC, gl.DYNAMIC_DRAW); B.nSize = buffer(gl, NS, gl.DYNAMIC_DRAW);

  /* ---------- name particles ---------- */
  let nameN = 0, nameReady = false;
  B.nmC = gl.createBuffer(); B.nmA = gl.createBuffer(); B.nmB = gl.createBuffer(); B.nmCol = gl.createBuffer(); B.nmS = gl.createBuffer();
  function buildName(font) {
    const asp = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const lines = asp < 1 ? ['MATTEO', 'CARVA'] : ['MATTEO CARVA'];
    const target = mobile ? 8500 : 15000;
    const s = sampleText(lines, font, target);
    const n = s.pts.length; if (!n) return;
    const st = stationFor(0, asp), dist = Math.hypot(st.pos[2] - 0, st.pos[1] - 10.5);
    const visH = 2 * dist * Math.tan(st.fov * Math.PI / 360), visW = visH * asp;
    const width = Math.min(visW * (asp < 1 ? .88 : .84), 44), cy = st.pos[1] + visH * (asp < 1 ? .2 : .27);
    const C = new Float32Array(n * 3), A = new Float32Array(n * 3), Bt = new Float32Array(n * 3), K = new Float32Array(n * 3), S = new Float32Array(n);
    const rr = rng(99), nl = land.length / 3;
    for (let i = 0; i < n; i++) {
      const [x, y, line, u] = s.pts[i];
      A[i * 3] = x * width; A[i * 3 + 1] = cy + y * width; A[i * 3 + 2] = (rr() - .5) * .5;
      const a = rr() * TAU, b = Math.acos(rr() * 2 - 1), r = 18 + rr() * 26;
      C[i * 3] = Math.cos(a) * Math.sin(b) * r; C[i * 3 + 1] = cy + Math.cos(b) * r * .6; C[i * 3 + 2] = Math.sin(a) * Math.sin(b) * r - 12;
      const j = (rr() * nl) | 0; Bt[i * 3] = land[j * 3]; Bt[i * 3 + 1] = land[j * 3 + 1] + .05; Bt[i * 3 + 2] = land[j * 3 + 2];
      const second = lines.length === 1 ? (s.pts[i][3] > .52) : line === 1;
      let col;
      if (!second) col = [.93, .95, 1];
      else { const t = lines.length === 1 ? clamp((u - .52) / .48, 0, 1) : u; col = t < .5 ? [lerp(.48, .7, t * 2), lerp(.66, .55, t * 2), 1] : [lerp(.7, 1, (t - .5) * 2), lerp(.55, .56, (t - .5) * 2), lerp(1, .26, (t - .5) * 2)]; }
      K[i * 3] = col[0]; K[i * 3 + 1] = col[1]; K[i * 3 + 2] = col[2];
      S[i] = rr();
    }
    const up = (b, d) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); };
    up(B.nmC, C); up(B.nmA, A); up(B.nmB, Bt); up(B.nmCol, K); up(B.nmS, S);
    nameN = n; nameReady = true;
  }

  /* ---------- camera & state ---------- */
  const proj = new Float32Array(16), view = new Float32Array(16), PV = new Float32Array(16);
  const cam = { pos: ST[0].pos.slice(), tgt: ST[0].tgt.slice(), fov: ST[0].fov };
  let first = true;
  const st = { s: 0, intro: 0, morph: 0, packet: 0, proj: -1, hiSkill: -1, pointer: [0, 0, 0], ink: 0, boomT: -99, ripT: -99, ripX: 0, ripZ: 0 };
  let colors = COL.dark, theme = 'dark';
  const sky = { top: [.016, .024, .06], bot: [.05, .08, .2], glow: [.3, .2, .5], amt: .5, ground: [.008, .012, .03] };
  let W = 1, H = 1, pr = 1, quality = 1, terrainDraw = nT, t0 = performance.now(), time = 0, aspect = 1, lastT = 0;
  let hover = [0, 0, 0], mouseW = [0, 0, 0];
  const skillPos = [], credOn = new Float32Array(10);
  let boomDone = false;

  function stationFor(i, asp) {
    const s = ST[i];
    if (asp >= .9) return s;
    const k = asp < .65 ? 1.55 : 1.3;
    const C = { 1: [0, 11, -40], 2: [0, 11, -40], 3: [-10, 2, -6], 6: [0, 16, -40], 7: [0, 41, -106] };
    const tgt = C[i] || s.tgt;
    return { pos: s.pos.map((v, j) => tgt[j] + (v - s.tgt[j]) * k), tgt, fov: s.fov + 8 };
  }
  function desired(out) {
    const s = clamp(st.s, 0, ST.length - 1), i = Math.min(ST.length - 2, Math.floor(s)), t = s - i, e = t * t * (3 - 2 * t);
    const a = stationFor(i, aspect), b = stationFor(i + 1, aspect);
    for (let k = 0; k < 3; k++) { out.pos[k] = lerp(a.pos[k], b.pos[k], e); out.tgt[k] = lerp(a.tgt[k], b.tgt[k], e); }
    const travel = Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]);
    out.pos[1] += Math.sin(Math.PI * e) * Math.min(14, travel * .22);
    out.fov = lerp(a.fov, b.fov, e);
    // skills: slow orbit around the PRD system
    const orb = sstep(5.4, 6, s) * (1 - sstep(6, 6.6, s));
    if (orb > 0) {
      const c = LAYOUT.skillsC, ang = Math.sin(time * .11) * .32 * orb, dx = out.pos[0] - c[0], dz = out.pos[2] - c[2];
      out.pos[0] = c[0] + dx * Math.cos(ang) - dz * Math.sin(ang); out.pos[2] = c[2] + dx * Math.sin(ang) + dz * Math.cos(ang);
    }
    // breathing + pointer parallax
    out.pos[0] += Math.sin(time * .13) * .6 + st.pointer[0] * 1.4;
    out.pos[1] += Math.sin(time * .17) * .35 - st.pointer[1] * .9;
  }
  const want = { pos: [0, 0, 0], tgt: [0, 0, 0], fov: 50 };

  function resize() {
    const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
    pr = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.75) * quality;
    W = Math.max(2, Math.round(cw * pr)); H = Math.max(2, Math.round(ch * pr)); aspect = cw / Math.max(1, ch);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
  }

  function rayGround(nx, ny) {
    const f = [cam.tgt[0] - cam.pos[0], cam.tgt[1] - cam.pos[1], cam.tgt[2] - cam.pos[2]], fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
    let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const rl = Math.hypot(...r) || 1; r = r.map(v => v / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const th = Math.tan(cam.fov * Math.PI / 360);
    const d = [f[0] + r[0] * nx * th * aspect + u[0] * ny * th, f[1] + r[1] * nx * th * aspect + u[1] * ny * th, f[2] + r[2] * nx * th * aspect + u[2] * ny * th];
    if (d[1] > -.01) return null;
    let hY = 0, t = 0;
    for (let k = 0; k < 4; k++) { t = (hY - cam.pos[1]) / d[1]; const x = cam.pos[0] + d[0] * t, z = cam.pos[2] + d[2] * t; hY = Math.max(0, height(x, z)); }
    return [cam.pos[0] + d[0] * t, cam.pos[2] + d[2] * t];
  }

  function projectPt(p, out) {
    const x = p[0], y = p[1], z = p[2];
    const cx = PV[0] * x + PV[4] * y + PV[8] * z + PV[12], cy = PV[1] * x + PV[5] * y + PV[9] * z + PV[13], cw = PV[3] * x + PV[7] * y + PV[11] * z + PV[15];
    out.on = cw > .1; out.x = (cx / cw * .5 + .5) * (W / pr); out.y = (.5 - cy / cw * .5) * (H / pr); out.d = cw;
    return out;
  }

  function setBlend() {
    gl.enable(gl.BLEND);
    if (colors.ink) gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE);
  }
  function common(prog) {
    const u = prog.u;
    if (u.uPV) gl.uniformMatrix4fv(u.uPV, false, PV);
    if (u.uEye) gl.uniform3fv(u.uEye, cam.pos);
    if (u.uTime) gl.uniform1f(u.uTime, time);
    if (u.uPR) gl.uniform1f(u.uPR, pr);
    if (u.uInk) gl.uniform1f(u.uInk, colors.ink);
    if (u.uFogN) { gl.uniform1f(u.uFogN, 95); gl.uniform1f(u.uFogF, 250); }
  }
  function drawLines(key, col, alpha, draw, dash) {
    const o = lineObjs[key]; if (!o || alpha <= .003) return;
    attribs(gl, P.lines, [['aPos', o.pos, 3], ['aT', o.t, 1]]);
    gl.uniform4f(P.lines.u.uCol, col[0], col[1], col[2], col[3] * alpha);
    gl.uniform1f(P.lines.u.uDraw, draw === undefined ? 1.01 : draw);
    gl.uniform1f(P.lines.u.uDash, dash || 0);
    gl.drawArrays(gl.LINES, 0, o.n);
  }

  function render(now) {
    time = (now - t0) / 1000;
    const dtc = lastT ? Math.min(.25, time - lastT) : 1 / 60; lastT = time;
    if (first) { desired(want); cam.pos = want.pos.slice(); cam.tgt = want.tgt.slice(); cam.fov = want.fov; first = false; }
    desired(want);
    const k = opts.reduced ? 1 : 1 - Math.exp(-dtc * 4.2); // frame-rate independent glide
    for (let i = 0; i < 3; i++) { cam.pos[i] += (want.pos[i] - cam.pos[i]) * k; cam.tgt[i] += (want.tgt[i] - cam.tgt[i]) * k; }
    cam.fov += (want.fov - cam.fov) * k;
    perspective(proj, cam.fov * Math.PI / 180, aspect, .5, 420);
    lookAt(view, cam.pos, cam.tgt, [0, 1, 0]);
    mul(PV, proj, view);
    hover[0] += (st.pointer[0] - hover[0]) * .2; hover[1] += (st.pointer[1] - hover[1]) * .2;
    const g = st.pointer[2] ? rayGround(hover[0], hover[1]) : null;
    if (g) { mouseW[0] += (g[0] - mouseW[0]) * .35; mouseW[1] += (g[1] - mouseW[1]) * .35; }
    mouseW[2] += ((g ? 1 : 0) - mouseW[2]) * .12;

    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    // sky
    gl.disable(gl.BLEND);
    gl.useProgram(P.sky.p);
    const hp = projectPt([cam.pos[0] + (cam.tgt[0] - cam.pos[0]) * 50, 0, cam.pos[2] + (cam.tgt[2] - cam.pos[2]) * 50], {});
    gl.uniform3fv(P.sky.u.uTop, sky.top); gl.uniform3fv(P.sky.u.uBot, sky.bot); gl.uniform3fv(P.sky.u.uGlow, sky.glow); gl.uniform3fv(P.sky.u.uGround, sky.ground);
    gl.uniform1f(P.sky.u.uHor, clamp(1 - hp.y / (H / pr), -.5, 1.5)); gl.uniform1f(P.sky.u.uGlowAmt, sky.amt); gl.uniform1f(P.sky.u.uTime, time);
    attribs(gl, P.sky, [['aPos', B.quad, 2]]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    setBlend();

    // stars (night only)
    if (!colors.ink) {
      gl.useProgram(P.glow.p); common(P.glow); gl.uniform1f(P.glow.u.uTw, 1);
      attribs(gl, P.glow, [['aPos', B.sPos, 3], ['aCol', B.sCol, 4], ['aSize', B.sSize, 1]]);
      gl.drawArrays(gl.POINTS, 0, SN);
    }

    // terrain
    const u = P.ter.u;
    gl.useProgram(P.ter.p); common(P.ter);
    gl.uniform1f(u.uSize, (mobile ? 1.3 : 1) * colors.size);
    gl.uniform3f(u.uMouse, mouseW[0], mouseW[1], mouseW[2]);
    gl.uniform4f(u.uRip, st.ripX, st.ripZ, st.ripT, 1);
    gl.uniform2f(u.uScan, -114 + ((time * 9) % 190), .9);
    gl.uniform3fv(u.uCLow, colors.low); gl.uniform3fv(u.uCHigh, colors.high); gl.uniform3fv(u.uCLake, colors.lake); gl.uniform3fv(u.uCHot, colors.hot); gl.uniform3fv(u.uCCity, colors.city);
    attribs(gl, P.ter, [['aPos', B.tPos, 3], ['aInfo', B.tInfo, 2]]);
    gl.drawArrays(gl.POINTS, 0, terrainDraw);

    // lines
    gl.useProgram(P.lines.p); common(P.lines); gl.uniform1f(P.lines.u.uTime, time);
    attribs(gl, P.lines, [['aPos', B.cPos, 3], ['aT', B.cT, 1]]);
    gl.uniform4f(P.lines.u.uCol, colors.contour[0], colors.contour[1], colors.contour[2], colors.contour[3]);
    gl.uniform1f(P.lines.u.uDraw, 1.01); gl.uniform1f(P.lines.u.uDash, 0);
    gl.drawArrays(gl.LINES, 0, nC);
    const s = st.s;
    const seg = st.packet, live = Math.round(clamp(seg, 0, 2));
    for (let i = 0; i < 3; i++) drawLines('plate' + i, Math.abs(seg - i) < .5 && seg > .02 && i === live ? colors.plateOn : colors.plate, 1, 1.01, 0);
    drawLines('beam', colors.route, .9, seg / 2, 0);
    const routeOn = sstep(2.2, 2.8, s), routeDraw = sstep(2.3, 2.95, s);
    drawLines('route', colors.route, routeOn, routeDraw, 60);
    const projOn = sstep(3.4, 4.1, s) * (1 - sstep(5.6, 6.4, s) * .6);
    for (let i = 0; i < 5; i++) { const on = Math.max(0, 1 - Math.abs(st.proj - i)); drawLines('mono' + i, on > .5 ? colors.monoOn : colors.mono, (.12 + .88 * projOn) * (on > .5 ? 1 : .8), 1.01, 0); }
    const skOn = sstep(5.2, 6, s) * (1 - sstep(6.6, 7.4, s)) + sstep(7.6, 8, s) * .35;
    drawLines('ring0', colors.ring, skOn, 1.01, 0); drawLines('ring1', colors.ring, skOn, 1.01, 0);
    const crT = sstep(6.4, 7.3, s), crOn = sstep(6.2, 6.9, s);
    drawLines('cons', colors.cons, crOn, crT, 0);

    // glow nodes
    let n = 0;
    const node = (p, c, a, size) => { NP[n * 3] = p[0]; NP[n * 3 + 1] = p[1]; NP[n * 3 + 2] = p[2]; NC[n * 4] = c[0]; NC[n * 4 + 1] = c[1]; NC[n * 4 + 2] = c[2]; NC[n * 4 + 3] = a; NS[n] = size; n++; };
    const py = lerp(LAYOUT.plates[0], LAYOUT.plates[2], clamp(seg / 2, 0, 1));
    const boom = clamp(1 - (time - st.boomT) / 1.6, 0, 1);
    node([pcx, py, pcz], colors.nodeOn, seg > .005 ? 1 : .55, 6 + Math.sin(time * 5) * 1 + boom * 18);
    skillPos.length = 0;
    RING.forEach((gq, ri) => {
      for (let i = 0; i < gq.n; i++) {
        const a = i / gq.n * TAU + time * (ri ? -.07 : .09) + st.skillSpin * (ri ? .7 : 1);
        let x = Math.cos(a) * gq.r, y = 0, z = Math.sin(a) * gq.r;
        const y2 = y * Math.cos(gq.tx) - z * Math.sin(gq.tx), z2 = y * Math.sin(gq.tx) + z * Math.cos(gq.tx);
        const x3 = x * Math.cos(gq.ry) + z2 * Math.sin(gq.ry), z3 = -x * Math.sin(gq.ry) + z2 * Math.cos(gq.ry);
        const p = [LAYOUT.skillsC[0] + x3, LAYOUT.skillsC[1] + y2, LAYOUT.skillsC[2] + z3];
        skillPos.push(p);
        const idx = skillPos.length - 1, hi = st.hiSkill === idx;
        node(p, hi ? colors.nodeOn : colors.node, skOn * (hi ? 1 : .85), hi ? 14 : 7);
      }
    });
    LAYOUT.stars.forEach((p, i) => { const lit = crT * 10 > i + .3 ? 1 : 0, big = i < 3 ? 1.5 : 1; credOn[i] += (lit - credOn[i]) * .1; node(p, credOn[i] > .5 ? colors.nodeOn : colors.star, crOn * (.35 + .65 * credOn[i]), (10 + credOn[i] * 14) * big); });
    monoTop.forEach((p, i) => { const on = Math.max(0, 1 - Math.abs(st.proj - i)); node(p, on > .5 ? colors.nodeOn : colors.node, .3 + .7 * projOn * (.5 + on * .5), 5 + on * 8); });
    node([LAYOUT.lugano[0], 1.4, LAYOUT.lugano[1]], colors.nodeOn, .5 + routeOn * .5, 7 + Math.sin(time * 3) * 1.5);
    node([LAYOUT.rome[0], Math.max(height(LAYOUT.rome[0], LAYOUT.rome[1]), 0) + 1.4, LAYOUT.rome[1]], colors.node, routeOn, 6);
    LAYOUT.plates.forEach((y, i) => node([pcx, y, pcz], i === live && seg > .02 ? colors.nodeOn : colors.node, .5, 3.5));
    if (routeOn > .01) {
      beads.forEach((p, i) => node(p, colors.nodeOn, routeOn * (i / (BEADS - 1) <= routeDraw + .001 ? .9 : 0), 6));
      const tr = ((time * .09) % 1) * routeDraw, tp = RP[Math.min(RP.length - 1, Math.round(tr * (RP.length - 1)))];
      node(tp, [1, .85, .6], routeOn, 12 + Math.sin(time * 6) * 2);
    }
    gl.useProgram(P.glow.p); common(P.glow); gl.uniform1f(P.glow.u.uTw, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.nPos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, NP);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.nCol); gl.bufferSubData(gl.ARRAY_BUFFER, 0, NC);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.nSize); gl.bufferSubData(gl.ARRAY_BUFFER, 0, NS);
    attribs(gl, P.glow, [['aPos', B.nPos, 3], ['aCol', B.nCol, 4], ['aSize', B.nSize, 1]]);
    gl.drawArrays(gl.POINTS, 0, n);

    // name particles
    if (nameReady && st.morph < .999) {
      const v = P.name.u;
      gl.useProgram(P.name.p); common(P.name);
      gl.uniform1f(v.uSize, (mobile ? 1.7 : 1.2) * colors.size);
      gl.uniform1f(v.uIntro, st.intro); gl.uniform1f(v.uMorph, st.morph); gl.uniform1f(v.uAspect, aspect);
      gl.uniform3f(v.uMouseN, hover[0], hover[1], st.pointer[2]);
      gl.uniform3fv(v.uCT, colors.nameT);
      attribs(gl, P.name, [['aC', B.nmC, 3], ['aA', B.nmA, 3], ['aB', B.nmB, 3], ['aCol', B.nmCol, 3], ['aS', B.nmS, 1]]);
      gl.drawArrays(gl.POINTS, 0, nameN);
    }
  }

  B.quad = buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]));

  const api = {
    get count() { return nT + nameN; },
    buildName,
    resize,
    render,
    set(o) { Object.assign(st, o); },
    pointer(nx, ny, on) { st.pointer[0] = nx; st.pointer[1] = ny; st.pointer[2] = on ? 1 : 0; },
    ripple(nx, ny) { const g = rayGround(nx, ny); if (!g) return false; st.ripX = g[0]; st.ripZ = g[1]; st.ripT = time; return true; },
    boom() { st.boomT = time; st.ripX = pcx; st.ripZ = pcz; st.ripT = time; },
    theme(t) { theme = t; colors = COL[t] || COL.dark; },
    sky(top, bot, glow, amt, ground) { sky.top = top; sky.bot = bot; sky.glow = glow; sky.amt = amt; if (ground) sky.ground = ground; },
    quality(q) { quality = clamp(q, .5, 1); terrainDraw = Math.round(nT * clamp(q * 1.1, .55, 1)); resize(); },
    anchors(out) {
      const tmp = {};
      const put = (k, p) => { const r = projectPt(p, tmp); out[k] = out[k] || {}; out[k].x = r.x; out[k].y = r.y; out[k].on = r.on; };
      LAYOUT.plates.forEach((y, i) => put(['DEV', 'QAS', 'PRD'][i], [pcx + ph * Math.SQRT2, y, pcz]));
      put('PKT', [pcx, lerp(LAYOUT.plates[0], LAYOUT.plates[2], clamp(st.packet / 2, 0, 1)), pcz]);
      put('LUGANO', [LAYOUT.lugano[0], 2.6, LAYOUT.lugano[1]]);
      put('ROMA', [LAYOUT.rome[0], Math.max(height(LAYOUT.rome[0], LAYOUT.rome[1]), 0) + 2.6, LAYOUT.rome[1]]);
      monoTop.forEach((p, i) => put('P' + i, [p[0], p[1] + 1.5, p[2]]));
      skillPos.forEach((p, i) => put('S' + (i + 1), p));
      LAYOUT.stars.forEach((p, i) => put('E' + (i + 1), p));
      return out;
    },
    lose() { const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
  };
  st.skillSpin = 0;
  resize();
  return api;
}
