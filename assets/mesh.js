// mesh.js: soft animated gradient behind the hero (WebGL, pauses when off screen).
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 R; uniform float T; uniform vec2 M; uniform vec3 B, C1, C2, C3; uniform float L;
float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++){ v += a * n(p); p = m * p + vec2(3.1, 1.7); a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / R; float asp = R.x / R.y;
  vec2 p = vec2(uv.x * asp, uv.y) * 1.3, m = vec2(M.x * asp, M.y) * 1.3;
  float t = T * .035;
  vec2 dm = p - m; float md = exp(-dot(dm, dm) * 2.2);
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2) + .7 * t + dm * md * .4), fbm(p + 2.2 * q + vec2(8.3, 2.8) - .6 * t));
  float f = fbm(p * 1.1 + 2. * r);
  vec3 col = B;
  col = mix(col, C1, smoothstep(.34, .9, f) * .9);
  col = mix(col, C3, smoothstep(.4, .95, q.y * f * 1.9) * .6);
  col = mix(col, C2, smoothstep(.48, 1., r.x * f * 1.8) * .75);
  col += (C1 * .18 + C2 * .08) * md * L;
  float v = smoothstep(1.3, .1, length((uv - vec2(.72, .62)) * vec2(1., 1.2)));
  col = mix(B, col, .3 + .7 * v);
  col += (h(gl_FragCoord.xy + fract(T)) - .5) / 255.;
  gl_FragColor = vec4(col, 1.);
}`;
const PAL = {
  light: { B: [.957, .961, .976], C1: [.62, .72, 1], C2: [1, .78, .62], C3: [.8, .73, 1], L: .5 },
  dark: { B: [.027, .035, .06], C1: [.13, .26, .8], C2: [.95, .38, .12], C3: [.4, .25, .88], L: 1 }
};

export function createMesh(canvas, { calm } = {}) {
  let gl = null;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
  if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  gl.useProgram(p);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['R', 'T', 'M', 'B', 'C1', 'C2', 'C3', 'L'].forEach((k) => { U[k] = gl.getUniformLocation(p, k); });
  let w = 0, h = 0, mx = .72, my = .6, tx = .72, ty = .6, t0 = performance.now(), last = 0, visible = true, lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  function size() {
    const r = canvas.getBoundingClientRect(), sc = Math.min(.5, 560 / Math.max(r.width, 1));
    const W = Math.max(2, Math.round(r.width * sc)), H = Math.max(2, Math.round(r.height * sc));
    if (W !== w || H !== h) { w = W; h = H; canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(U.R, w, h);
  }
  function theme(t) { const c = PAL[t] || PAL.light; gl.uniform3fv(U.B, c.B); gl.uniform3fv(U.C1, c.C1); gl.uniform3fv(U.C2, c.C2); gl.uniform3fv(U.C3, c.C3); gl.uniform1f(U.L, c.L); draw(performance.now(), true); }
  function draw(now, force) {
    if (lost || (!visible && !force)) return;
    if (!force && now - last < 33) return;
    last = now;
    mx += (tx - mx) * .06; my += (ty - my) * .06;
    gl.uniform1f(U.T, calm ? 18 : (now - t0) / 1000);
    gl.uniform2f(U.M, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  size();
  return {
    size, theme, draw,
    pointer(x, y) { tx = x; ty = y; },
    visible(v) { visible = v; }
  };
}
