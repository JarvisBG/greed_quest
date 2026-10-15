// Fiche d'une pochette, d'un objet ou du Clear : feuille qui monte du bas (prototype validé). Le serveur décide :
// la fiche envoie des intentions (cacher, remettre, utiliser un objet, déclarer le Clear) et montre la réponse.
import { FREE_SLOTS } from '@gq/engine';
import type { ObjetType } from '@gq/shared';
import { Carte, CarteNoire, Dialogue, numeroCarte } from '@gq/ui';
import { EFFETS_GM, nomGm } from '../../lib/cartesGm';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { numeroSort, OBJETS, SORTS } from '../../lib/format';
import { cartesASceller, type CarteGmRecue, type Emplacement, type EmplacementCarte, type LivreRecu } from '../../lib/livre';
import { Grattage } from './Grattage';

export type ObjetRecu = LivreRecu['objets'][number];
export type Sujet = { type: 'poche'; e: Emplacement } | { type: 'objet'; o: ObjetRecu } | { type: 'gm'; g: CarteGmRecue } | { type: 'clear' };

/** Réponses du serveur à l'usage d'un objet (POST /objet). */
export type ResultatObjet = { objet: 'ticket'; gain: number; jenny: number } | { objet: 'boussole'; direction: Direction; message: string } | { objet: 'coffre' };
type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
const ANGLES: Record<Direction, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };

export interface ActionsFiche {
  deplacer: (itemId: string, cacher: boolean) => Promise<void>;
  utiliser: (objet: ObjetType, itemId: string, carteItemId?: string) => Promise<ResultatObjet>;
  declarerClear: () => Promise<string>;
  /** Page ⑰ : Clear accepté par le serveur, la fiche se ferme et le sceau s'imprime (cinématique). */
  clearDeclare: () => void;
  /** Fin d'une action dont le résultat a été montré : le Book et le profil se rechargent. */
  rafraichir: () => void;
  ouvrirSorts: () => void;
  /** RG-8.19, RG-8.20 : jouer une carte de Maître du jeu (choix, puis cinématique, au niveau de l'App). */
  jouerGm: (g: CarteGmRecue) => void;
}

