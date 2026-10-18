// Page d'accueil vitrine de Greed Island : pour les partenaires (lieux, festivals, sponsors), avec les accès aux 3 apps.
import { BANQUE_CARTES, type Rank } from '@gq/shared';
import { Carte, Concentration, Dialogue } from '@gq/ui';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { IleDemo } from './Ile';
import { APP_JOUEUR, CONSOLE, CONTACT_NOM, ECRAN, TELEPHONES, WHATSAPP } from './liens';

const carte = (n: number) => {
  const c = BANQUE_CARTES.find((x) => x.numero === n)!;
  return { numero: c.numero, nom: c.nom, rang: c.rang as Rank, texte: c.texte };
};
/** L'éventail de la première page : la SS au centre. */
const EVENTAIL = [carte(81), carte(17), carte(0), carte(9), carte(15)];
/** Une page du Book : quatre pochettes remplies, les autres attendent leur carte (numéro en filigrane). */
const BOOK: { n: number; pleine: boolean }[] = [3, 5, 11, 24, 75, 81, 86, 90, 97].map((n) => ({ n, pleine: [3, 11, 75, 90].includes(n) }));
const SORTS = [
  { numero: 1007, nom: 'Vol' },
  { numero: 1008, nom: 'Échange' },
  { numero: 1003, nom: 'Mur défensif' },
];

const reduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Déjà vue pendant cette visite ? `?ouverture` la rejoue toujours (pour la montrer). */
function dejaVue(): boolean {
  if (new URLSearchParams(window.location.search).has('ouverture')) return false;
  try {
    return sessionStorage.getItem('gi-intro') === '1';
  } catch {
    return false;
  }
}

function IconeWhatsapp() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.2a9.7 9.7 0 0 0-8.3 14.8L2.3 21.8l4.9-1.3A9.7 9.7 0 1 0 12 2.2Zm0 17.7c-1.5 0-3-.4-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1c0 1.2.9 2.4 1 2.6.1.2 1.8 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.2l-.5-.2Z"
      />
    </svg>
  );
}
function Fleche({ bas }: { bas?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="fleche" style={bas ? { transform: 'rotate(90deg)' } : undefined}>
      <path d="M4 12h15M13 5.5 19.5 12 13 18.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

/**
 * Ouverture (une fois par visite) : lignes de concentration, « GREED ISLAND » frappé lettre à lettre, puis le rideau
 * s'ouvre et les cartes de l'éventail partent du centre de l'écran vers leur place.
 */
function useOuverture(eventail: React.RefObject<HTMLDivElement | null>) {
  const [phase, setPhase] = useState<'titre' | 'envol' | 'fini'>(() => (reduit() || dejaVue() ? 'fini' : 'titre'));
  useLayoutEffect(() => {
    if (phase !== 'envol' || !eventail.current) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    eventail.current.querySelectorAll<HTMLElement>('.vol').forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--dx', `${(cx - (r.left + r.width / 2)).toFixed(0)}px`);
      el.style.setProperty('--dy', `${(cy - (r.top + r.height / 2)).toFixed(0)}px`);
    });
  }, [phase, eventail]);
  useEffect(() => {
    if (phase === 'fini') return;
    try {
      sessionStorage.setItem('gi-intro', '1');
    } catch {
      /* navigation privée : l'ouverture rejouera, rien de grave */
    }
    const t = setTimeout(() => setPhase(phase === 'titre' ? 'envol' : 'fini'), phase === 'titre' ? 1500 : 1100);
    return () => clearTimeout(t);
  }, [phase]);
  return { phase, passer: () => setPhase('fini') };
}

function Ouverture({ phase, passer }: { phase: 'titre' | 'envol'; passer: () => void }) {
  return (
    <div className={`ouverture ${phase}`} onClick={passer} aria-hidden="true">
      <Concentration graine={23} className="ouv-lignes" />
      <p className="ouv-titre">
        {'GREED ISLAND'.split('').map((l, i) => (
          <span key={i} className={l === ' ' ? 'blanc' : undefined} style={{ animationDelay: `${120 + i * 55}ms` }}>
            {l}
          </span>
        ))}
      </p>
      <button type="button" className="ouv-passer" onClick={passer}>
        Passer
      </button>
    </div>
  );
}

