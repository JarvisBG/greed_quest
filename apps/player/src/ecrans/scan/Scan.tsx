// Page ⑥ : le scanner (prototype validé par Sivraj le 2026-10-10 : docs/prototype/scanner-tirage.html).
// RG-7 : le joueur vise le QR d'une balise, l'app envoie l'intention (P1) ; le tirage reçu est mis en scène
// par la cinématique `Tirage` (jouée au niveau de l'app). RG-7.4 : un refus s'affiche en clair, dans la boîte
// du jeu posée sur le viseur (tout tient dans un écran). Boucle (RG-7.1) + objet Second souffle : on propose
// de le consommer. RG-7.5 : sans réseau, la carte de dos part dans la pile en tête du viseur.
import { Carte, DosCarte } from '@gq/ui';
import QrScanner from 'qr-scanner';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/client';
import { OBJETS } from '../../lib/format';
import type { LivreRecu } from '../../lib/livre';
import { lireQrBalise } from '../../lib/qr';
import type { IssueScan } from '../../lib/scan';
import { etapesDuTirage, type Etape } from '../../lib/tirage';
import type { OptionsTirage } from './Tirage';

const EASE = 'cubic-bezier(.16,1,.3,1)';
/** Même balise relue par la caméra : ignorée tant que sa réponse est affichée, puis encore 5 s. */
const RELECTURE_MS = 5000;

type Reponse =
  | { genre: 'refus'; message: string; souffle: boolean }
  | { genre: 'info'; message: string; seule?: boolean };

const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};

