// audio.js: tiny synthesized sound design (WebAudio, no files). Off by default.
let ctx = null, master = null, pad = null, on = false;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // soft echo shared by the cues
  const dl = ctx.createDelay(1); dl.delayTime.value = .28;
  const fb = ctx.createGain(); fb.gain.value = .28;
  const wet = ctx.createGain(); wet.gain.value = .35;
  dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
  master.fx = dl;
  return ctx;
}

function startPad() {
  if (pad || !ctx) return;
  const out = ctx.createGain(); out.gain.value = 0; out.connect(master);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = .7; lp.connect(out);
  const oscs = [55, 82.41, 110.3, 164.8].map((f, i) => { const o = ctx.createOscillator(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4; const g = ctx.createGain(); g.gain.value = [.5, .32, .12, .05][i]; o.connect(g); g.connect(lp); o.start(); return o; });
  const lfo = ctx.createOscillator(); lfo.frequency.value = .05; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  out.gain.setTargetAtTime(.06, ctx.currentTime, 2.5);
  pad = { out, oscs, lfo };
}

function blip(freq, dur, type, gain, slide) {
  if (!on || !ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain || .08, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); g.connect(master.fx);
  o.start(t); o.stop(t + dur + .05);
}

export const sound = {
  get on() { return on; },
  async set(v) {
    on = !!v;
    if (on) {
      if (!ensure()) { on = false; return false; }
      if (ctx.state === 'suspended') await ctx.resume();
      startPad();
      master.gain.setTargetAtTime(.9, ctx.currentTime, .3);
      blip(660, .18, 'sine', .07); setTimeout(() => blip(990, .22, 'sine', .05), 90);
    } else if (ctx) {
      master.gain.setTargetAtTime(0, ctx.currentTime, .2);
    }
    return on;
  },
  tick() { blip(1500, .045, 'sine', .035); },
  ping() { blip(880, .5, 'sine', .07, 330); },
  step() { blip(523.25, .2, 'triangle', .07); setTimeout(() => blip(784, .3, 'triangle', .06), 110); },
  done() { [523.25, 659.25, 784, 1046.5].forEach((f, i) => setTimeout(() => blip(f, .5, 'triangle', .07), i * 120)); },
  err() { blip(220, .25, 'square', .04, 160); }
};
