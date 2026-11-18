// APEX — le son, entièrement synthétisé : tambours feutrés, nappe grave, et une note de cloche à chaque mise à mort
// (la gamme monte avec la série : une belle chasse devient une mélodie).
const BPM = 120, SPB = 60 / BPM;
const BASS = [41.2, 41.2, 49.0, 36.7], BASS_FUITE = [36.7, 36.7, 43.65, 32.7];
const GAMME = [329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 880.0, 987.77, 1174.66]; // mi mineur pentatonique

export class Son {
  constructor() { this.ctx = null; this.next = 0; this.start = 0; this.transfer = -1; }
  get ok() { return !!this.ctx && this.ctx.state === 'running'; }
  get now() { return this.ctx.currentTime; }
  get latency() { return this.ok ? (this.ctx.outputLatency || this.ctx.baseLatency || 0) : 0; }

  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.connect(c.destination);
    this.master = c.createGain(); this.master.gain.value = 0.85; this.master.connect(comp);
    // Écho doux pour les cloches.
    const delay = c.createDelay(1); delay.delayTime.value = SPB * 0.75;
    const fb = c.createGain(); fb.gain.value = 0.34;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.master);
    this.echo = delay;
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Nappe grave et lente : la respiration de la jungle.
    this.pad = c.createGain(); this.pad.gain.value = 0;
    const plp = c.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 420; plp.Q.value = 0.6;
    this.padOsc = [82.41, 123.47, 164.81].map((f, i) => { const o = c.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1) * 7; o.connect(plp); o.start(); return o; });
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(plp.frequency); lfo.start();
    plp.connect(this.pad); this.pad.connect(this.master);
    this.pad.gain.linearRampToValueAtTime(0.11, c.currentTime + 4);
    const b = c.createBufferSource(); b.buffer = c.createBuffer(1, 1, 22050); b.connect(this.master); b.start(); // débloque le son sur iPhone
  }

  env(t, a, d, peak, dest) { const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dest || this.master); return g; }
  kick(t, v) { const o = this.ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); o.connect(this.env(t, 0.004, 0.34, 0.6 * v)); o.start(t); o.stop(t + 0.45); }
  noise(t, dur, freq, q, v, type = 'bandpass') { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); f.connect(this.env(t, 0.003, dur, v)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
  tom(t, f0, v) { const o = this.ctx.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.28); o.connect(this.env(t, 0.005, 0.34, v)); o.start(t); o.stop(t + 0.45); }
  bass(t, f, dur) { const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * 2; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; o.connect(lp); lp.connect(this.env(t, 0.03, dur, 0.2)); o.start(t); o.stop(t + dur + 0.1); }
  bell(f, v) {
    const c = this.ctx, t = c.currentTime;
    for (const [m, g, d] of [[1, 0.2, 1.5], [2.01, 0.06, 0.9], [3.02, 0.025, 0.5]]) {
      const o = c.createOscillator(); o.frequency.value = f * m;
      const e = this.env(t, 0.004, d, g * v); e.connect(this.echo); o.connect(e); o.start(t); o.stop(t + d + 0.1);
    }
  }

  startRun(transfer) {
    this.start = this.now + 1.0; this.next = 0; this.transfer = transfer;
    for (const [i, f] of [82.41, 123.47, 164.81].entries()) this.padOsc[i].frequency.setTargetAtTime(f, this.now, 0.5);
  }
  time() { return this.now - this.start; }
  fuite() { for (const [i, f] of [73.42, 110.0, 146.83].entries()) this.padOsc[i].frequency.setTargetAtTime(f, this.now, 0.8); }

  schedule() {
    if (!this.ok) return;
    while (true) {
      const at = this.start + this.next * SPB / 2;
      if (at > this.now + 0.2) break;
      if (at > this.now - 0.01) {
        const beat = this.next / 2, inBar = beat % 4, bar = Math.floor(beat / 4), onBeat = this.next % 2 === 0;
        const fuite = this.transfer >= 0 && at - this.start >= this.transfer - 0.01;
        if (onBeat) {
          this.kick(at, inBar === 0 ? 1 : 0.75);
          if (inBar === 0) this.bass(at, (fuite ? BASS_FUITE : BASS)[bar % 4], SPB * 3.6);
          if (inBar === 2) this.noise(at, 0.09, 1400, 2.5, 0.13);
          if (fuite) this.tom(at, inBar % 2 ? 140 : 105, 0.26);
          else if (bar >= 8 && inBar === 3) this.tom(at, 165, 0.22);
        } else {
          this.noise(at, 0.025, 7000, 0.7, bar >= 4 ? 0.07 : 0.035, 'highpass');
          if (fuite) this.tom(at, 210, 0.11);
          else if (bar >= 16 && inBar === 1) this.tom(at, 220, 0.14);
        }
      }
      this.next++;
    }
  }

  kill(perfect, combo) {
    if (!this.ok) return;
    this.bell(GAMME[(combo - 1) % GAMME.length] * (perfect ? 1 : 0.5), perfect ? 1 : 0.7);
    this.tom(this.now, 70, perfect ? 0.45 : 0.3);
  }
  miss() { if (this.ok) this.noise(this.now, 0.25, 500, 0.8, 0.12, 'lowpass'); }
  hit() { if (this.ok) { this.tom(this.now, 60, 0.6); this.noise(this.now, 0.12, 900, 1, 0.16); } }
}
