// world-shaders.js: GLSL ES 1.00 programs for the Landscape world.

const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/* soft round sprite, premultiplied for additive glow (dark) or straight alpha for ink (light) */
const SPRITE_FS = HEAD + `
varying vec3 vC; varying float vA;
uniform float uInk;
void main(){
  vec2 d = gl_PointCoord - .5; float r = dot(d, d) * 4.;
  if (r > 1.) discard;
  float a = 1. - smoothstep(.3, 1., r);
  if (uInk > .5) gl_FragColor = vec4(vC, a * vA);
  else gl_FragColor = vec4(vC * a * vA, a * vA);
}`;

export const SKY = {
  vs: `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`,
  fs: HEAD + `
varying vec2 vUv;
uniform vec3 uTop, uBot, uGlow, uGround; uniform float uHor, uGlowAmt, uTime;
float h(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){
  float y = vUv.y;
  vec3 c = mix(uBot, uTop, smoothstep(uHor, 1.05, y));
  c = mix(uGround, c, smoothstep(uHor - .12, uHor + .01, y));
  float band = exp(-pow((y - uHor) * 11., 2.));
  c += uGlow * band * uGlowAmt;
  c += (h(gl_FragCoord.xy + fract(uTime)) - .5) / 255.;
  gl_FragColor = vec4(c, 1.);
}`
};

export const TERRAIN = {
  vs: HEAD + `
attribute vec3 aPos; attribute vec2 aInfo;
uniform mat4 uPV; uniform vec3 uEye;
uniform float uTime, uPR, uSize, uFogN, uFogF;
uniform vec3 uMouse; uniform vec4 uRip; uniform vec2 uScan;
uniform vec3 uCLow, uCHigh, uCLake, uCHot, uCCity;
varying vec3 vC; varying float vA;
void main(){
  vec3 p = aPos; float kind = aInfo.x, s = aInfo.y;
  float lake = step(.5, kind) * step(kind, 1.5), city = step(1.5, kind);
  if (lake > .5) p.y = (sin(p.x * .32 + uTime * .7 + s * 2.) + sin(p.z * .21 - uTime * .55)) * .09;
  float m = smoothstep(9., 0., length(p.xz - uMouse.xy)) * uMouse.z;
  float rt = uTime - uRip.z;
  float ring = rt > 0. ? exp(-pow((length(p.xz - uRip.xy) - rt * 15.) * .42, 2.)) * exp(-rt * 1.1) * uRip.w : 0.;
  p.y += m * (.3 + .3 * sin(s * 40. + uTime * 4.)) + ring * 1.5;
  float sc = exp(-pow((p.z - uScan.x) * .28, 2.)) * uScan.y;
  gl_Position = uPV * vec4(p, 1.);
  float dist = length(p - uEye);
  float hh = clamp(aPos.y / 24., 0., 1.);
  vec3 col = mix(uCLow, uCHigh, hh * hh * .55 + hh * .45);
  col = mix(col, uCLake, lake);
  col = mix(col, uCCity, city);
  float hot = clamp(m * .95 + ring * 1.3 + sc * .5, 0., 1.);
  col = mix(col, uCHot, hot * (1. - city));
  float fog = 1. - smoothstep(uFogN, uFogF, dist);
  float near = smoothstep(1.5, 7., dist);
  float tw = .7 + .3 * sin(uTime * 1.4 + s * 31.);
  float ctw = .55 + .45 * sin(uTime * (2. + s * 3.) + s * 60.);
  float base = lake > .5 ? .78 * tw : (city > .5 ? 1.1 * ctw : (.56 + .42 * hh));
  vA = fog * near * base * (1. + hot * 1.1) * (1. + smoothstep(35., 90., dist) * .6);
  vC = col;
  gl_PointSize = clamp(uSize * uPR * (1. + hot * .9 + city * .5) * 30. / dist, 1., 9. * uPR);
}`,
  fs: SPRITE_FS
};

