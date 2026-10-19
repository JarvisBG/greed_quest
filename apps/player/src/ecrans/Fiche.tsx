// RG-5.3 (amendement 2026-10-18) : Fiche Hunter, obligatoire, à la place de l'Examen (prototype validé :
// docs/prototype/fiche-hunter.html). Planche de 4 cases ; la miniature se remplit d'encre case après case ; à la fin,
// le sceau de l'Association frappe la fiche et la pièce « +30 J » file vers le compteur de la barre.
import { GENRES, OCCUPATIONS, RESEAUX, SOURCES, TRANCHES_AGE, VILLES, telephoneCamerounais, type ChoixFiche } from '@gq/shared';
import { Concentration, Dialogue } from '@gq/ui';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';

type Cle = 'age' | 'genre' | 'occupation' | 'ville' | 'source';
interface Reponses {
  age: string | null;
  genre: string | null;
  occupation: string | null;
  ville: string | null;
  source: string | null;
  reseaux: string[];
  quartier: string;
  /** Chiffres seuls, 9 au plus (sans +237). */
  tel: string;
  accord: boolean;
}
const VIDE: Reponses = { age: null, genre: null, occupation: null, ville: null, source: null, reseaux: [], quartier: '', tel: '', accord: false };

/** Chiffres saisis, sans indicatif ni séparateurs. */
export const chiffresTel = (v: string) => v.replace(/\D/g, '').replace(/^(00)?237(?=\d{9})/, '').slice(0, 9);
/** « 6 77 12 34 56 » */
export const grouperTel = (d: string) => [d.slice(0, 1), d.slice(1, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');

/** Ce qui manque à une case (vide : la case est complète). */
export function manques(r: Reponses, etape: number): string[] {
  if (etape === 0) return (['age', 'genre', 'occupation'] as const).filter((k) => !r[k]);
  if (etape === 1) return [...(r.ville ? [] : ['ville']), ...(r.quartier.trim().length >= 2 ? [] : ['quartier'])];
  if (etape === 2) return [...(r.reseaux.length ? [] : ['reseaux']), ...(r.source ? [] : ['source'])];
  return telephoneCamerounais(r.tel) ? [] : ['tel'];
}

const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const libelle = (l: readonly ChoixFiche[], id: string | null) => l.find((c) => c.id === id)?.libelle ?? '';

function IconeCoche() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12.5 9.5 18 20 6.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="square" />
    </svg>
  );
}
function IconeFleche({ retour }: { retour?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={retour ? 'M20 12H5M11 5.5 4.5 12 11 18.5' : 'M4 12h15M13 5.5 19.5 12 13 18.5'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}
function IconeAlerte() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 23 21.5H1Z" fill="currentColor" />
      <path d="M12 9v6M12 17.2v1.6" stroke="#fbfbf7" strokeWidth="2.6" />
    </svg>
  );
}

