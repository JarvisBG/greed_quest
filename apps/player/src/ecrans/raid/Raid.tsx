// Page ⑯ (prototype validé le 2026-10-13 : docs/prototype/raid.html) : le Raid de la Brigade (RG-12).
// Une case sombre d'acier et d'alarme rouge : le boss fait face au joueur, sa barre de vie en grand (crans de 10 PV,
// la perte reste blanche un instant). Bonne réponse : une entaille de lumière, étincelles, secousse, « −1 ». Mauvaise :
// le boss ricane, la question se ferme (la bonne réponse n'est pas montrée). Les coups des autres tombent en direct.
import { Concentration } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { bossDe, coupsDe, enCombat, mmss, questionSuivante, tempsRestant, texteCoups, texteEquipe, accord, type VueRaid } from '../../lib/raid';
import type { Question } from '../../lib/quiz';
import type { CoupAutre } from '../../lib/useRaid';
import { useSeconde } from '../arene/Arene';
import { IconeRetour } from '../Icones';
import { FiltreEncre } from '../masadora/Paquet';
import { creerEffets, type Effets } from '../scan/effets';
import { VisuelBoss } from './Boss';

const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LETTRES = 'ABCDE';

interface Props {
  vue: VueRaid | null;
  questions: Question[];
  coupAutre: CoupAutre | null;
  repondre: (questionId: string, choix: number) => Promise<{ correcte: boolean } | { refus: string }>;
  charger: () => void;
  onRetour: () => void;
}