function EcranGeant() {
  const [ouvert, setOuvert] = useState(false);
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem('gi-partie') ?? '';
    } catch {
      return '';
    }
  });
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ouvert) champ.current?.focus();
  }, [ouvert]);
  const ouvrir = (e: FormEvent) => {
    e.preventDefault();
    const v = id.trim();
    if (!v) return;
    try {
      localStorage.setItem('gi-partie', v);
    } catch {
      /* pas de mémoire : tant pis */
    }
    window.location.href = `${ECRAN}/?partie=${encodeURIComponent(v)}`;
  };
  return (
    <li className={`acces-ligne${ouvert ? ' ouvert' : ''}`}>
      <button type="button" className="acces-lien" aria-expanded={ouvert} aria-controls="ecran-form" onClick={() => setOuvert(!ouvert)}>
        <span className="acces-nom">Écran géant</span>
        <span className="acces-dit">La partie racontée en direct au public, sur un téléviseur ou un vidéoprojecteur.</span>
        <Fleche bas={!ouvert} />
      </button>
      {ouvert && (
        <form id="ecran-form" className="acces-form" onSubmit={ouvrir}>
          <label htmlFor="partie">Identifiant de la partie</label>
          <div className="acces-champ">
            <input id="partie" ref={champ} value={id} onChange={(e) => setId(e.target.value)} autoCapitalize="off" autoComplete="off" spellCheck={false} placeholder="Donné par le Game Master" />
            <button type="submit" disabled={!id.trim()}>
              Ouvrir l’écran
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

export function App() {
  const eventail = useRef<HTMLDivElement>(null);
  const { phase, passer } = useOuverture(eventail);
  return (
    <>
      {phase !== 'fini' && <Ouverture phase={phase} passer={passer} />}
      <main className={`planche ph-${phase}`}>
        {/* ---------- Première page ---------- */}
        <section className="une" aria-labelledby="titre">
          <div className="case une-texte">
            <h1 id="titre" className="titre">
              <span>Greed</span> <span>Island</span>
            </h1>
            <p className="accroche">Le jeu de Hunter × Hunter, grandeur nature.</p>
            <p className="chapo">
              Une chasse au trésor qui se joue avec son téléphone, dans un parc, sur un site d’événement ou sur un campus. Les joueurs cherchent des balises, collectionnent des cartes et
              s’affrontent jusqu’au Clear.
            </p>
            <div className="une-actions">
              <a className="gi-btn-encre btn" href={WHATSAPP} target="_blank" rel="noopener">
                <IconeWhatsapp /> Organiser une partie
              </a>
              <a className="lien-trait" href="#jeu">
                Découvrir le jeu <Fleche bas />
              </a>
            </div>
          </div>
          <div className="case une-cartes gi-trame" ref={eventail}>
            <Concentration graine={7} className="une-lignes" />
            <div className="eventail">
              {EVENTAIL.map((c, i) => (
                <div key={c.numero} className="vol" style={{ ['--i' as string]: i, ['--y' as string]: [12, 4, 0, 4, 12][i], animationDelay: `${i * 70}ms` }}>
                  <div className="pose">
                    <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} texte={c.texte} />
                  </div>
                </div>
              ))}
            </div>
            <div className="une-bulle">
              <Dialogue qui="Greed Island">Bienvenue, Hunter. Réunis toutes les cartes de ton Book.</Dialogue>
            </div>
          </div>
        </section>

        {/* ---------- Le jeu, en trois cases ---------- */}
        <section id="jeu" className="jeu" aria-labelledby="jeu-titre">
          <h2 id="jeu-titre" className="titre-section">
            Une partie, en trois temps
          </h2>
          <div className="jeu-grille">
            <article className="case jeu-ile">
              <IleDemo />
              <div className="legende">
                <h3>On cache des balises sur le terrain.</h3>
                <p>
                  L’organisation pose de petites affiches à QR code dans tout le lieu. Le terrain devient une île : des villes pour acheter et miser, des zones de chasse, et des
                  balises qui s’allument et s’éteignent au fil de la partie.
                </p>
              </div>
            </article>
            <article className="case jeu-book">
              <div className="book" aria-hidden="true">
                {BOOK.map(({ n, pleine }) => {
                  const c = carte(n);
                  return pleine ? (
                    <div key={n} className="pochette pleine">
                      <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} />
                    </div>
                  ) : (
                    <div key={n} className="pochette vide gi-trame">
                      <span>{String(n).padStart(3, '0')}</span>
                    </div>
                  );
                })}
              </div>
              <div className="legende">
                <h3>Chaque scan donne des cartes.</h3>
                <p>Les joueurs scannent les balises avec leur téléphone et rangent leurs cartes dans leur Book. Du rang D au rang SS : plus une carte est rare, plus elle est disputée.</p>
              </div>
            </article>
            <article className="case jeu-clear">
              <Concentration graine={41} className="clear-lignes" />
              <p className="tampon" aria-hidden="true">
                Clear
              </p>
              <div className="legende">
                <h3>Le premier qui réunit tout gagne.</h3>
                <p>Il réalise le Clear. Si personne n’y arrive avant la fin du temps (2 heures par défaut), un classement désigne les gagnants.</p>
              </div>
            </article>
          </div>

          <div className="case coups">
            <div className="coups-cartes" aria-hidden="true">
              {SORTS.map((s) => (
                <div key={s.numero} className="coup">
                  <Carte genre="sort" numero={s.numero} nom={s.nom} />
                </div>
              ))}
            </div>
            <div className="coups-texte">
              <h3>Chacun pour soi, personne seul.</h3>
              <p>
                On échange des cartes, on en achète aux enchères, on en vole avec un sort, on refile une contrefaçon, on défie l’arène. Un Game Master lance des évènements en
                direct, et un écran géant raconte la partie au public.
              </p>
              <p className="lots">Certaines cartes sont liées à de vrais lots offerts par l’organisateur.</p>
            </div>
          </div>
        </section>

        {/* ---------- Contact ---------- */}
        <section id="contact" className="case contact" aria-labelledby="contact-titre">
          <Concentration graine={88} className="contact-lignes" />
          <div className="contact-corps">
            <h2 id="contact-titre">Une partie de Greed Island chez vous ?</h2>
            <p>Parc, festival, campus, salon : parlons de votre lieu et de votre public.</p>
            <a className="btn btn-clair" href={WHATSAPP} target="_blank" rel="noopener">
              <IconeWhatsapp /> Écrire sur WhatsApp
            </a>
            <div className="contact-tel">
              <span className="contact-nom">{CONTACT_NOM}</span>
              {TELEPHONES.map((t) => (
                <a key={t.lien} href={t.lien} className="tel">
                  {t.affiche}
                  {t.whatsapp && <small> · WhatsApp</small>}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Accès aux apps ---------- */}
        <section className="acces" aria-labelledby="acces-titre">
          <h2 id="acces-titre" className="titre-section">
            Déjà dans une partie ?
          </h2>
          <ul className="acces-liste">
            <li className="acces-ligne">
              <a className="acces-lien" href={APP_JOUEUR}>
                <span className="acces-nom">Jouer</span>
                <span className="acces-dit">L’app des joueurs : ton Book, ta licence, le scanner.</span>
                <Fleche />
              </a>
            </li>
            <li className="acces-ligne">
              <a className="acces-lien" href={CONSOLE}>
                <span className="acces-nom">Console de l’équipe</span>
                <span className="acces-dit">Pour le Game Master et les arbitres, avec leur code.</span>
                <Fleche />
              </a>
            </li>
            <EcranGeant />
          </ul>
        </section>

        <footer className="pied">
          <span>Greed Island</span>
          <span>D’après Hunter × Hunter, de Yoshihiro Togashi.</span>
        </footer>
      </main>
    </>
  );
}