export const NAME = {
  vs: HEAD + `
attribute vec3 aC; attribute vec3 aA; attribute vec3 aB; attribute vec3 aCol; attribute float aS;
uniform mat4 uPV; uniform vec3 uEye;
uniform float uTime, uPR, uSize, uIntro, uMorph, uAspect, uFogN, uFogF;
uniform vec3 uMouseN; uniform vec3 uCT; uniform float uInk;
varying vec3 vC; varying float vA;
float eo(float t){ return 1. - pow(1. - t, 3.); }
float eio(float t){ return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
void main(){
  float s = aS;
  float ti = eo(clamp((uIntro - s * .45) / .55, 0., 1.));
  vec3 p = mix(aC, aA, ti);
  p += vec3(sin(uTime * 1.7 + s * 50.), cos(uTime * 1.3 + s * 70.), sin(uTime * 1.1 + s * 90.)) * .035 * ti;
  float em = eio(clamp((uMorph - s * .4) / .6, 0., 1.));
  vec3 q = mix(p, aB, em);
  float arc = sin(em * 3.14159);
  q.y += arc * (5. + s * 9.);
  q.x += arc * sin(s * 20.) * 5.;
  q.z += arc * cos(s * 13.) * 4.;
  vec4 c = uPV * vec4(q, 1.);
  vec2 nd = c.xy / c.w;
  vec2 dv = (nd - uMouseN.xy) * vec2(uAspect, 1.);
  float dl = length(dv);
  float rep = uMouseN.z * (1. - em) * smoothstep(.26, 0., dl);
  c.xy += normalize(dv + 1e-5) * rep * .085 * c.w;
  gl_Position = c;
  float dist = length(q - uEye);
  vec3 base = aCol;
  if (uInk > .5) base = aCol.g > .9 ? vec3(.04, .08, .2) : aCol * .82;
  vec3 col = mix(base, uCT, em);
  col += vec3(1., .55, .25) * rep * .9;
  vA = mix(.95, .5, em) * (1. - smoothstep(uFogN, uFogF, dist)) * (.25 + .75 * ti);
  vC = col;
  gl_PointSize = clamp(uSize * uPR * mix(1.3, 1., em) * 26. / dist, 1., 7. * uPR);
}`,
  fs: SPRITE_FS
};

/* glowing nodes and stars: core + halo */
export const GLOW = {
  vs: HEAD + `
attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform mat4 uPV; uniform vec3 uEye; uniform float uPR, uTime, uTw;
varying vec3 vC; varying float vA;
void main(){
  gl_Position = uPV * vec4(aPos, 1.);
  float dist = length(aPos - uEye);
  float tw = mix(1., .55 + .45 * sin(uTime * (1. + fract(aPos.x * 7.3) * 2.) + aPos.z), uTw);
  vC = aCol.rgb; vA = aCol.a * tw;
  gl_PointSize = clamp(aSize * uPR * 70. / dist, 1., 140. * uPR);
}`,
  fs: HEAD + `
varying vec3 vC; varying float vA; uniform float uInk;
void main(){
  float r = length(gl_PointCoord - .5) * 2.;
  if (r > 1.) discard;
  float a = (exp(-r * r * 4.) * .5 + exp(-r * r * 16.) * .9) * vA;
  if (uInk > .5) gl_FragColor = vec4(vC, min(a, 1.));
  else gl_FragColor = vec4(vC * a, a);
}`
};

/* lines with progressive draw (aT 0..1) and optional marching dashes */
export const LINES = {
  vs: HEAD + `
attribute vec3 aPos; attribute float aT;
uniform mat4 uPV; uniform vec3 uEye; uniform float uFogN, uFogF;
varying float vA; varying float vT;
void main(){
  gl_Position = uPV * vec4(aPos, 1.);
  float dist = length(aPos - uEye);
  vA = 1. - smoothstep(uFogN, uFogF, dist);
  vT = aT;
}`,
  fs: HEAD + `
varying float vA; varying float vT;
uniform vec4 uCol; uniform float uDraw, uInk, uDash, uTime;
void main(){
  if (vT > uDraw) discard;
  if (uDash > 0. && fract(vT * uDash - uTime * .8) > .55) discard;
  float a = uCol.a * vA;
  if (uInk > .5) gl_FragColor = vec4(uCol.rgb, a);
  else gl_FragColor = vec4(uCol.rgb * a, a);
}`
};
