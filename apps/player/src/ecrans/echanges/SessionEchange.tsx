// Page ⑫ (prototype validé le 2026-10-12 : docs/prototype/echanges.html) : une session d'échange, par-dessus l'app.
// RG-11.1 amendé : l'invité reçoit la proposition comme un appel (60 s) ; celui qui propose attend la réponse ;
// puis la table : chacun compose sa part en voyant celle de l'autre, valide par un appui long (sceau « VALIDÉ ») ;
// toute modification fait sauter les deux sceaux. Le serveur fait foi (P1) : chaque geste est une requête.
import { Carte, Concentration, EmblemeDos } from '@gq/ui';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api } from '../../lib/client';
import { REPONSE_S, SANS_ACTION_S, etatPart, jete, mesPieces, nbPieces, nomEnPhrase, notePrix, partVide, resumePart, vueDePiece, type MaPiece, type Piece, type VueEchange } from '../../lib/echanges';
import { useLivre } from '../../lib/useLivre';
import { minSec } from '../sorts/FicheSort';

const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Secondes restantes d'un délai parti à `depuis` (heure locale). */
function useReste(total: number, depuis: number | undefined, actif: boolean) {
  const [, tic] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const t = setInterval(() => tic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [actif]);
  return Math.max(0, total - Math.floor((Date.now() - (depuis ?? Date.now())) / 1000));
}

function Anneau({ reste, total, tete, className }: { reste: number; total: number; tete: string; className?: string }) {
  return (
    <div className={`ech-anneau${className ? ` ${className}` : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="fond" cx="50" cy="50" r="46" />
        <circle className="reste" cx="50" cy="50" r="46" pathLength={100} strokeDasharray={`${(reste / total) * 100} 100`} />
      </svg>
      <span className="tete">{tete.slice(0, 1).toUpperCase()}</span>
    </div>
  );
}

/** Pile de pièces d'or. */
export function Pieces({ jenny }: { jenny: number }) {
  return (
    <span className="ech-pieces" aria-hidden="true">
      {Array.from({ length: nbPieces(jenny) }, (_, i) => (
        <i key={i} style={{ bottom: `${i * 5}px` }} />
      ))}
    </span>
  );
}

/** Sceau rouge « VALIDÉ » : encre au bord mangé (filtre `#ech-encre`, posé une fois par la table). */
function Sceau() {
  return (
    <svg viewBox="-60 -60 120 120" aria-hidden="true">
      <g filter="url(#ech-encre)" fill="none" stroke="#e0463c">
        <circle r="53" strokeWidth="6" />
        <circle r="44" strokeWidth="1.6" />
        <path d="M-30 -14h60M-30 22h60" strokeWidth="1.6" />
        <text y="10" textAnchor="middle" fill="#e0463c" stroke="none" style={{ font: "400 17px 'Dela Gothic One', 'Arial Black', sans-serif", letterSpacing: '.5px' }}>
          VALIDÉ
        </text>
        <path d="m0 -36 2.4 6 6 .4-4.7 3.8 1.6 5.8L0 -23.2l-5.1 3.2 1.6-5.8-4.7-3.8 6-.4z" fill="#e0463c" stroke="none" />
        <path d="m0 28 2 5 5 .3-3.9 3.1 1.3 4.8L0 38.6l-4.4 2.6 1.3-4.8L-7 33.3l5-.3z" fill="#e0463c" stroke="none" />
      </g>
    </svg>
  );
}

/** Le sceau se frappe quand la validation arrive, saute quand elle tombe. */
function useSceau(valide: boolean) {
  const [classe, setClasse] = useState(valide ? 'pose' : '');
  const avant = useRef(valide);
  useEffect(() => {
    if (avant.current === valide) return;
    avant.current = valide;
    setClasse(valide ? 'pose' : 'tombe');
  }, [valide]);
  return classe;
}

interface Props {
  partieId: string;
  jenny: number;
  version: number;
  echange: VueEchange | null;
  /** Échange tout juste conclu : la table reste un instant, sceaux posés, avant « TRADE ! ». */
  conclu: VueEchange | null;
  /** La cinématique a couvert l'écran : la table peut partir. */
  tableCachee: boolean;
  recevoir: (e: VueEchange) => void;
  finParMoi: () => void;
  onScelle: () => void;
}

export function SessionEchange(p: Props) {
  const e = p.echange ?? p.conclu;
  if (!e) return null;
  if (e.etat === 'invitation' && e.invite) return <Appel key={e.id} {...p} e={e} />;
  if (e.etat === 'invitation') return <Attente key={e.id} {...p} e={e} />;
  if (e.etat === 'conclu' && p.tableCachee) return null;
  if (e.etat === 'composition' || e.etat === 'conclu') return <Table key={e.id} {...p} e={e} />;
  return null;
}

type Sous = Props & { e: VueEchange };

/** Action sur la session : la réponse contient la session à jour. */
function useAgir({ partieId, e, recevoir }: Sous) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const agir = async (url: string, corps: Record<string, unknown> = {}) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ echange: VueEchange }>(`/parties/${partieId}/echanges/${e.id}/${url}`, corps);
      recevoir(r.echange);
      return true;
    } catch (x) {
      setErreur(message(x));
      return false;
    } finally {
      setEnvoi(false);
    }
  };
  return { agir, envoi, erreur, setErreur };
}

