// Page ⑰ : le gagnant choisit 3 cartes désignées de son Book, qui deviennent ses lots réels (RG-13.3), puis montre
// le récapitulatif à l'organisateur (prototype validé : docs/prototype/clear.html). Trois sceaux 1·2·3 collés sous la
// barre, grille des cartes avec leur lot réel ; toucher = fiche (grande carte, ticket « LOT RÉEL », Choisir / Retirer) ;
// « Valider mes 3 lots » en deux temps. Le serveur vérifie le choix ; il est définitif.
import { Carte, Dialogue, numeroCarte } from '@gq/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { basculer, libelleLot, NB_LOTS, texteDefinitif, texteValider, type EtatClear, type LotCarte } from '../../lib/clear';
import { FiltreEncre } from '../masadora/Paquet';
import { creerEffets, type Effets } from '../scan/effets';
import { TamponOr } from './Sceau';

type Gagne = Extract<EtatClear, { etat: 'gagne' }>;
type Lot = Gagne['lots'][number];

const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};

function CarteLot({ c }: { c: LotCarte }) {
  return <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} texte={c.texte} />;
}

export function Lots({ etat, partieNom, choisir }: { etat: Gagne; partieNom: string; choisir: (itemIds: string[]) => Promise<void> }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const fx = useRef<Effets | null>(null);
  useEffect(() => {
    if (!toile.current) return;
    const e = creerEffets(toile.current, () => new DOMRect(-999, -999, 0, 0));
    fx.current = e;
    return () => e.arreter();
  }, []);
  const eclat = (el: Element | null, n: number, force: number, onde = false) => {
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [x, y] = centre(el);
    if (onde) fx.current?.onde(x, y, '#ffd877', 0.7);
    fx.current?.etincelles(x, y, n, '#ffd877', force);
  };

  return (
    <div className="planche cl-lots">
      <FiltreEncre />
      {etat.recompenses ? <Recap lots={etat.recompenses} gagnant={etat.gagnant} partieNom={partieNom} eclat={eclat} /> : <Choix lots={etat.lots} choisir={choisir} eclat={eclat} />}
      <canvas ref={toile} className="cl-toile-page" aria-hidden="true" />
    </div>
  );
}

type Eclat = (el: Element | null, n: number, force: number, onde?: boolean) => void;