export function Scan({
  partieId,
  scannerBalise,
  enFile,
  gpsErreur,
  baliseInitiale,
  jouerTirage,
  majJenny,
  ajouterJenny,
}: {
  partieId: string;
  scannerBalise: (baliseId: string, secondSouffle?: boolean) => Promise<IssueScan>;
  enFile: number;
  gpsErreur: string | null;
  baliseInitiale?: string | null;
  jouerTirage: (etapes: Etape[], o?: OptionsTirage) => Promise<void>;
  majJenny: (jenny: number) => void;
  ajouterJenny: (montant: number) => void;
}) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [texte, setTexte] = useState('');
  const [avis, setAvis] = useState<string | null>(null);
  const [camera, setCamera] = useState<'demarrage' | 'ok' | 'refusee'>('demarrage');
  const [saisie, setSaisie] = useState(false);
  const [code, setCode] = useState('');
  const r = {
    viseur: useRef<HTMLDivElement>(null),
    video: useRef<HTMLVideoElement>(null),
    cible: useRef<HTMLDivElement>(null),
    eclair: useRef<HTMLDivElement>(null),
    pile: useRef<HTMLDivElement>(null),
    souffle: useRef<HTMLDivElement>(null),
    champ: useRef<HTMLInputElement>(null),
  };
  const occupe = useRef(false);
  const derniere = useRef<{ id: string; a: number } | null>(null);
  const reponseRef = useRef(reponse);
  reponseRef.current = reponse;
  const vivant = useRef(true);
  useEffect(() => {
    vivant.current = true;
    return () => {
      vivant.current = false;
    };
  }, []);

  // La boîte du jeu s'écrit lettre par lettre (sauf mouvement réduit).
  useEffect(() => {
    if (!reponse) return setTexte('');
    if (calme) return setTexte(reponse.message);
    let n = 0;
    setTexte('');
    const t = setInterval(() => {
      n++;
      setTexte(reponse.message.slice(0, n));
      if (n >= reponse.message.length) clearInterval(t);
    }, 22);
    return () => clearInterval(t);
  }, [reponse, calme]);

  // Boîte « info » seule (hors ligne) : elle s'efface et rend le viseur.
  useEffect(() => {
    if (reponse?.genre !== 'info' || !reponse.seule) return;
    const t = setTimeout(() => setReponse((x) => (x === reponse ? null : x)), 3500);
    return () => clearTimeout(t);
  }, [reponse]);

  useEffect(() => {
    if (!avis) return;
    const t = setTimeout(() => setAvis(null), 2500);
    return () => clearTimeout(t);
  }, [avis]);

  const anim = (el: Element | null, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) =>
    el?.animate(k, { easing: EASE, ...o, duration: calme ? 1 : o.duration });

  /** Verrouillage : les coins se referment sur le QR, éclair ; couvre l'attente du serveur. */
  const verrouiller = () => {
    navigator.vibrate?.(15);
    const a = anim(r.cible.current, [{ transform: 'scale(1)' }, { transform: 'scale(.66)', offset: 0.7 }, { transform: 'scale(.7)' }], { duration: 260, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' });
    anim(r.eclair.current, [{ opacity: 0.7 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
    return a;
  };

  const refuser = async (issue: Extract<IssueScan, { type: 'refus' }>) => {
    r.cible.current?.classList.add('refus');
    navigator.vibrate?.([20, 60, 20]);
    anim(r.viseur.current, [{ transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }], { duration: 340, easing: 'ease-out' });
    setReponse({ genre: 'refus', message: issue.message, souffle: false });
    if (issue.code !== 'boucle') return;
    // Second souffle (objet) : proposé seulement si le joueur en a un de libre dans son Book.
    try {
      const l = await api.get<LivreRecu>(`/parties/${partieId}/livre`);
      if (l.objets.some((o) => o.objet === 'souffle' && !o.engage)) setReponse((x) => (x?.genre === 'refus' && x.message === issue.message ? { ...x, souffle: true } : x));
    } catch {
      // sans Book lisible, pas de proposition
    }
  };

  /** RG-7.5 : la carte de dos file dans la pile en tête du viseur. */
  const mettreEnFile = async () => {
    const plaque = r.cible.current;
    if (!plaque || calme) return;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const pile = r.pile.current;
    if (!pile) return;
    const [vx, vy] = centre(plaque);
    const [px, py] = centre(pile);
    const el = document.createElement('div');
    el.className = 'scan-vole';
    el.style.left = `${vx - 32}px`;
    el.style.top = `${vy - 45}px`;
    const dos = pile.firstElementChild?.cloneNode(true);
    if (dos) el.append(dos);
    document.body.append(el);
    await el
      .animate(
        [
          { transform: 'scale(.2) rotateY(90deg)', opacity: 0 },
          { transform: 'scale(1.15) rotateY(0)', opacity: 1, offset: 0.35 },
          { transform: `translate(${px - vx}px, ${py - vy}px) scale(.5) rotate(10deg)`, opacity: 1 },
        ],
        { duration: 760, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' },
      )
      .finished.catch(() => undefined);
    el.remove();
  };

  const envoyer = async (baliseId: string, secondSouffle = false) => {
    if (occupe.current) return;
    occupe.current = true;
    setReponse(null);
    r.cible.current?.classList.remove('refus');
    const verrou = verrouiller();
    try {
      const [issue] = await Promise.all([scannerBalise(baliseId, secondSouffle), verrou?.finished.catch(() => undefined)]);
      if (!vivant.current) return;
      if (issue.type === 'ok') {
        const origine = r.cible.current ? centre(r.cible.current) : null;
        await jouerTirage(etapesDuTirage(issue.gains), { secondSouffle: issue.secondSouffle, origine, surJenny: ajouterJenny });
        majJenny(issue.jenny);
      } else if (issue.type === 'refus') {
        await refuser(issue);
      } else if (issue.type === 'en_file') {
        await mettreEnFile();
        setReponse({ genre: 'info', message: 'Pas de réseau : ton scan est gardé avec son heure.', seule: true });
      } else {
        setReponse({ genre: 'info', message: 'Cette balise attend déjà dans la file : elle partira au retour du réseau.', seule: true });
      }
    } finally {
      verrou?.cancel();
      derniere.current = { id: baliseId, a: Date.now() };
      occupe.current = false;
    }
  };
  const envoyerRef = useRef(envoyer);
  envoyerRef.current = envoyer;

  // Caméra arrière : lecture continue ; une même balise n'est pas relue tant que sa réponse est affichée.
  useEffect(() => {
    if (!r.video.current) return;
    const scanner = new QrScanner(
      r.video.current,
      (res) => {
        if (occupe.current) return;
        const id = lireQrBalise(res.data);
        if (!id) return setAvis('Ce QR n’est pas une balise du jeu');
        const d = derniere.current;
        if (d && d.id === id && (reponseRef.current || Date.now() - d.a < RELECTURE_MS)) return;
        void envoyerRef.current(id);
      },
      { preferredCamera: 'environment', highlightScanRegion: false, highlightCodeOutline: false, maxScansPerSecond: 5 },
    );
    scanner.start().then(
      () => setCamera('ok'),
      () => {
        setCamera('refusee');
        setSaisie(true);
      },
    );
    return () => scanner.destroy();
  }, []);

  useEffect(() => {
    if (baliseInitiale) void envoyer(baliseInitiale);
    // une seule fois, à l'ouverture par lien
  }, []);

  useEffect(() => {
    if (saisie && camera === 'ok') r.champ.current?.focus();
  }, [saisie]);

  /** Second souffle : la carte d'objet monte dans le viseur, se consume, puis le scan repart. */
  const utiliserSouffle = async () => {
    const id = derniere.current?.id;
    const src = r.souffle.current;
    const cible = r.cible.current;
    if (!id || !src || !cible || occupe.current) return;
    if (!calme) {
      const b = src.getBoundingClientRect();
      const [vx, vy] = centre(cible);
      const dx = vx - (b.left + b.width / 2);
      const dy = vy - (b.top + b.height / 2);
      const el = src.cloneNode(true) as HTMLElement;
      el.className = 'scan-vole';
      el.style.width = `${b.width}px`;
      el.style.left = `${b.left}px`;
      el.style.top = `${b.top}px`;
      document.body.append(el);
      src.style.visibility = 'hidden';
      navigator.vibrate?.(15);
      await el
        .animate(
          [{ transform: 'none' }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) rotate(-8deg) scale(1.3)`, offset: 0.55 }, { transform: `translate(${dx}px, ${dy}px) rotate(4deg) scale(1.6)` }],
          { duration: 520, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' },
        )
        .finished.catch(() => undefined);
      await el
        .animate([{ opacity: 1, filter: 'brightness(1) blur(0)' }, { opacity: 0, filter: 'brightness(2.4) blur(6px)', transform: `translate(${dx}px, ${dy - 30}px) rotate(14deg) scale(2.1)` }], {
          duration: 360,
          easing: 'ease-in',
          fill: 'forwards',
        })
        .finished.catch(() => undefined);
      el.remove();
    }
    await envoyer(id, true);
  };

  const fermerReponse = () => {
    setReponse(null);
    r.cible.current?.classList.remove('refus');
  };

  return (
    <div className="scan-page">
      <div className="tete-page scan-tete">
        <h1>Scanner</h1>
        <span className={`scan-gps${gpsErreur ? ' perdu' : ''}`}>
          <i className={`gi-pastille${gpsErreur ? '' : ' en_ligne'}`} aria-hidden="true" />
          {gpsErreur ? 'Position introuvable' : 'GPS actif'}
        </span>
      </div>
      {gpsErreur && <p className="scan-gps-detail">{gpsErreur}</p>}

      <div ref={r.viseur} className="scan-viseur">
        <video ref={r.video} muted playsInline aria-label="Image de la caméra" />
        {camera === 'refusee' && <p className="scan-camera">Caméra indisponible : autorise-la dans les réglages du navigateur, ou saisis le code de la balise.</p>}
        <div ref={r.cible} className="scan-cible" aria-hidden="true">
          <i className="coin hg" />
          <i className="coin hd" />
          <i className="coin bg" />
          <i className="coin bd" />
        </div>
        <div ref={r.eclair} className="scan-eclair" aria-hidden="true" />
        {enFile > 0 && (
          <div className="scan-file" role="status">
            <div ref={r.pile} className="scan-pile" aria-hidden="true">
              {Array.from({ length: Math.min(3, enFile) }, (_, i) => (
                <DosCarte key={i} />
              ))}
            </div>
            <p>
              <b>
                {enFile} scan{enFile > 1 ? 's' : ''} en attente de réseau
              </b>
              {enFile > 1 ? 'Ils partiront dès le retour du réseau, s’ils ont' : 'Il partira dès le retour du réseau, s’il a'} moins de 10 min.
            </p>
          </div>
        )}
        {!reponse && (
          <div className="scan-bandeau" role="status">
            {avis ?? 'Vise le QR d’une balise'}
            {!avis && <span>La lecture est automatique</span>}
          </div>
        )}
        {reponse && (
          <div className="scan-reponse" aria-live="polite">
            {/* Toucher la boîte (hors boutons) la ferme et rend le viseur. */}
            <div className="gi-dialogue" onClick={(e) => !(e.target as Element).closest('button') && fermerReponse()}>
              <span className={`a-qui${reponse.genre === 'refus' ? ' refus' : ''}`}>{reponse.genre === 'refus' ? 'Scan refusé' : 'Greed Island'}</span>
              <p className="a-texte" aria-hidden="true">
                {texte}
              </p>
              <p className="sr">{reponse.message}</p>
              {reponse.genre === 'refus' && reponse.souffle && (
                <>
                  <div className="scan-souffle">
                    <div ref={r.souffle}>
                      <Carte genre="objet" numero="—" nom={OBJETS.souffle.nom} texte={OBJETS.souffle.effet} />
                    </div>
                    <p>
                      Tu as un <b>Second souffle</b> : il te laisse rescanner cette balise sans faire la boucle.
                    </p>
                  </div>
                  <div className="a-actions">
                    <button className="clair" onClick={() => void utiliserSouffle()}>
                      Utiliser le Second souffle
                    </button>
                    <button className="discret" onClick={fermerReponse}>
                      Le garder
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <button className="gi-lien" aria-expanded={saisie} onClick={() => setSaisie((s) => !s)}>
        Le QR ne passe pas ? Saisis le code
      </button>
      {saisie && (
        <form
          className="scan-saisie"
          onSubmit={(e) => {
            e.preventDefault();
            const id = lireQrBalise(code);
            if (!id) return setAvis('Ce code n’est pas celui d’une balise du jeu');
            setCode('');
            void envoyer(id);
          }}
        >
          <input ref={r.champ} className="gi-champ" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code de la balise" aria-label="Code de la balise" autoCapitalize="off" autoCorrect="off" autoComplete="off" />
          <button type="submit" className="gi-btn-trait" disabled={!code.trim()}>
            Valider
          </button>
        </form>
      )}
    </div>
  );
}