/** Celui qui propose attend la réponse (60 s). */
function Attente(p: Sous) {
  const { e } = p;
  const { agir, envoi, erreur } = useAgir(p);
  const reste = useReste(REPONSE_S, e.recuA, true);
  const carte = e.vente ? e.maPart.cartes[0] : undefined;
  return (
    <div className="ech-attente" role="dialog" aria-modal="true" aria-labelledby="ech-att-texte">
      <div className="boite">
        <Anneau reste={reste} total={REPONSE_S} tete={e.avec.pseudo} />
        <p id="ech-att-texte">{e.vente ? `${e.avec.pseudo} lit ton offre : ${carte ? nomEnPhrase(carte) : 'ta carte'} pour ${e.vente.prix} J` : `Proposition envoyée à ${e.avec.pseudo}`}</p>
        <small>
          <span className="secs">{reste}</span> s pour répondre
        </small>
        {erreur && <p className="erreur">{erreur}</p>}
        <button
          className="ech-btn-ligne"
          disabled={envoi}
          onClick={() => {
            p.finParMoi();
            void agir('annuler');
          }}
        >
          Annuler la proposition
        </button>
      </div>
    </div>
  );
}

/** L'invité : la proposition prend l'écran comme un appel entrant. */
function Appel(p: Sous) {
  const { e } = p;
  const { agir, envoi, erreur } = useAgir(p);
  const reste = useReste(REPONSE_S, e.recuA, true);
  const accepter = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    accepter.current?.focus({ preventScroll: true });
    vibrer([300, 150, 300, 150, 300]);
    return () => void vibrer(0);
  }, []);
  const carte = e.vente ? e.sonPart.cartes[0] : undefined;
  return (
    <div className="ech-appel" role="alertdialog" aria-modal="true" aria-labelledby="ech-ap-cri" aria-describedby="ech-ap-phrase">
      <Concentration graine={23} className="ech-appel-lignes" />
      <div className="haut">
        <div className="cri" id="ech-ap-cri">
          {e.vente ? 'VENTE !' : 'ÉCHANGE !'}
        </div>
        <Anneau reste={reste} total={REPONSE_S} tete={e.avec.pseudo} className="sonne" />
        <span className="nom">{e.avec.pseudo}</span>
        {carte && (
          <div className="vendue">
            <Carte {...vueDePiece(carte)} />
          </div>
        )}
        <p className="phrase" id="ech-ap-phrase">
          {e.vente ? (
            <>
              {e.avec.pseudo} te vend {carte ? nomEnPhrase(carte) : 'une carte'} pour <b>{e.vente.prix} J</b>.
            </>
          ) : (
            `${e.avec.pseudo} te propose un échange.`
          )}
        </p>
        <span className="secs">{reste} s</span>
        {erreur && <p className="erreur-nuit">{erreur}</p>}
      </div>
      <div className="bas">
        <button
          className="refuser"
          disabled={envoi}
          onClick={() => {
            vibrer(0);
            p.finParMoi();
            void agir('reponse', { accepte: false });
          }}
        >
          Refuser
        </button>
        <button
          ref={accepter}
          className="accepter"
          disabled={envoi}
          onClick={() => {
            vibrer(0);
            void agir('reponse', { accepte: true });
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}

const MONTANTS = [-10, 10, 50, 100];

/** La table : un tapis de jeu dans la nuit, habillé comme le dos des cartes. */
function Table(p: Sous) {
  const { e, jenny } = p;
  const conclu = e.etat === 'conclu';
  const { agir, envoi, erreur, setErreur } = useAgir(p);
  const { livre } = useLivre(p.partieId, p.version);
  const [tiroir, setTiroir] = useState(false);
  const [fiche, setFiche] = useState<Piece | null>(null);
  const reste = useReste(SANS_ACTION_S, e.recuA, !conclu);
  const vente = e.vente ?? null;
  const jeVends = !!vente?.jeVends;
  // Jenny : les touches s'additionnent sur place et partent ensemble, une fois le doigt posé (0,4 s).
  const [brouillon, setBrouillon] = useState<number | null>(null);
  const envoiJenny = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const maJenny = brouillon ?? e.maPart.jenny;
  const maPart = { ...e.maPart, jenny: maJenny };
  const offrir = (itemIds: string[], j: number) => agir('offre', { itemIds, jenny: j });
  const changerJenny = (d: number) => {
    const n = Math.max(0, Math.min(jenny, maJenny + d));
    setBrouillon(n);
    clearTimeout(envoiJenny.current);
    envoiJenny.current = setTimeout(() => {
      void offrir(
        e.maPart.cartes.map((c) => c.itemId),
        n,
      ).then(() => setBrouillon(null));
    }, 400);
  };
  useEffect(() => () => clearTimeout(envoiJenny.current), []);

  const sceauMoi = useSceau(e.jeValide || conclu);
  const sceauLui = useSceau(e.ilValide || conclu);
  // La part encaisse le coup de tampon.
  const partMoi = useRef<HTMLElement>(null);
  const partLui = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!e.jeValide) return;
    vibrer(45);
    partMoi.current?.animate([{ translate: '0 0' }, { translate: '0 3px' }, { translate: '0 0' }], { duration: 160, delay: 150 });
  }, [e.jeValide]);
  useEffect(() => {
    if (!e.ilValide) return;
    vibrer(25);
    partLui.current?.animate([{ translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 0' }], { duration: 160, delay: 150 });
  }, [e.ilValide]);
  // Les deux sceaux posés : les filets s'allument, l'étoile tourne, puis « TRADE ! ».
  useEffect(() => {
    if (!conclu) return;
    vibrer([20, 60, 40]);
    const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(p.onScelle, calme ? 300 : 1000);
    return () => clearTimeout(t);
  }, [conclu]);

  // Échap : ferme la fiche, puis le tiroir.
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (fiche) setFiche(null);
      else if (tiroir) setTiroir(false);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [fiche, tiroir]);

  const peutAjouter = !vente && !conclu;
  const vide = (x: typeof e.maPart) => partVide(x);
  let indice = '';
  if (conclu) indice = 'Échange scellé';
  else if (erreur) indice = erreur;
  else if (e.jeValide) indice = e.ilValide ? '' : `En attente de ${e.avec.pseudo}. Toute modification retire les deux sceaux.`;
  else if (vide(maPart)) indice = vente && !jeVends && jenny < vente.prix ? `Tu n’as que ${jenny} J : propose un autre prix.` : 'Pose une carte ou des jenny : chacun doit donner quelque chose.';
  else if (vide(e.sonPart)) indice = `${e.avec.pseudo} n’a encore rien posé.`;
  else if (e.ilValide) indice = `${e.avec.pseudo} a validé. À toi.`;
  const peutValider = !conclu && !e.jeValide && !vide(maPart) && !vide(e.sonPart) && brouillon === null && !envoi;
  const note = notePrix({ vente, maPart });

  return (
    <div className="ech-table" role="dialog" aria-modal="true" aria-labelledby="ech-t-titre">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="ech-encre" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale={3.2} result="bord" />
            <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves={2} seed={11} result="taches" />
            <feColorMatrix in="taches" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.3 2.2" result="masque" />
            <feComposite in="bord" in2="masque" operator="in" />
          </filter>
        </defs>
      </svg>
      <div className="t-barre">
        <div className="titre">
          <h1 id="ech-t-titre">Avec {e.avec.pseudo}</h1>
          <span className={`mode${vente ? ' vente' : ''}`}>{vente ? `Vente · ${vente.prix} J demandés` : 'Échange'}</span>
        </div>
        <span className="reste">
          sans action<b>{minSec(reste * 1000)}</b>
        </span>
        <button
          className="annuler"
          disabled={envoi || conclu}
          onClick={() => {
            p.finParMoi();
            void agir('annuler');
          }}
        >
          Annuler
        </button>
      </div>
      <div className={`plateau${conclu ? ' scelle' : ''}`}>
        <section className="part chez-lui" ref={partLui} aria-label={`Part de ${e.avec.pseudo}`}>
          <div className="etiquette">
            <b>{e.avec.pseudo} donne</b>
            <span className="resume">{resumePart(e.sonPart)}</span>
          </div>
          <Posees cartes={e.sonPart.cartes} cote="lui" vide={`${e.avec.pseudo} compose sa part`} onToucher={setFiche} />
          {(e.sonPart.jenny > 0 || jeVends) && (
            <div className="pile">
              <Pieces jenny={e.sonPart.jenny} />
              <span className="montant">
                {jeVends && !e.sonPart.jenny ? '…' : e.sonPart.jenny}
                <small>J</small>
              </span>
            </div>
          )}
          <span className={`sceau ${sceauLui}`} aria-hidden="true">
            <Sceau />
          </span>
        </section>
        <div className="couture" aria-live="polite">
          <span className={`etat${e.ilValide || conclu ? ' ok' : ''}`}>
            <span className="qui">{e.avec.pseudo}</span>
            <small>{etatPart(e.sonPart, e.ilValide || conclu)}</small>
          </span>
          <span className="embleme" aria-hidden="true">
            <EmblemeDos />
          </span>
          <span className={`etat droite${e.jeValide || conclu ? ' ok' : ''}`}>
            <span className="qui">Toi</span>
            <small>{etatPart(maPart, e.jeValide || conclu)}</small>
          </span>
        </div>
        <section className="part chez-moi" ref={partMoi} aria-label="Ta part">
          <div className="etiquette">
            <b>Tu donnes</b>
            <span className="resume">{resumePart(maPart)}</span>
          </div>
          <Posees
            cartes={e.maPart.cartes}
            cote="moi"
            ajouter={peutAjouter ? () => setTiroir(true) : undefined}
            retirer={
              peutAjouter
                ? (c) =>
                    void offrir(
                      e.maPart.cartes.filter((x) => x.itemId !== c.itemId).map((x) => x.itemId),
                      maJenny,
                    )
                : undefined
            }
          />
          <div className="pile">
            <Pieces jenny={maJenny} />
            <span className="montant">
              {maJenny}
              <small>J</small>
            </span>
            {!jeVends && !conclu && (
              <span className="montants">
                {MONTANTS.map((d) => (
                  <button key={d} disabled={d < 0 ? maJenny <= 0 : maJenny + d > jenny} onClick={() => changerJenny(d)} aria-label={`${d > 0 ? 'ajouter' : 'retirer'} ${Math.abs(d)} jenny`}>
                    {d > 0 ? '+' : '−'}
                    {Math.abs(d)}
                  </button>
                ))}
              </span>
            )}
            {note && <span className="note">{note}</span>}
          </div>
          <span className={`sceau ${sceauMoi}`} aria-hidden="true">
            <Sceau />
          </span>
        </section>
      </div>
      <div className="t-bas">
        <Maintenir
          desactive={!peutValider}
          fait={e.jeValide || conclu}
          partie={() => [partMoi.current]}
          onRelache={() => setErreur('Garde le doigt appuyé jusqu’au bout.')}
          onValide={() => void agir('valider')}
        />
        <p className="indice" aria-live="polite">
          {indice}
        </p>
      </div>
      {tiroir && livre && (
        <Tiroir
          titre="Tes cartes"
          pieces={mesPieces(livre, e.maPart)}
          choisies={e.maPart.cartes.map((c) => c.itemId)}
          onFermer={() => setTiroir(false)}
          onPoser={(ids) => {
            setTiroir(false);
            const avant = e.maPart.cartes.map((c) => c.itemId);
            if (ids.length !== avant.length || ids.some((x) => !avant.includes(x))) void offrir(ids, maJenny);
          }}
        />
      )}
      {fiche && (
        <div className="ech-fiche" onClick={() => setFiche(null)}>
          <div className="f-boite">
            <Carte {...vueDePiece(fiche)} />
            <p>Touche pour fermer</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cartes jetées sur le tapis ; quand la main déborde, elles se chevauchent en éventail. */
function Posees({ cartes, cote, vide, ajouter, retirer, onToucher }: { cartes: Piece[]; cote: 'lui' | 'moi'; vide?: string; ajouter?: (() => void) | undefined; retirer?: ((c: Piece) => void) | undefined; onToucher?: (c: Piece) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [chevauche, setChevauche] = useState<number | null>(null);
  const deja = useRef(new Set(cartes.map((c) => c.itemId)));
  const nouvelles = cartes.filter((c) => !deja.current.has(c.itemId)).map((c) => c.itemId);
  useEffect(() => {
    for (const c of cartes) deja.current.add(c.itemId);
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const n = el.children.length;
    const w = el.clientWidth;
    const larg = (el.lastElementChild as HTMLElement | null)?.offsetWidth || 64;
    setChevauche(n > 1 && n * larg + (n - 1) * 10 > w ? Math.min(0, (w - n * larg) / (n - 1)) - 2 : null);
  }, [cartes.length, !!ajouter]);
  if (!cartes.length && !ajouter) return <span className="vide-lui">{vide}</span>;
  return (
    <div ref={ref} className={`posees${chevauche !== null ? ' serre' : ''}`} style={chevauche !== null ? ({ '--chevauche': `${chevauche}px` } as CSSProperties) : undefined}>
      {ajouter && (
        <button className="ajouter" onClick={ajouter}>
          <span>+</span>Carte
        </button>
      )}
      {cartes.map((c) => {
        const { r, y } = jete(c.itemId);
        const vue = vueDePiece(c);
        return (
          <button
            key={c.itemId}
            className={`posee${nouvelles.includes(c.itemId) ? ' arrive' : ''}`}
            style={{ '--r': `${r}deg`, '--y': `${y}px` } as CSSProperties}
            aria-label={`${vue.nom}${retirer ? ', toucher pour retirer' : ''}`}
            onClick={() => (retirer ? retirer(c) : onToucher?.(c))}
          >
            <Carte {...vue} />
            {retirer && (
              <span className="retirer" aria-hidden="true">
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Appui long : 0,7 s pour poser le sceau ; relâcher avant annule. Pendant l'appui, l'aura monte sur ta part. */
function Maintenir({ desactive, fait, partie, onValide, onRelache }: { desactive: boolean; fait: boolean; partie: () => (HTMLElement | null)[]; onValide: () => void; onRelache: () => void }) {
  const remplit = useRef<HTMLElement>(null);
  const a = useRef<Animation | null>(null);
  const auras = useRef<Animation[]>([]);
  const calme = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const duree = calme ? 300 : 700;
  const LUEUR = 'drop-shadow(0 0 14px rgba(255,216,119,.95))';
  const ETEINT = 'drop-shadow(0 0 0 rgba(255,216,119,0))';
  const aura = (monte: boolean) => {
    auras.current.forEach((x) => x.cancel());
    auras.current = monte ? partie().flatMap((el) => (el ? [el.animate([{ filter: ETEINT }, { filter: LUEUR }], { duration: duree, easing: 'ease-in', fill: 'forwards' })] : [])) : [];
  };
  const debut = () => {
    if (desactive || a.current || !remplit.current) return;
    vibrer(10);
    const x = remplit.current.animate([{ scale: '0 1' }, { scale: '1 1' }], { duration: duree, easing: 'linear', fill: 'forwards' });
    a.current = x;
    aura(true);
    x.onfinish = () => {
      a.current = null;
      x.cancel();
      partie().forEach((el) => el?.animate([{ filter: LUEUR }, { filter: ETEINT }], { duration: 600 }));
      aura(false);
      onValide();
    };
  };
  const fin = () => {
    const x = a.current;
    if (!x) return;
    a.current = null;
    x.onfinish = () => x.cancel();
    x.reverse();
    aura(false);
    onRelache();
  };
  return (
    <button
      className={`ech-maintenir${fait ? ' fait' : ''}`}
      disabled={desactive}
      onPointerDown={(ev) => {
        ev.preventDefault();
        debut();
      }}
      onPointerUp={fin}
      onPointerLeave={fin}
      onPointerCancel={fin}
      onContextMenu={(ev) => ev.preventDefault()}
      onKeyDown={(ev) => {
        if ((ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) {
          ev.preventDefault();
          debut();
        }
      }}
      onKeyUp={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') fin();
      }}
    >
      <i className="remplit" ref={remplit} />
      <span>{fait ? 'Validé' : 'Maintiens pour valider'}</span>
    </button>
  );
}

/**
 * Tiroir de mes cartes et objets. Table : plusieurs choix (30 au plus) ; vente : une seule carte et un prix.
 */
export function Tiroir({
  titre,
  pieces,
  choisies,
  vente,
  onFermer,
  onPoser,
}: {
  titre: string;
  pieces: MaPiece[];
  choisies: string[];
  vente?: { pour: string; onProposer: (itemId: string, prix: number) => void; envoi: boolean };
  onFermer: () => void;
  onPoser?: (ids: string[]) => void;
}) {
  const [choix, setChoix] = useState(() => new Set(choisies));
  const [prix, setPrix] = useState(50);
  const cartes = pieces.filter((x) => !x.objet);
  const objets = pieces.filter((x) => x.objet);
  const basculer = (id: string) => {
    if (vente) return setChoix(new Set([id]));
    const n = new Set(choix);
    if (n.has(id)) n.delete(id);
    else if (n.size < 30) n.add(id);
    setChoix(n);
  };
  const groupe = (nom: string, liste: MaPiece[]) =>
    liste.length > 0 && (
      <>
        <h3>{nom}</h3>
        <div className="grille">
          {liste.map((x) => (
            <button key={x.itemId} className="choix" aria-pressed={choix.has(x.itemId)} onClick={() => basculer(x.itemId)}>
              <Carte {...x.vue} />
              <span className="ou">{x.ou}</span>
            </button>
          ))}
        </div>
      </>
    );
  const choisie = [...choix][0];
  return (
    <>
      <div className="ech-voile" onClick={onFermer} />
      <div className="ech-tiroir" role="dialog" aria-modal="true" aria-labelledby="ech-ti-titre">
        <div className="t-tete">
          <h2 id="ech-ti-titre">{titre}</h2>
          <span>{vente ? '1 carte' : `${choix.size} / 30`}</span>
        </div>
        <div className="defile">
          {pieces.length === 0 && <p className="vide-lui">Rien à poser : les sorts ne s’échangent pas.</p>}
          {groupe('Cartes', cartes)}
          {groupe('Objets', objets)}
        </div>
        <div className="t-pied">
          {vente && (
            <div className="prix">
              <span className="libelle">Ton prix</span>
              <span className="montant">{prix} J</span>
              <span className="montants">
                {[-10, 10, 50].map((d) => (
                  <button key={d} disabled={d < 0 && prix <= 10} onClick={() => setPrix((x) => Math.max(10, x + d))}>
                    {d > 0 ? '+' : '−'}
                    {Math.abs(d)}
                  </button>
                ))}
              </span>
            </div>
          )}
          {vente ? (
            <button className="ech-btn-plein" disabled={!choisie || vente.envoi} onClick={() => choisie && vente.onProposer(choisie, prix)}>
              {choisie ? `Proposer à ${vente.pour} : ${prix} J` : 'Choisis la carte à vendre'}
            </button>
          ) : (
            <button className="ech-btn-plein" onClick={() => onPoser?.([...choix])}>
              Poser sur la table
            </button>
          )}
        </div>
      </div>
    </>
  );
}