export function Fiche({ sujet, livre, actions, onFermer }: { sujet: Sujet; livre: LivreRecu; actions: ActionsFiche; onFermer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const aRafraichir = useRef(false);
  /** Le fond ne ferme la fiche que si le doigt s'y est posé (pas sur un clic qui suit l'ouverture). */
  const appuiFond = useRef(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const fermer = () => {
    if (aRafraichir.current) actions.rafraichir();
    ref.current?.close();
  };
  /** Envoie une intention ; le refus du serveur s'affiche tel quel (RG-7.4). */
  const envoyer = async <T,>(f: () => Promise<T>): Promise<T | null> => {
    setEnvoi(true);
    setRefus(null);
    try {
      return await f();
    } catch (e) {
      setRefus(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setEnvoi(false);
    }
  };
  const ctx: Ctx = { livre, actions, envoi, envoyer, fermer, marquer: () => (aRafraichir.current = true) };

  return (
    <dialog
      className="fiche"
      ref={ref}
      aria-labelledby="fiche-titre"
      onClose={onFermer}
      onPointerDown={(e) => {
        appuiFond.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && appuiFond.current) fermer();
        appuiFond.current = false;
      }}
    >
      <div className="fiche-corps">
        {sujet.type === 'poche' && <FichePoche e={sujet.e} ctx={ctx} />}
        {sujet.type === 'objet' && <FicheObjet o={sujet.o} ctx={ctx} />}
        {sujet.type === 'gm' && <FicheGm g={sujet.g} ctx={ctx} />}
        {sujet.type === 'clear' && <FicheClear ctx={ctx} />}
        {refus && (
          <p className="erreur" role="alert">
            {refus}
          </p>
        )}
      </div>
    </dialog>
  );
}

interface Ctx {
  livre: LivreRecu;
  actions: ActionsFiche;
  envoi: boolean;
  envoyer: <T>(f: () => Promise<T>) => Promise<T | null>;
  fermer: () => void;
  marquer: () => void;
}

function Boutons({ ctx, children }: { ctx: Ctx; children?: ReactNode }) {
  return (
    <div className="actions">
      {children}
      <button className={children ? 'gi-btn-trait' : 'gi-btn-encre'} onClick={ctx.fermer}>
        Fermer
      </button>
    </div>
  );
}

function FichePoche({ e, ctx }: { e: Emplacement; ctx: Ctx }) {
  const { livre } = ctx;
  if (e.etat === 'vide') {
    if (!e.designe) return null;
    return (
      <>
        <div className="fiche-vide">{numeroCarte(e.carte.numero)}</div>
        <div className="fiche-info">
          <p className="gros" id="fiche-titre">
            {numeroCarte(e.carte.numero)} {e.carte.nom}
          </p>
          <p className="doux">Rang {e.carte.rang}. Pas encore dans ton Book.</p>
        </div>
        <Boutons ctx={ctx} />
      </>
    );
  }
  if (e.etat === 'perdu') {
    return (
      <>
        <div className="fiche-vide perdue">{numeroCarte(e.carte.numero)}</div>
        <div className="fiche-info">
          <p className="gros" id="fiche-titre">
            {numeroCarte(e.carte.numero)} {e.carte.nom}
          </p>
          <p>{e.message}.</p>
        </div>
        <Boutons ctx={ctx} />
      </>
    );
  }
  if (e.kind === 'sort') {
    const s = SORTS[e.sort];
    return (
      <>
        <Carte genre="sort" numero={numeroSort(s.numero)} nom={s.nom} texte={s.effet} />
        <div className="fiche-info">
          <p className="gros" id="fiche-titre">
            Sort {s.nom}
          </p>
          <span className="fiche-role sort">Carte de sort</span>
          <p className="fiche-texte">{s.effet}.</p>
        </div>
        <Boutons ctx={ctx}>
          <button
            className="gi-btn-encre"
            onClick={() => {
              ctx.fermer();
              ctx.actions.ouvrirSorts();
            }}
          >
            Lancer depuis les Sorts
          </button>
        </Boutons>
      </>
    );
  }
  return <FicheCarte e={e} ctx={ctx} libresPleins={livre.libresUtilises >= FREE_SLOTS} />;
}

function FicheCarte({ e, ctx, libresPleins }: { e: EmplacementCarte; ctx: Ctx; libresPleins: boolean }) {
  const grisee = e.apparence === 'grisee';
  const nom = grisee ? `Contrefaçon de ${e.nom}` : e.nom;
  // RG-8.5 amendé : une carte désignée en place se cache dans les libres ; une carte cachée se remet en place.
  const deplacable = !ctx.livre.gele && !e.engagee && !grisee && (e.designe || e.cachee);
  const cacher = !e.cachee;
  return (
    <>
      <Carte genre="designee" numero={e.numero} nom={nom} rang={e.rang} limite={e.limite ?? null} texte={e.texte ?? null} grisee={grisee} />
      <div className="fiche-info">
        <p className="gros" id="fiche-titre">
          {numeroCarte(e.numero)} {nom}
        </p>
        <span className="fiche-role">Carte à collectionner · rang {e.rang}</span>
        <div className="etiquettes">
          {e.badge === 'maudite' && <span className="etiquette rouge">Maudite</span>}
          {e.badge === 'contrefacon' && <span className="etiquette rouge">Contrefaçon</span>}
          {e.engagee && <span className="etiquette">Dans un échange en cours</span>}
          {e.coffreJusqua && <span className="etiquette">Scellée jusqu’à {e.coffreJusqua}</span>}
        </div>
        {e.cachee && <p>Cachée dans tes emplacements libres : elle ne compte pas pour le Clear tant qu’elle n’est pas remise en place.</p>}
        {!e.designe && !e.cachee && !grisee && <p className="doux">Hors de son emplacement : à échanger, à revendre, ou à garder contre un Vol.</p>}
        <p className="doux">
          {e.provenance} · {e.obtenue}
        </p>
      </div>
      <Boutons ctx={ctx}>
        {deplacable && (
          <button
            className="gi-btn-encre"
            disabled={ctx.envoi || (cacher && libresPleins)}
            onClick={async () => {
              const ok = await ctx.envoyer(() => ctx.actions.deplacer(e.itemId, cacher));
              if (ok !== null) ctx.fermer();
            }}
          >
            {cacher ? (libresPleins ? 'Libres pleins : impossible de la cacher' : 'Cacher dans les libres') : 'Remettre en place'}
          </button>
        )}
      </Boutons>
    </>
  );
}

function FicheObjet({ o, ctx }: { o: ObjetRecu; ctx: Ctx }) {
  const d = OBJETS[o.objet];
  const [resultat, setResultat] = useState<ResultatObjet | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const utilisable = !ctx.livre.gele && !o.engage;
  const utiliser = async (carteItemId?: string) => {
    const r = await ctx.envoyer(() => ctx.actions.utiliser(o.objet, o.itemId, carteItemId));
    if (r) {
      ctx.marquer();
      setResultat(r);
    }
  };

  let corps: ReactNode = null;
  let action: ReactNode = null;
  if (resultat?.objet === 'ticket') corps = <Grattage gain={resultat.gain} onDecouvert={ctx.actions.rafraichir} />;
  else if (resultat?.objet === 'boussole') corps = <Boussole direction={resultat.direction} message={resultat.message} />;
  else if (resultat?.objet === 'coffre') corps = <Dialogue qui="Book">Solidité ! Cette carte ne peut plus être ni volée ni prise pour un moment.</Dialogue>;
  else if (!utilisable) corps = <p className="doux">{o.engage ? 'Dans un échange en cours.' : 'Ton Book est gelé.'}</p>;
  else if (o.objet === 'ticket') action = <BoutonUtiliser ctx={ctx} onClick={() => void utiliser()} texte="Gratter le ticket" />;
  else if (o.objet === 'boussole') action = <BoutonUtiliser ctx={ctx} onClick={() => void utiliser()} texte="Consulter la boussole" />;
  else if (o.objet === 'coffre') {
    const cartes = cartesASceller(ctx.livre);
    corps = cartes.length ? (
      <fieldset className="choix-carte">
        <legend>Quelle carte sceller ?</legend>
        {cartes.map((c) => (
          <label key={c.itemId} className={choisie === c.itemId ? 'choisie' : ''}>
            <input type="radio" name="sceller" value={c.itemId} checked={choisie === c.itemId} onChange={() => setChoisie(c.itemId)} />
            <b>{numeroCarte(c.numero)}</b> {c.nom}
            <span className={`gi-rang seul r-${c.rang}`}>{c.rang}</span>
          </label>
        ))}
      </fieldset>
    ) : (
      <p className="doux">Aucune carte à sceller pour l’instant.</p>
    );
    if (cartes.length) action = <BoutonUtiliser ctx={ctx} onClick={() => choisie && void utiliser(choisie)} texte={choisie ? 'Sceller cette carte' : 'Choisis une carte'} desactive={!choisie} />;
  } else {
    // Pépite, Second souffle, Rideau noir : ils agissent ailleurs.
    const ou = { pepite: 'Se revend à la boutique de Masadora.', souffle: 'Proposé au scanner quand une balise refuse ton scan (boucle).', voile: 'Agit tout seul contre la prochaine Trace, Voyance ou Clairvoyance.' } as Partial<Record<ObjetType, string>>;
    corps = <p>{ou[o.objet]}</p>;
  }

  return (
    <>
      {!resultat && <Carte genre="objet" numero={numeroSort(d.numero)} nom={d.nom} texte={d.effet} />}
      <div className="fiche-info">
        <p className="gros" id="fiche-titre">
          {d.nom}
        </p>
        <span className="fiche-role objet">Carte d’objet</span>
        {!resultat && <p className="fiche-texte">{d.effet}.</p>}
        {corps}
        <p className="doux">Obtenu à {o.obtenu}</p>
      </div>
      <Boutons ctx={ctx}>{!resultat && action}</Boutons>
    </>
  );
}

/** RG-8.15 : fiche d'une carte de Maître du jeu ; l'effet est dit ici (il n'est pas écrit sur la carte). */
function FicheGm({ g, ctx }: { g: CarteGmRecue; ctx: Ctx }) {
  const bloquee = ctx.livre.gele ? 'Ton Book est gelé : ses cartes sont inutilisables.' : g.engage ? 'Cette carte est dans un échange en cours.' : null;
  return (
    <>
      <div className="fiche-gm">
        <CarteNoire gm={g.gm} />
      </div>
      <div className="fiche-info">
        <p className="gros" id="fiche-titre">
          {nomGm(g.gm)}
        </p>
        <span className="fiche-role gm">Carte de Maître du jeu · unique</span>
        <p className="fiche-texte">{EFFETS_GM[g.gm]}</p>
        <p className="doux">{bloquee ?? `Obtenue à ${g.obtenu}. Une seule utilisation, puis elle revient au Maître du jeu.`}</p>
      </div>
      <Boutons ctx={ctx}>
        {!bloquee && (
          <button
            className="gi-btn-encre"
            onClick={() => {
              ctx.fermer();
              ctx.actions.jouerGm(g);
            }}
          >
            Jouer la carte
          </button>
        )}
      </Boutons>
    </>
  );
}

function BoutonUtiliser({ ctx, onClick, texte, desactive }: { ctx: Ctx; onClick: () => void; texte: string; desactive?: boolean }) {
  return (
    <button className="gi-btn-encre" disabled={ctx.envoi || desactive} onClick={onClick}>
      {ctx.envoi ? 'Un instant…' : texte}
    </button>
  );
}

/** Boussole du chercheur : l'aiguille tourne puis se fige vers la balise (une direction, jamais une distance, RG-10.12). */
function Boussole({ direction, message }: { direction: Direction; message: string }) {
  return (
    <div className="boussole">
      <svg viewBox="-60 -60 120 120" aria-hidden="true">
        <circle r="56" className="b-bord" />
        <circle r="47" className="b-cadran" />
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d={`M0 -47V${i % 4 ? -42 : -37}`} transform={`rotate(${i * 22.5})`} className="b-trait" />
        ))}
        {(['N', 'E', 'S', 'O'] as const).map((l, i) => (
          <text key={l} x={Math.sin((i * Math.PI) / 2) * 30} y={-Math.cos((i * Math.PI) / 2) * 30} className="b-lettre">
            {l}
          </text>
        ))}
        <g className="b-aiguille" style={{ '--angle': `${ANGLES[direction]}deg` } as React.CSSProperties}>
          <path d="M0 -40 7 0H-7Z" className="b-pointe" />
          <path d="M0 40 7 0H-7Z" className="b-queue" />
        </g>
        <circle r="4.5" className="b-axe" />
      </svg>
      <Dialogue qui="Boussole">{message}.</Dialogue>
    </div>
  );
}

// Page ⑰ : la déclaration. Acceptée, la fiche se ferme sur la cinématique du sceau ; refusée (contrefaçon, RG-13.1),
// le refus du serveur s'affiche au-dessus des boutons, avec la page mais jamais la carte.
function FicheClear({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <p className="gros clear-titre" id="fiche-titre">
        Déclarer le Clear
      </p>
      <Dialogue qui="Greed Island">Tes {ctx.livre.total} cartes désignées sont en place. Ton Book sera scellé jusqu’à ce que le Game Master vérifie ta licence.</Dialogue>
      <div className="actions">
        <button
          className="gi-btn-encre btn-clear"
          disabled={ctx.envoi}
          onClick={async () => {
            const m = await ctx.envoyer(ctx.actions.declarerClear);
            if (m !== null) {
              ctx.fermer();
              ctx.actions.clearDeclare();
            }
          }}
        >
          {ctx.envoi ? 'Un instant…' : 'Déclarer le Clear'}
        </button>
        <button className="gi-btn-trait" onClick={ctx.fermer}>
          Pas encore
        </button>
      </div>
    </>
  );
}