function Choix({ lots, choisir, eclat }: { lots: Lot[]; choisir: (itemIds: string[]) => Promise<void>; eclat: Eclat }) {
  const [choix, setChoix] = useState<string[]>([]);
  const [fiche, setFiche] = useState<{ type: 'carte'; lot: Lot } | { type: 'valider' } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  /** Dernier sceau rempli : il est frappé (animation) et jette des étincelles. */
  const [frappe, setFrappe] = useState<number | null>(null);
  const sceaux = useRef<HTMLDivElement>(null);
  const parId = new Map(lots.map((l) => [l.itemId, l]));
  const plein = choix.length === NB_LOTS;

  useEffect(() => {
    if (frappe === null) return;
    eclat(sceaux.current?.querySelector(`[data-i="${frappe}"] .rond`) ?? null, 22, 0.4);
    vibrer(40);
  }, [frappe]);

  const basculerLot = (itemId: string) => {
    const avant = choix.length;
    const apres = basculer(choix, itemId);
    setChoix(apres);
    setFiche(null);
    setFrappe(apres.length > avant ? apres.length - 1 : null);
  };

  const valider = async () => {
    setEnvoi(true);
    setRefus(null);
    try {
      await choisir(choix);
      vibrer([40, 40, 120]);
    } catch (e) {
      setRefus(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <div className="cl-tete">
        <h1>Tes 3 lots</h1>
        <p>Choisis 3 cartes de ton Book : elles deviennent les lots que tu recevras de l’organisateur.</p>
      </div>
      <div ref={sceaux} className="cl-sceaux">
        {Array.from({ length: NB_LOTS }, (_, i) => {
          const l = parId.get(choix[i] ?? '');
          return (
            <button
              key={i}
              data-i={i}
              className={`cl-sceau-lot${l ? ' plein' : ''}`}
              disabled={!l}
              aria-label={l ? `Lot ${i + 1} : ${l.nom}, toucher pour revoir` : `Lot ${i + 1} : vide`}
              onClick={() => l && setFiche({ type: 'carte', lot: l })}
            >
              <span key={l ? `${i}-${l.itemId}` : i} className={`rond${l && frappe === i ? ' frappe' : ''}`}>
                {l ? numeroCarte(l.numero) : i + 1}
              </span>
              <small className={l ? '' : 'vide'}>{l ? l.nom : 'à choisir'}</small>
            </button>
          );
        })}
      </div>
      <div className="cl-grille">
        {lots.map((l) => {
          const rang = choix.indexOf(l.itemId);
          return (
            <button
              key={l.itemId}
              className={`cl-choix${rang >= 0 ? ' pris' : plein ? ' grise' : ''}`}
              aria-label={`${l.nom}${rang >= 0 ? `, lot ${rang + 1}` : ''}`}
              onClick={() => setFiche({ type: 'carte', lot: l })}
            >
              {rang >= 0 && <span className="badge">{rang + 1}</span>}
              <CarteLot c={l} />
              <span className="lot-court">{libelleLot(l)}</span>
            </button>
          );
        })}
      </div>
      <div className="cl-pied">
        {refus && (
          <p className="erreur" role="alert">
            {refus}
          </p>
        )}
        <button className="gi-btn-encre" disabled={!plein || envoi} onClick={() => setFiche({ type: 'valider' })}>
          {envoi ? 'Un instant…' : texteValider(choix.length)}
        </button>
      </div>

      {fiche?.type === 'carte' && (
        <FicheBas onFermer={() => setFiche(null)}>
          {(fermer) => {
            const l = fiche.lot;
            const rang = choix.indexOf(l.itemId);
            return (
              <>
                <div className="cl-grande">
                  <CarteLot c={l} />
                </div>
                <p className="gros" id="fiche-titre">
                  {numeroCarte(l.numero)} {l.nom}
                </p>
                <div className={`cl-ticket${l.lotReel ? '' : ' sans'}`}>
                  <span>LOT RÉEL</span>
                  <b>{libelleLot(l)}</b>
                </div>
                <div className="actions">
                  {rang >= 0 ? (
                    <button className="gi-btn-trait" onClick={() => basculerLot(l.itemId)}>
                      Retirer du lot {rang + 1}
                    </button>
                  ) : plein ? (
                    <p className="doux">Tes 3 lots sont choisis : retire d’abord une carte pour prendre celle-ci.</p>
                  ) : (
                    <button className="gi-btn-encre" onClick={() => basculerLot(l.itemId)}>
                      Choisir comme lot {choix.length + 1}
                    </button>
                  )}
                  <button className="gi-btn-trait" onClick={fermer}>
                    Fermer
                  </button>
                </div>
              </>
            );
          }}
        </FicheBas>
      )}
      {fiche?.type === 'valider' && (
        <FicheBas onFermer={() => setFiche(null)}>
          {(fermer) => (
            <>
              <p className="gros" id="fiche-titre">
                Valider tes 3 lots ?
              </p>
              <Dialogue qui="Greed Island">{texteDefinitif(choix.map((id) => parId.get(id)?.nom ?? '?'))}</Dialogue>
              <div className="actions">
                <button
                  className="gi-btn-encre"
                  onClick={() => {
                    fermer();
                    void valider();
                  }}
                >
                  Oui, valider
                </button>
                <button className="gi-btn-trait" onClick={fermer}>
                  Revoir mon choix
                </button>
              </div>
            </>
          )}
        </FicheBas>
      )}
    </>
  );
}

function Recap({ lots, gagnant, partieNom, eclat }: { lots: LotCarte[]; gagnant: string; partieNom: string; eclat: Eclat }) {
  const tampon = useRef<HTMLDivElement>(null);
  useEffect(() => {
    eclat(tampon.current, 50, 0.7, true);
  }, []);
  return (
    <>
      <div className="cl-tete">
        <h1>Tes lots</h1>
        <p>Montre cet écran à l’organisateur pour recevoir tes lots.</p>
      </div>
      <div className="cl-recap">
        {lots.map((l, i) => (
          <div key={l.carteId} className="ligne">
            <span className="rond">{i + 1}</span>
            <CarteLot c={l} />
            <p>
              <span>
                {numeroCarte(l.numero)} {l.nom}
              </span>
              <b>{libelleLot(l)}</b>
            </p>
          </div>
        ))}
        <div ref={tampon} className="cl-tampon" role="img" aria-label={`Tampon : Clear de ${gagnant}, ${partieNom}`}>
          <TamponOr lignes={[`CLEAR · ${gagnant.toUpperCase()}`, partieNom]} />
        </div>
      </div>
    </>
  );
}

/** Feuille du bas (même habillage que la fiche du Book) ; `fermer` la referme avec le fond. */
function FicheBas({ onFermer, children }: { onFermer: () => void; children: (fermer: () => void) => ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const appuiFond = useRef(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const fermer = () => ref.current?.close();
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
      <div className="fiche-corps">{children(fermer)}</div>
    </dialog>
  );
}