export function Raid({ vue, questions, coupAutre, repondre, charger, onRetour }: Props) {
  useSeconde();
  useEffect(() => {
    charger();
  }, []);
  const boss = bossDe(vue?.bossId);
  const scene = useRef<HTMLDivElement>(null);
  const bossEl = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const fx = useRef<Effets | null>(null);
  const [verdict, setVerdict] = useState<{ q: Question; choix: number; juste: boolean } | null>(null);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [replique, setReplique] = useState<string | null>(null);
  const finRire = useRef(0);

  useEffect(() => {
    const e = creerEffets(toile.current!, () => new DOMRect(-999, -999, 0, 0));
    fx.current = e;
    return () => {
      e.arreter();
      clearTimeout(finRire.current);
    };
  }, []);

  /** Un trait de lumière en travers du boss, tracé vite puis qui s'éteint. */
  const entaille = (x: number, y: number, long: number, angle: number, epais: number) => {
    const s = scene.current;
    if (!s) return;
    const sb = s.getBoundingClientRect();
    const t = document.createElement('i');
    t.className = 'rd-entaille';
    Object.assign(t.style, { left: `${x - sb.left - long / 2}px`, top: `${y - sb.top}px`, width: `${long}px`, rotate: `${angle}rad`, scale: `1 ${epais}` });
    s.append(t);
    t.animate([{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }, { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.3 }, { clipPath: 'inset(0 0 0 0)', opacity: 0 }], { duration: 520, fill: 'forwards' }).finished.finally(() => t.remove());
  };

  const pointSurBoss = (): [number, number, DOMRect] | null => {
    const b = bossEl.current?.getBoundingClientRect();
    if (!b) return null;
    return [b.left + b.width * (0.3 + Math.random() * 0.4), b.top + b.height * (0.25 + Math.random() * 0.4), b];
  };

  /** Mon coup : entaille, étincelles, secousse, « −1 ». */
  const frapper = () => {
    const p = pointSurBoss();
    if (!p || !scene.current) return;
    const [x, y, b] = p;
    vibrer(60);
    if (calme()) return;
    entaille(x, y, b.width * 0.9, -0.7 + Math.random() * 0.3 - (Math.random() < 0.5 ? 0 : 1.6), 1);
    fx.current?.etincelles(x, y, 40, '#ff5a4a', 0.7);
    fx.current?.etincelles(x, y, 18, '#ffffff', 0.6);
    fx.current?.onde(x, y, '#ffb08a', 0.5);
    bossEl.current?.animate([{ translate: '0 0', filter: 'brightness(2.4)' }, { translate: '-9px 3px' }, { translate: '7px -2px' }, { translate: '-3px 1px' }, { translate: '0 0', filter: 'none' }], { duration: 300 });
    ring.current?.animate([{ translate: '0 0' }, { translate: '-4px 2px' }, { translate: '3px -2px' }, { translate: '0 0' }], { duration: 220 });
    const m = document.createElement('span');
    m.className = 'rd-moins-un';
    m.textContent = '−1';
    scene.current.append(m);
    m.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 0) scale(2)' },
        { opacity: 1, transform: 'translate(-50%, -10px) scale(1)', offset: 0.2 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%, -40px) scale(1)' },
      ],
      { duration: 1000, easing: 'ease-out', fill: 'forwards' },
    ).finished.finally(() => m.remove());
  };

  // Coup d'un autre joueur : petit éclat et son nom.
  useEffect(() => {
    if (!coupAutre || calme()) return;
    const p = pointSurBoss();
    const s = scene.current;
    if (!p || !s) return;
    const [x, y, b] = p;
    entaille(x, y, b.width * 0.32, Math.random() * Math.PI, 0.45);
    fx.current?.etincelles(x, y, 10, '#ffb08a', 0.35);
    const sb = s.getBoundingClientRect();
    const t = document.createElement('span');
    t.className = 'rd-coup-autre';
    t.textContent = `${coupAutre.pseudo} `;
    const moins = document.createElement('b');
    moins.textContent = '−1';
    t.append(moins);
    t.style.left = `${Math.max(0, Math.min(sb.width - 110, x - sb.left - 40))}px`;
    t.style.top = `${y - sb.top}px`;
    s.append(t);
    t.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0', offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0, translate: '0 -18px' }], { duration: 1300, fill: 'forwards' }).finished.finally(() => t.remove());
    bossEl.current?.animate([{ translate: '0 0' }, { translate: '-3px 0' }, { translate: '2px 0' }, { translate: '0 0' }], { duration: 160 });
  }, [coupAutre?.n]);

  const ricaner = () => {
    setReplique(boss.ricane[Math.floor(Math.random() * boss.ricane.length)] ?? 'Hé hé hé !');
    vibrer([20, 40, 20]);
    clearTimeout(finRire.current);
    finRire.current = window.setTimeout(() => setReplique(null), 1400);
  };

  const choisir = async (q: Question, choix: number) => {
    if (attente || verdict) return;
    setAttente(true);
    setErreur(null);
    const r = await repondre(q.id, choix);
    setAttente(false);
    if ('refus' in r) {
      setErreur(r.refus);
      return;
    }
    setVerdict({ q, choix, juste: r.correcte });
    if (r.correcte) frapper();
    else ricaner();
    setTimeout(() => setVerdict(null), r.correcte ? 900 : 1500);
  };

  const maintenant = Date.now();
  const reste = vue ? tempsRestant(vue, maintenant) : 0;
  const combat = enCombat(vue, maintenant);
  const pc = vue && vue.pvMax > 0 ? (vue.pv / vue.pvMax) * 100 : 0;
  const coups = vue ? coupsDe(vue.reponses) : 0;
  const vaincu = !!vue && vue.pv <= 0;
  const q = verdict?.q ?? (vue ? questionSuivante(questions, vue.reponses) : null);
  const index = q ? questions.findIndex((x) => x.id === q.id) : -1;

  return (
    <div className="planche rd-page">
      <FiltreEncre />
      <div className="mas-tete">
        <button className="mas-retour" onClick={onRetour}>
          <IconeRetour />
          Accueil
        </button>
      </div>

      <section ref={ring} className="rd-ring" aria-labelledby="rd-titre">
        <div className="rd-lignes" aria-hidden="true">
          <Concentration graine={17} />
        </div>
        <div className="tete-raid">
          <h2 id="rd-titre">{boss.titre}</h2>
          {vue && (
            <div className={`temps${combat && reste <= 60_000 ? ' urgent' : ''}`}>
              <span>Il reste</span>
              <b>{mmss(reste)}</b>
            </div>
          )}
        </div>
        <div ref={scene} className="scene-boss">
          <div ref={bossEl} className={`rd-boss ${boss.rendu}${replique ? ' rit' : ''}${vaincu ? ' ko' : ''}`} aria-hidden="true">
            <VisuelBoss boss={boss} />
          </div>
          <div className={`rd-bulle${replique ? ' visible' : ''}`} aria-hidden="true">
            {replique}
          </div>
        </div>
        {vue && (
          <div className="vie-raid">
            <div
              className={`jauge${vue.pv > 0 && pc <= 25 ? ' bas' : ''}`}
              role="progressbar"
              aria-label="Points de vie du boss"
              aria-valuemin={0}
              aria-valuemax={vue.pvMax}
              aria-valuenow={vue.pv}
              style={{ '--cran': `${(10 / Math.max(1, vue.pvMax)) * 100}%` } as React.CSSProperties}
            >
              <i className="perte" style={{ width: `${pc}%` }} />
              <i className="reste" style={{ width: `${pc}%` }} />
              <span className="crans" />
            </div>
            <div className="chiffres">
              <b>{vue.pv}</b>/ {vue.pvMax} PV<span className="equipe">{texteEquipe(vue.frappeurs)}</span>
            </div>
          </div>
        )}
      </section>

      <section className={`rd-question${!combat || !q ? ' fini' : ''}`} aria-live="polite">
        {!vue ? (
          <>
            <h3>Pas de raid en cours</h3>
            <p className="verdict">Le Game Master lance les raids : une alarme te préviendra, où que tu sois dans l’app.</p>
          </>
        ) : vaincu ? (
          coups ? (
            <>
              <h3>
                {boss.sujet} est {accord(boss, 'tombé')} !
              </h3>
              <b className="gros-chiffre">{coups}</b>
              <p className="verdict">{texteCoups(coups)} par toi. Ton paquet de 3 sorts est dans tes Sorts.</p>
            </>
          ) : (
            <>
              <h3>
                {boss.sujet} est {accord(boss, 'tombé')}.
              </h3>
              <p className="verdict">Tu n’as pas porté de coup : pas de paquet cette fois.</p>
            </>
          )
        ) : !combat ? (
          <>
            <h3>
              {boss.sujet} s’est {accord(boss, 'enfui')}
            </h3>
            <p className="verdict">Le temps est écoulé avec {vue.pv} PV restants. Pas de récompense cette fois.</p>
          </>
        ) : !q ? (
          questions.length > 0 ? (
            <>
              <h3>Tu as répondu aux {questions.length} questions</h3>
              <b className="gros-chiffre">{coups}</b>
              <p className="verdict">
                {texteCoups(coups)}. Les autres joueurs peuvent encore l’achever : il lui reste {vue.pv} PV.
              </p>
            </>
          ) : (
            <p className="verdict">Chargement des questions…</p>
          )
        ) : (
          <>
            <div className="q-tete">
              <span>
                Question {index + 1} sur {questions.length}
              </span>
              <span className="mes-coups">
                Tes coups : <b>{coups}</b>
              </span>
            </div>
            <h3>{q.texte}</h3>
            <div className="choix-raid">
              {q.choix.map((c, i) => (
                <button
                  key={i}
                  data-lettre={LETTRES[i]}
                  disabled={attente || !!verdict}
                  className={verdict?.choix === i ? (verdict.juste ? 'juste' : 'faux') : undefined}
                  onClick={() => void choisir(q, i)}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className={`verdict${verdict?.juste ? ' touche' : ''}`}>{verdict ? (verdict.juste ? 'Touché !' : 'Raté ! La question est fermée.') : ' '}</p>
          </>
        )}
        {erreur && <p className="erreur">{erreur}</p>}
      </section>

      <p className="rd-regle">Chaque bonne réponse retire 1 PV au boss. Une seule réponse par question. Si le boss tombe avant la fin, chaque joueur qui a porté au moins un coup reçoit un paquet de 3 sorts.</p>
      <canvas ref={toile} className="rd-toile" aria-hidden="true" />
    </div>
  );
}

/** Bandeau du raid sous la barre, sur toutes les autres pages : PV, temps restant ; le toucher ramène au combat. */
export function BandeauRaid({ vue, onOuvrir }: { vue: VueRaid | null; onOuvrir: () => void }) {
  useSeconde();
  if (!vue || !enCombat(vue, Date.now())) return null;
  const boss = bossDe(vue.bossId);
  return (
    <button className="rd-bandeau" onClick={onOuvrir}>
      <i className="oeil" aria-hidden="true" />
      <span>
        {boss.bandeau} · {vue.pv} PV
      </span>
      <b>{mmss(tempsRestant(vue, Date.now()))}</b>
      <span className="mini" aria-hidden="true">
        <i style={{ width: `${(vue.pv / Math.max(1, vue.pvMax)) * 100}%` }} />
      </span>
    </button>
  );
}
