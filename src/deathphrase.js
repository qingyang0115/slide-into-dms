// Death phrases: coherent phrases that form when reply-bar words combine across word
// boundaries ("be at u up" reads as "beat u up"). Matching, telegraph check, and level
// validation live here. Data: level.deathPhrases = [{ phrase, reply }].

const DeathPhrase = {
  // Lowercase, strip spaces and light punctuation so "be at u up?" ~ "beat u up".
  normalize(s) {
    return s.toLowerCase().replace(/[\s.,!?'"’`]/g, '');
  },

  joined(entries) {
    return this.normalize(entries.map((e) => e.text).join(' '));
  },

  // The death phrase the bar currently contains, or null.
  match(level, entries) {
    if (!level.deathPhrases || !entries.length) return null;
    const msg = this.joined(entries);
    return level.deathPhrases.find((d) => msg.includes(this.normalize(d.phrase))) || null;
  },

  // Every word the player could still add: all answer words plus the bad words.
  candidateWords(level) {
    const words = new Set(level.badWords);
    for (const a of level.answers) for (const w of a.words) words.add(w);
    return [...words];
  },

  // True if adding one more word would complete a death phrase (drives the telegraph).
  oneAway(level, entries) {
    if (!level.deathPhrases || !entries.length) return false;
    const msg = this.joined(entries);
    const candidates = this.candidateWords(level).map((w) => this.normalize(w));
    return level.deathPhrases.some((d) => {
      const p = this.normalize(d.phrase);
      return candidates.some((w) => (msg + w).includes(p));
    });
  },

  // Could `phrase` appear as a substring of some concatenation of `words` (repeats allowed)?
  // The first word may start before the phrase and the last may run past it.
  canForm(phrase, words) {
    const ws = words.map((w) => this.normalize(w)).filter(Boolean);
    const n = phrase.length;
    const reach = new Array(n + 1).fill(false);
    for (const w of ws) {
      if (w.includes(phrase)) return true;
      // A word whose tail equals the phrase's head starts the phrase.
      for (let k = 1; k <= Math.min(w.length, n); k++) {
        if (w.endsWith(phrase.slice(0, k))) reach[k] = true;
      }
    }
    for (let i = 1; i <= n; i++) {
      if (!reach[i]) continue;
      if (i === n) return true;
      for (const w of ws) {
        if (phrase.startsWith(w, i)) reach[i + w.length] = true;
        if (w.startsWith(phrase.slice(i))) return true; // last word runs past the end
      }
    }
    return reach[n];
  },

  // Checks every level's death phrases; console.warns problems and returns them.
  validate(levels) {
    const warnings = [];
    const warn = (level, d, msg) => {
      const text = `[deathPhrases] level "${level.id}", "${d.phrase}": ${msg}`;
      warnings.push(text);
      console.warn(text);
    };
    for (const level of levels) {
      const good = level.answers.flatMap((a) => a.words);
      for (const d of level.deathPhrases || []) {
        const p = this.normalize(d.phrase);
        if (!p) { warn(level, d, 'empty phrase'); continue; }
        if (!d.reply) warn(level, d, 'missing "reply"');
        for (const a of level.answers) {
          if (this.normalize(a.words.join(' ')).includes(p)) {
            warn(level, d, `the correct answer "${a.words.join(' ')}" would trigger it`);
          }
        }
        if (this.canForm(p, good)) warn(level, d, 'can be built from good words alone (needs at least one bad word)');
        if (!this.canForm(p, [...good, ...level.badWords])) warn(level, d, 'unreachable: cannot be built from this level\'s good + bad words');
      }
    }
    return warnings;
  },
};
