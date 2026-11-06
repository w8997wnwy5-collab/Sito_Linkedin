// world-core.js: math, noise, terrain generation and WebGL helpers for the Landscape world.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------- 4x4 matrices (column-major, like WebGL) ---------- */
export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}
export function lookAt(out, e, c, up) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
  out[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
  out[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
  out[15] = 1;
  return out;
}
export function mul(out, a, b) {
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
    out[i * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

/* ---------- seeded random + gradient noise ---------- */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const R = rng(1977), PERM = new Uint8Array(512), GX = new Float32Array(256), GY = new Float32Array(256);
(() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) { const a = R() * TAU; GX[i] = Math.cos(a); GY[i] = Math.sin(a); }
})();
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const g = (ix, iy, dx, dy) => { const h = PERM[(PERM[ix & 255] + iy) & 511]; return GX[h] * dx + GY[h] * dy; };
  const n00 = g(xi, yi, xf, yf), n10 = g(xi + 1, yi, xf - 1, yf), n01 = g(xi, yi + 1, xf, yf - 1), n11 = g(xi + 1, yi + 1, xf - 1, yf - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v); // about -0.7..0.7
}
export function fbm(x, y, oct = 5) {
  let s = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f); f *= 2.02; a *= .5; }
  return s;
}

/* ---------- the landscape: a lake shaped like a long bent arm, mountains around ---------- */
const LAKES = [
  { cx: -13, cz: -24, rx: 7.5, rz: 15, rot: .5 },
  { cx: 3, cz: -42, rx: 9, rz: 15, rot: -.35 },
  { cx: 17, cz: -57, rx: 6, rz: 11, rot: .25 },
  { cx: -4, cz: -34, rx: 5, rz: 7, rot: 1.1 }
];
export function lakeDist(x, z) {
  const w = noise(x * .05, z * .05) * 5, wz = noise(z * .05 + 7, x * .05) * 4;
  let d = 1e9;
  for (const L of LAKES) {
    const dx = x + w - L.cx, dz = z + wz - L.cz, c = Math.cos(L.rot), s = Math.sin(L.rot);
    const ex = (dx * c - dz * s) / L.rx, ez = (dx * s + dz * c) / L.rz;
    d = Math.min(d, (Math.sqrt(ex * ex + ez * ez) - 1) * Math.min(L.rx, L.rz));
  }
  return d;
}
export function height(x, z) {
  const ld = lakeDist(x, z);
  if (ld < 0) return 0;
  const base = fbm(x * .028 + 3.1, z * .028 - 1.7) * .5 + .5;
  const r = 1 - Math.abs(noise(x * .055 + 11, z * .055 - 4) * 1.6);
  const ridge = r * r;
  const shore = sstep(0, 13, ld);
  const north = sstep(-30, -112, z);
  const south = sstep(-14, 16, z);
  let h = (base * .62 + ridge * .5) * 23 * shore;
  h += north * 13 * shore;
  h *= 1 - south * .88;
  h += south * (noise(x * .09, z * .09) * .8 + .5);
  h += sstep(0, 3, ld) * .35;
  return Math.max(0.05, h);
}

/* marching squares → contour line segments at the given heights */
export function contours(x0, x1, z0, z1, step, levels) {
  const nx = Math.floor((x1 - x0) / step) + 1, nz = Math.floor((z1 - z0) / step) + 1;
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = height(x0 + i * step, z0 + j * step);
  const out = [];
  const edge = (lv, ax, az, ha, bx, bz, hb) => { const t = (lv - ha) / (hb - ha); return [ax + (bx - ax) * t, lv + .06, az + (bz - az) * t]; };
  for (const lv of levels) {
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const xa = x0 + i * step, za = z0 + j * step, xb = xa + step, zb = za + step;
      const h00 = H[j * nx + i], h10 = H[j * nx + i + 1], h01 = H[(j + 1) * nx + i], h11 = H[(j + 1) * nx + i + 1];
      const pts = [];
      if ((h00 < lv) !== (h10 < lv)) pts.push(edge(lv, xa, za, h00, xb, za, h10));
      if ((h10 < lv) !== (h11 < lv)) pts.push(edge(lv, xb, za, h10, xb, zb, h11));
      if ((h11 < lv) !== (h01 < lv)) pts.push(edge(lv, xb, zb, h11, xa, zb, h01));
      if ((h01 < lv) !== (h00 < lv)) pts.push(edge(lv, xa, zb, h01, xa, za, h00));
      if (pts.length === 2) out.push(...pts[0], ...pts[1]);
      else if (pts.length === 4) out.push(...pts[0], ...pts[1], ...pts[2], ...pts[3]);
    }
  }
  return new Float32Array(out);
}

/* sample text from a 2D canvas into points (normalised -0.5..0.5 width) */
export function sampleText(lines, font, target) {
  const W = 1400, lh = 300, H = lh * lines.length + 80;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  let size = 300;
  cx.font = `800 ${size}px ${font}`;
  const widest = Math.max(...lines.map(l => cx.measureText(l).width));
  size = Math.min(300, size * (W - 60) / widest);
  cx.font = `800 ${size}px ${font}`;
  const asc = size * .74;
  lines.forEach((l, i) => cx.fillText(l, W / 2, 40 + i * size * .9 + asc));
  const usedH = 40 + (lines.length - 1) * size * .9 + asc + 20;
  const data = cx.getImageData(0, 0, W, H).data;
  let filled = 0;
  for (let i = 3; i < data.length; i += 16) if (data[i] > 128) filled++;
  filled *= 4;
  const step = Math.max(1, Math.sqrt(filled / target));
  const pts = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  const rr = rng(42);
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const xi = Math.min(W - 1, Math.round(x + (rr() - .5) * step * .6)), yi = Math.min(H - 1, Math.round(y + (rr() - .5) * step * .6));
    if (data[(yi * W + xi) * 4 + 3] > 128) {
      const line = Math.min(lines.length - 1, Math.floor((yi - 40) / (size * .9) + .02));
      pts.push([xi, yi, line]);
      if (xi < minX) minX = xi; if (xi > maxX) maxX = xi; if (yi < minY) minY = yi; if (yi > maxY) maxY = yi;
    }
  }
  const w = maxX - minX || 1, cxm = (minX + maxX) / 2, cym = (minY + maxY) / 2;
  return { pts: pts.map(([x, y, line]) => [(x - cxm) / w, (cym - y) / w, line, (x - minX) / w]), aspect: (maxY - minY) / w, usedH };
}

/* ---------- WebGL helpers ---------- */
export function program(gl, vs, fs) {
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) + '\n' + s.split('\n').slice(0, 3).join(' ')); return o; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, a = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i < n; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}
export function buffer(gl, data, usage) {
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW); return b;
}
let enabled = [];
export function attribs(gl, prog, list) {
  // list: [[name, buffer, size], ...]; disables arrays the previous draw left on
  const want = list.map(([n]) => prog.a[n]).filter(l => l !== undefined && l >= 0);
  enabled.forEach(l => { if (!want.includes(l)) gl.disableVertexAttribArray(l); });
  list.forEach(([n, b, s]) => { const l = prog.a[n]; if (l === undefined || l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, s, gl.FLOAT, false, 0, 0); });
  enabled = want;
}
export function resetAttribs() { enabled = []; }