/** Une rangée de choix d'un tap (un seul, ou plusieurs avec coches). */
function Choix({ titre, liste, valeur, multi, manque, onChoix }: { titre: string; liste: readonly ChoixFiche[]; valeur: string | string[] | null; multi?: boolean; manque: boolean; onChoix: (id: string) => void }) {
  return (
    <div className={`fiche-groupe${manque ? ' manque' : ''}`}>
      <span>{titre}</span>
      <div className={`fiche-choix${liste.length === 2 ? ' deux' : ''}`} role={multi ? 'group' : 'radiogroup'} aria-label={titre}>
        {liste.map((c) => {
          const on = multi ? (valeur as string[]).includes(c.id) : valeur === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className="fiche-puce"
              {...(multi ? { 'aria-pressed': on } : { role: 'radio', 'aria-checked': on })}
              onClick={() => onChoix(c.id)}
            >
              {multi && (
                <span className="coche">
                  <IconeCoche />
                </span>
              )}
              {c.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Fiche({ partieId, pseudo, onJenny, onFini }: { partieId: string; pseudo: string; onJenny: (jenny: number) => void; onFini: () => void }) {
  const [r, setR] = useState<Reponses>(VIDE);
  const [etape, setEtape] = useState(0);
  const [sens, setSens] = useState<'entre' | 'recule' | ''>('');
  const [tente, setTente] = useState(false);
  const [telVu, setTelVu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Fiche enregistrée par le serveur : solde annoncé. */
  const [fini, setFini] = useState<{ jenny: number; bonus: number } | null>(null);
  const [scelle, setScelle] = useState(false);

  const moins15 = r.age === 'moins15';
  const nb = moins15 ? 3 : 4;
  const m = manques(r, etape);
  const derniere = etape === nb - 1;
  const montre = (k: string) => tente && m.includes(k);
  const choisir = (k: Cle) => (id: string) => setR((x) => ({ ...x, [k]: id }));

  function aller(n: number) {
    setSens(n > etape ? 'entre' : 'recule');
    setEtape(n);
    setTente(false);
    setErreur(null);
    window.scrollTo({ top: 0, behavior: reduit() ? 'auto' : 'smooth' });
  }

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (m.length) {
      setTente(true);
      if (etape === 3) setTelVu(true);
      return;
    }
    if (!derniere) return aller(etape + 1);
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await api.post<{ bonus: number; jenny: number }>(`/parties/${partieId}/fiche`, {
        age: r.age,
        genre: r.genre,
        occupation: r.occupation,
        ville: r.ville,
        quartier: r.quartier.trim(),
        reseaux: r.reseaux,
        source: r.source,
        ...(moins15 ? {} : { telephone: r.tel, accordRecontact: r.accord }),
      });
      setFini(res);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErreur(err instanceof ApiError ? (err.horsLigne ? 'Pas de connexion : ta fiche n’est pas partie. Réessaie dans un instant.' : err.message) : 'Envoi impossible, réessaie.');
    } finally {
      setEnvoi(false);
    }
  }

  if (fini) return <FicheScellee pseudo={pseudo} r={r} fini={fini} scelle={scelle} setScelle={setScelle} onJenny={onJenny} onFini={onFini} />;

  const telKo = (telVu || tente) && etape === 3 && !telephoneCamerounais(r.tel);
  return (
    <div className="planche fiche">
      <div className="fiche-tete">
        <div className="fiche-mini" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i === 3 && moins15 ? 'sautee' : i < etape ? 'fait' : i === etape ? 'ici' : ''} />
          ))}
        </div>
        <div>
          <h1>Fiche Hunter</h1>
          <p>
            Case {etape + 1} sur {nb}
          </p>
        </div>
      </div>
      {etape === 0 && (
        <Dialogue qui="Association des Hunters">
          Avant d’entrer sur l’île, chaque Hunter s’enregistre. Quatre cases, une minute. Fiche remplie : +30 J.
        </Dialogue>
      )}

      <form className="fiche-form" onSubmit={valider} noValidate>
        <section key={etape} className={`gi-case fiche-case ${sens}`}>
          {etape === 0 && (
            <>
              <h2>Qui es-tu ?</h2>
              <Choix titre="Âge" liste={TRANCHES_AGE} valeur={r.age} manque={montre('age')} onChoix={choisir('age')} />
              <Choix titre="Genre" liste={GENRES} valeur={r.genre} manque={montre('genre')} onChoix={choisir('genre')} />
              <Choix titre="Tu es" liste={OCCUPATIONS} valeur={r.occupation} manque={montre('occupation')} onChoix={choisir('occupation')} />
            </>
          )}
          {etape === 1 && (
            <>
              <h2>D’où viens-tu ?</h2>
              <Choix titre="Ville" liste={VILLES} valeur={r.ville} manque={montre('ville')} onChoix={choisir('ville')} />
              <label className="fiche-champ">
                <span>{r.ville === 'autre' ? 'Ta ville et ton quartier' : 'Ton quartier'}</span>
                <span className="fiche-saisie texte">
                  <input
                    id="fiche-quartier"
                    type="text"
                    maxLength={40}
                    autoComplete="address-level3"
                    placeholder="Ex. Akwa, Bastos, Bonamoussadi"
                    value={r.quartier}
                    onChange={(e) => setR((x) => ({ ...x, quartier: e.target.value }))}
                  />
                </span>
              </label>
              {montre('quartier') && (
                <p className="fiche-erreur">
                  <IconeAlerte />
                  Écris ton quartier (2 lettres au moins).
                </p>
              )}
            </>
          )}
          {etape === 2 && (
            <>
              <h2>Où es-tu actif ?</h2>
              <p className="fiche-aide">Tous ceux que tu utilises.</p>
              <Choix
                titre="Réseaux"
                liste={RESEAUX}
                valeur={r.reseaux}
                multi
                manque={montre('reseaux')}
                onChoix={(id) => setR((x) => ({ ...x, reseaux: x.reseaux.includes(id) ? x.reseaux.filter((y) => y !== id) : [...x.reseaux, id] }))}
              />
              <Choix titre="Tu as connu le jeu par" liste={SOURCES} valeur={r.source} manque={montre('source')} onChoix={choisir('source')} />
            </>
          )}
          {etape === 3 && (
            <>
              <h2>Ton numéro WhatsApp</h2>
              <label className="fiche-champ">
                <span>Numéro</span>
                <span className={`fiche-saisie${telKo ? ' ko' : ''}`}>
                  <span className="prefixe">+237</span>
                  <input
                    id="fiche-tel"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="6 77 12 34 56"
                    aria-invalid={telKo}
                    aria-describedby={telKo ? 'fiche-e-tel' : undefined}
                    value={grouperTel(r.tel)}
                    onChange={(e) => setR((x) => ({ ...x, tel: chiffresTel(e.target.value) }))}
                    onBlur={() => r.tel && setTelVu(true)}
                  />
                </span>
              </label>
              {telKo && (
                <p className="fiche-erreur" id="fiche-e-tel">
                  <IconeAlerte />
                  9 chiffres, qui commencent par 6 (ou 2 pour un fixe).
                </p>
              )}
              <button type="button" className="fiche-accord" role="checkbox" aria-checked={r.accord} onClick={() => setR((x) => ({ ...x, accord: !x.accord }))}>
                <span className="boite">
                  <IconeCoche />
                </span>
                <span>
                  <strong>Préviens-moi des prochaines parties</strong>
                  <small>Un message WhatsApp quand une nouvelle partie est annoncée. Tu peux décocher.</small>
                </span>
              </button>
              <p className="fiche-secret">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="10.5" width="16" height="11" fill="currentColor" />
                  <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" fill="none" stroke="currentColor" strokeWidth="2.8" />
                </svg>
                Ton numéro n’est jamais montré aux autres joueurs.
              </p>
            </>
          )}
          <i className="fiche-trame" aria-hidden="true" />
        </section>

        {erreur && (
          <p className="fiche-erreur" role="alert">
            <IconeAlerte />
            {erreur}
          </p>
        )}
        <button type="submit" className="gi-btn-encre fiche-suivant" aria-disabled={m.length > 0 || envoi}>
          {envoi ? 'Envoi…' : derniere ? 'Valider ma fiche' : 'Case suivante'}
          <IconeFleche />
        </button>
        {etape > 0 && (
          <button type="button" className="fiche-retour" onClick={() => aller(etape - 1)}>
            <IconeFleche retour />
            Case précédente
          </button>
        )}
      </form>
    </div>
  );
}

/** Fin : récapitulatif, sceau de l'Association, pièce « +30 J » vers le compteur. */
function FicheScellee({
  pseudo,
  r,
  fini,
  scelle,
  setScelle,
  onJenny,
  onFini,
}: {
  pseudo: string;
  r: Reponses;
  fini: { jenny: number; bonus: number };
  scelle: boolean;
  setScelle: (v: boolean) => void;
  onJenny: (jenny: number) => void;
  onFini: () => void;
}) {
  const carte = useRef<HTMLDivElement>(null);
  const sceau = useRef<HTMLDivElement>(null);
  const piece = useRef<HTMLDivElement>(null);
  const lignes = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const crediter = () => {
      onJenny(fini.jenny);
      const j = document.querySelector('.barre .jenny');
      j?.classList.remove('gagne');
      void (j as HTMLElement | null)?.offsetWidth;
      j?.classList.add('gagne');
    };
    if (reduit() || !sceau.current) {
      setScelle(true);
      crediter();
      return;
    }
    const s = sceau.current;
    // Opacité finale posée en style (leçon de la page ⑧ : certains téléphones perdaient l'état final).
    s.animate(
      [
        { opacity: 0, transform: 'rotate(-30deg) scale(2.6)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'rotate(-12deg) scale(0.92)', filter: 'blur(0)', offset: 0.72 },
        { opacity: 0.92, transform: 'rotate(-14deg) scale(1)' },
      ],
      { duration: 520, delay: 420, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'both' },
    ).finished.then(() => {
      s.style.opacity = '0.92';
      s.style.transform = 'rotate(-14deg)';
    }, () => undefined);
    lignes.current?.animate([{ opacity: 0 }, { opacity: 0.16, offset: 0.25 }, { opacity: 0 }], { duration: 700, delay: 800, fill: 'both' });
    try {
      carte.current?.animate(
        [{ transform: 'none' }, { transform: 'translate(-3px, 4px) rotate(-0.6deg)' }, { transform: 'translate(2px, -2px)' }, { transform: 'none' }],
        { duration: 260, delay: 800, easing: 'ease-out' },
      );
    } catch {
      /* secousse facultative */
    }
    const vibre = setTimeout(() => navigator.vibrate?.(40), 800);
    const vol = setTimeout(() => {
      setScelle(true);
      const p = piece.current;
      const cible = document.querySelector('.barre .jenny')?.getBoundingClientRect();
      const depart = s.getBoundingClientRect();
      if (!p || !cible) return crediter();
      const x0 = depart.left + depart.width / 2 - 50, y0 = depart.top + depart.height / 2;
      p.animate(
        [
          { opacity: 0, transform: `translate(${x0}px, ${y0}px) scale(0.6)` },
          { opacity: 1, transform: `translate(${x0}px, ${y0 - 40}px) scale(1.1)`, offset: 0.3 },
          { opacity: 1, transform: `translate(${(x0 + cible.left) / 2}px, ${Math.min(y0, cible.top) - 30}px) scale(1)`, offset: 0.65 },
          { opacity: 0, transform: `translate(${cible.left}px, ${cible.top}px) scale(0.5)` },
        ],
        { duration: 900, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'both' },
      ).finished.then(crediter, crediter);
    }, 1200);
    return () => {
      clearTimeout(vibre);
      clearTimeout(vol);
    };
  }, []);

  const lignesRecap: [string, string][] = [
    ['Âge', libelle(TRANCHES_AGE, r.age)],
    ['Genre', libelle(GENRES, r.genre)],
    ['Tu es', libelle(OCCUPATIONS, r.occupation)],
    ['Ville', `${libelle(VILLES, r.ville)} · ${r.quartier.trim()}`],
    ['Réseaux', r.reseaux.map((x) => libelle(RESEAUX, x)).join(', ')],
    ['Connu par', libelle(SOURCES, r.source)],
    ...(r.age === 'moins15' ? [] : ([['WhatsApp', `+237 ${grouperTel(r.tel)}`]] as [string, string][])),
  ];
  return (
    <div className="planche fiche">
      <div className="fiche-tete">
        <div className="fiche-mini" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i === 3 && r.age === 'moins15' ? 'sautee' : 'fait'} />
          ))}
        </div>
        <div>
          <h1>Fiche Hunter</h1>
          <p>Fiche complète</p>
        </div>
      </div>
      <div className="gi-case fiche-finale" ref={carte}>
        <div className="fiche-lignes" ref={lignes}>
          <Concentration graine={41} />
        </div>
        <h2>Fiche de {pseudo}</h2>
        <dl>
          {lignesRecap.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="fiche-sceau" ref={sceau} aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <defs>
              <filter id="fiche-encre">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
                <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.75" />
                <feComposite in="SourceGraphic" operator="in" />
              </filter>
            </defs>
            <g filter="url(#fiche-encre)">
            <circle cx="60" cy="60" r="55" fill="none" stroke="currentColor" strokeWidth="7" />
            <circle cx="60" cy="60" r="45" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <text x="60" y="50" textAnchor="middle" fontFamily="Dela Gothic One" fontSize="13.5" fill="currentColor" letterSpacing="0.5">
              HUNTER
            </text>
            <path d="M24 57h72" stroke="currentColor" strokeWidth="2.5" />
            <text x="60" y="76" textAnchor="middle" fontFamily="Dela Gothic One" fontSize="11" textLength="74" lengthAdjust="spacingAndGlyphs" fill="currentColor">
              ENREGISTRÉ
            </text>
            </g>
          </svg>
        </div>
      </div>
      {scelle && (
        <>
          <Dialogue qui="Association des Hunters">Fiche enregistrée. Voici {fini.bonus} J pour ton voyage. Il est temps de découvrir ton Nen.</Dialogue>
          <button type="button" className="gi-btn-encre" onClick={onFini}>
            Continuer
          </button>
        </>
      )}
      <div className="fiche-piece" ref={piece} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10.5" fill="#d7b25a" stroke="#8a6a12" strokeWidth="2" />
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="#8a6a12" strokeWidth="1.6" />
          <path d="M12 8.5v7M9.6 10.6h4.8" stroke="#8a6a12" strokeWidth="1.8" />
        </svg>
        +{fini.bonus} J
      </div>
    </div>
  );
}
