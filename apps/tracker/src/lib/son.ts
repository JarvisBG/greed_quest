// Voix off et bruitages de l'écran géant (prototype v4 validé le 2026-10-15).
// Voix : phrases fixes enregistrées à l'avance (edge-tts : Henri en français, « Greed Island » par Rémy en anglais ;
// voix/generer.py → public/voix/), jouées à la suite sans se couper ; une phrase absente est dite par la voix du
// navigateur, en secours. Bruitages : générés par Web Audio. Les navigateurs coupent le son tant que personne n'a
// touché la page : un clic sur « Lancer avec le son » à l'ouverture.

export const calme = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let actif = false;
let ctx: AudioContext | null = null;
let sortie: DynamicsCompressorNode | null = null;
let voixFr: SpeechSynthesisVoice | null = null;
let fichiers: Record<string, string> = {};
let file: Promise<void> = Promise.resolve();

function choisirVoix() {
  const v = speechSynthesis.getVoices().filter((x) => (x.lang || '').toLowerCase().startsWith('fr'));
  voixFr = v.find((x) => /google/i.test(x.name)) ?? v.find((x) => /denise|henri|eloise|vivienne|remy|thomas|amelie|audrey/i.test(x.name)) ?? v[0] ?? null;
}
if (typeof speechSynthesis !== 'undefined') {
  choisirVoix();
  speechSynthesis.addEventListener('voiceschanged', choisirVoix);
}

export const sonActif = () => actif;

export async function activerSon(on: boolean): Promise<void> {
  actif = on;
  if (!on) {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    return;
  }
  if (!ctx) {
    ctx = new AudioContext();
    // Un compresseur en sortie : plusieurs bruitages à la fois ne saturent pas les haut-parleurs.
    sortie = ctx.createDynamicsCompressor();
    sortie.threshold.value = -14;
    sortie.ratio.value = 6;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    sortie.connect(g).connect(ctx.destination);
  }
  await ctx.resume();
  try {
    fichiers = (await (await fetch('/voix/index.json')).json()) as Record<string, string>;
  } catch {
    fichiers = {};
  }
  // Préchargement : la première annonce part sans attendre le réseau.
  for (const f of new Set(Object.values(fichiers))) {
    const a = new Audio();
    a.preload = 'auto';
    a.src = `/voix/${f}`;
  }
}

const jouerFichier = (f: string) =>
  new Promise<void>((fini) => {
    const a = new Audio(`/voix/${f}`);
    a.onended = () => fini();
    a.onerror = () => fini();
    a.play().catch(() => fini());
  });

function direNavigateur(texte: string, vitesse: number, hauteur: number): Promise<void> {
  if (typeof speechSynthesis === 'undefined') return Promise.resolve();
  return new Promise((fini) => {
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    if (voixFr) u.voice = voixFr;
    u.rate = vitesse;
    u.pitch = hauteur;
    u.onend = () => fini();
    u.onerror = () => fini();
    speechSynthesis.speak(u);
  });
}

/** La voix du jeu : une phrase fixe, calée sur l'image (délai en ms). */
export function dire(texte: string, { delai = 0, vitesse = 1.05, hauteur = 0.85 } = {}): void {
  if (!actif) return;
  setTimeout(
    () => {
      const f = fichiers[texte];
      file = file.then(() => (f ? jouerFichier(f) : direNavigateur(texte, vitesse, hauteur)));
    },
    calme ? 0 : delai,
  );
}

function bruitBlanc(c: AudioContext, duree: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * duree), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function note(c: AudioContext, out: AudioNode, t: number, freq: number, duree: number, { type = 'triangle' as OscillatorType, vol = 0.3, attaque = 0.01 } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + duree + 0.05);
}

type Bruit = 'impact' | 'souffle' | 'eclat' | 'sirene' | 'gong' | 'fanfare';

const SONS: Record<Bruit, (c: AudioContext, out: AudioNode, t: number) => void> = {
  // Coup sourd : une case qui claque, un tampon, une carte qui tombe.
  impact(c, out, t) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.8);
    const n = bruitBlanc(c, 0.4);
    const f = c.createBiquadFilter();
    const gn = c.createGain();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    gn.gain.setValueAtTime(0.6, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(f).connect(gn).connect(out);
    n.start(t);
  },
  // Souffle qui passe : une entrée, un dépassement.
  souffle(c, out, t) {
    const n = bruitBlanc(c, 0.7);
    const f = c.createBiquadFilter();
    const g = c.createGain();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    n.connect(f).connect(g).connect(out);
    n.start(t);
  },
  // Carillon qui monte : une carte rare.
  eclat(c, out, t) {
    [880, 1108.7, 1318.5, 1760, 2217.5].forEach((f, i) => note(c, out, t + i * 0.08, f, 1.4, { vol: 0.18 }));
  },
  // Sirène du raid et de la phase finale.
  sirene(c, out, t) {
    const duree = 3.2;
    const o = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    o.type = 'sawtooth';
    f.type = 'lowpass';
    f.frequency.value = 2200;
    o.frequency.setValueAtTime(520, t);
    for (let k = 0; k < duree / 0.8; k++) {
      o.frequency.linearRampToValueAtTime(940, t + k * 0.8 + 0.4);
      o.frequency.linearRampToValueAtTime(520, t + k * 0.8 + 0.8);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.1);
    g.gain.setValueAtTime(0.22, t + duree - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + duree + 0.05);
  },
  // Gong : Jarvis, la fin.
  gong(c, out, t) {
    [1, 2.76, 5.4, 8.93].forEach((k, i) => note(c, out, t, 98 * k, 5 - i, { type: 'sine', vol: 0.5 / (i + 1), attaque: 0.005 }));
    SONS.impact(c, out, t);
  },
  // Fanfare : le Clear, la Brigade vaincue, le vainqueur.
  fanfare(c, out, t) {
    ([[523.3, 0], [659.3, 0.14], [784, 0.28], [1046.5, 0.46]] as const).forEach(([f, d]) => note(c, out, t + d, f, d === 0.46 ? 1.8 : 0.35, { type: 'square', vol: 0.12 }));
    [523.3, 659.3, 784].forEach((f) => note(c, out, t + 0.46, f, 1.8, { type: 'triangle', vol: 0.12 }));
  },
};

export function bruiter(nom: Bruit, delai = 0): void {
  if (actif && ctx && sortie) SONS[nom](ctx, sortie, ctx.currentTime + (calme ? 0 : delai / 1000));
}
