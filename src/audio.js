// Sound effects. Every effect is synthesized with WebAudio, so the game has sound with no files.
// To use a real recording instead, put it in assets/sfx/ and list it in data/sfx.json,
// e.g. { "hit": "hit.wav" }. Names without an entry keep their synthesized version.
// Browsers only allow audio after a click/key press, so main.js calls Sfx.unlock() on input.

const SFX_CONFIG = {
  volume: 0.5,   // master volume, 0..1
  history: 40,   // how many recent effect names Sfx.history remembers (handy for testing)
};

const Sfx = {
  ac: null,
  master: null,
  noise: null,        // shared white-noise buffer
  buffers: {},        // name -> decoded AudioBuffer from a real file
  manifest: {},       // name -> filename inside assets/sfx/
  muted: false,
  history: [],

  // Called at boot with the contents of data/sfx.json (may be empty).
  setManifest(manifest) {
    this.manifest = manifest || {};
    try { this.muted = localStorage.getItem('sdm_muted') === '1'; } catch (e) { /* storage blocked: fine */ }
  },

  // Create/resume the audio context. Must run inside a user gesture the first time.
  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = SFX_CONFIG.volume;
      this.master.connect(this.ac.destination);
      this.noise = this.makeNoise();
      this.loadFiles();
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('sdm_muted', this.muted ? '1' : '0'); } catch (e) { /* fine */ }
  },

  makeNoise() {
    const len = this.ac.sampleRate; // one second is plenty, it gets looped/cut by envelopes
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  // Optional real files from data/sfx.json. A missing/broken file just keeps the synth sound.
  loadFiles() {
    for (const [name, file] of Object.entries(this.manifest)) {
      fetch(`assets/sfx/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((data) => this.ac.decodeAudioData(data))
        .then((buf) => { this.buffers[name] = buf; })
        .catch((err) => console.warn(`[sfx] could not load ${file} for "${name}": ${err.message}`));
    }
  },

  // opts.rate shifts pitch (1 = normal), opts.vol scales loudness.
  play(name, opts = {}) {
    this.history.push(name);
    if (this.history.length > SFX_CONFIG.history) this.history.shift();
    if (this.muted || !this.ac || this.ac.state !== 'running') return;

    const rate = opts.rate || 1, vol = opts.vol || 1;
    if (this.buffers[name]) {
      const src = this.ac.createBufferSource();
      const g = this.ac.createGain();
      src.buffer = this.buffers[name];
      src.playbackRate.value = rate;
      g.gain.value = vol;
      src.connect(g).connect(this.master);
      src.start();
      return;
    }
    const recipe = this.recipes[name];
    if (recipe) recipe.call(this, this.ac.currentTime, rate, vol);
  },

  // ----- synth building blocks -----

  // A short pitched blip sliding from f0 to f1 Hz.
  tone(t, f0, f1, dur, { type = 'sine', vol = 0.2, delay = 0 } = {}) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    const s = t + delay;
    o.type = type;
    o.frequency.setValueAtTime(f0, s);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), s + dur);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(vol, s + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g).connect(this.master);
    o.start(s);
    o.stop(s + dur + 0.02);
  },

  // A burst of filtered noise whose filter sweeps from f0 to f1 Hz (whooshes, crashes).
  burst(t, f0, f1, dur, { vol = 0.25, q = 1.2, delay = 0 } = {}) {
    const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    const s = t + delay;
    src.buffer = this.noise;
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, s);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), s + dur);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.linearRampToValueAtTime(vol, s + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(s);
    src.stop(s + dur + 0.02);
  },

  // ----- the effects (t = start time, r = pitch rate, v = volume scale) -----
  recipes: {
    click(t, r, v)   { this.tone(t, 900 * r, 600 * r, 0.04, { type: 'square', vol: 0.12 * v }); },
    tick(t, r, v)    { this.tone(t, (650 + Math.random() * 250) * r, 500 * r, 0.02, { type: 'square', vol: 0.05 * v }); }, // story typewriter
    type(t, r, v)    { this.tone(t, 520 * r, 480 * r, 0.05, { vol: 0.1 * v }); },                                         // typing dots
    pop(t, r, v)     { this.tone(t, 420 * r, 900 * r, 0.09, { vol: 0.2 * v }); },                                         // a message arrives
    collect(t, r, v) {
      this.tone(t, 660 * r, 660 * r, 0.07, { type: 'triangle', vol: 0.22 * v });
      this.tone(t, 880 * r, 880 * r, 0.09, { type: 'triangle', vol: 0.22 * v, delay: 0.06 });
    },
    wrong(t, r, v)   {
      this.tone(t, 300 * r, 240 * r, 0.1, { type: 'sawtooth', vol: 0.14 * v });
      this.tone(t, 240 * r, 180 * r, 0.14, { type: 'sawtooth', vol: 0.14 * v, delay: 0.09 });
    },
    hit(t, r, v)     {
      this.burst(t, 1800 * r, 300 * r, 0.16, { vol: 0.3 * v, q: 0.8 });
      this.tone(t, 180 * r, 55 * r, 0.2, { type: 'square', vol: 0.22 * v });
    },
    warn(t, r, v)    {
      this.tone(t, 880 * r, 880 * r, 0.07, { type: 'square', vol: 0.1 * v });
      this.tone(t, 880 * r, 880 * r, 0.07, { type: 'square', vol: 0.1 * v, delay: 0.12 });
    },
    whoosh(t, r, v)  { this.burst(t, 300 * r, 3500 * r, 0.4, { vol: 0.3 * v, q: 0.9 }); },                                // message sent
    win(t, r, v)     {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(t, f * r, f * r, 0.14, { type: 'triangle', vol: 0.22 * v, delay: i * 0.1 }));
    },
    fail(t, r, v)    {
      this.tone(t, 330 * r, 280 * r, 0.28, { type: 'sawtooth', vol: 0.16 * v });
      this.tone(t, 280 * r, 190 * r, 0.5, { type: 'sawtooth', vol: 0.16 * v, delay: 0.3 });
    },
    boom(t, r, v)    {                                                                                                    // death phrase slam
      this.tone(t, 140 * r, 38 * r, 0.6, { vol: 0.45 * v });
      this.burst(t, 900 * r, 120 * r, 0.35, { vol: 0.3 * v, q: 0.6 });
    },
    thud(t, r, v)    { this.tone(t, 110 * r, 60 * r, 0.14, { vol: 0.3 * v }); },                                          // story: shake
    boing(t, r, v)   {                                                                                                    // story: bounce
      this.tone(t, 260 * r, 640 * r, 0.12, { vol: 0.2 * v });
      this.tone(t, 640 * r, 340 * r, 0.16, { vol: 0.2 * v, delay: 0.1 });
    },
    buzz(t, r, v)    {                                                                                                    // phone vibrating: two quick pulses
      this.tone(t, 150 * r, 135 * r, 0.12, { type: 'sawtooth', vol: 0.16 * v });
      this.tone(t, 150 * r, 135 * r, 0.12, { type: 'sawtooth', vol: 0.16 * v, delay: 0.16 });
    },
    swipe(t, r, v)   { this.burst(t, 700 * r, 3200 * r, 0.16, { vol: 0.22 * v, q: 1.1 }); },                              // notification swiped away
    swish(t, r, v)   { this.burst(t, 500 * r, 2500 * r, 0.22, { vol: 0.16 * v, q: 1.5 }); },                              // story: slideIn
  },
};
