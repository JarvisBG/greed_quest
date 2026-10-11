// Page ⑦ Book. RG-8.5 : pages de 10, emplacements fixes dans l'ordre des numéros de l'anime puis emplacements libres ;
// amendement 2026-10-10 : une carte désignée se cache dans les libres puis se remet en place ; section Objets à part.
// RG-8.14 : provenance en clair ; RG-8.13 : emplacement perdu ; RG-8.9 : contrefaçons telles que le joueur les connaît ;
// RG-13.1 : Clear provisoire (Book gelé). Le serveur décide de tout ce qui est montré.
// À chaque ouverture, la cinématique d'invocation (Invocation.tsx) ; toucher pour passer.
import { FREE_SLOTS } from '@gq/engine';
import type { ObjetType, PositionInput } from '@gq/shared';
import { Carte, Dialogue } from '@gq/ui';
import { useRef, useState } from 'react';
import { api } from '../../lib/client';
import { numeroSort, OBJETS } from '../../lib/format';
import { clearPossible, type LivreRecu } from '../../lib/livre';
import { useLivre } from '../../lib/useLivre';
import { Feuillets } from './Feuillets';
import { Fiche, type ActionsFiche, type ResultatObjet, type Sujet } from './Fiche';
import { Invocation, type PocheApercu } from './Invocation';

export function Book({
  partieId,
  version,
  apresAction,
  positionAction,
  onSorts,
}: {
  partieId: string;
  version: number;
  apresAction: () => void;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  onSorts: () => void;
}) {
  const { livre, erreur } = useLivre(partieId, version);
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [invocation, setInvocation] = useState(!calme);
  const [sujet, setSujet] = useState<Sujet | null>(null);
  const [cle, setCle] = useState(0);
  const ouvrir = (s: Sujet) => {
    setSujet(s);
    setCle((k) => k + 1);
  };

  const actions: ActionsFiche = {
    deplacer: async (itemId, cacher) => {
      await api.post(`/parties/${partieId}/book/deplacer`, { itemId, cacher });
      apresAction();
    },
    utiliser: async (objet: ObjetType, itemId: string, carteItemId?: string) => {
      const corps =
        objet === 'boussole' ? { objet, itemId, position: await positionAction() } : objet === 'coffre' ? { objet, itemId, carteItemId } : { objet, itemId };
      return api.post<ResultatObjet>(`/parties/${partieId}/objet`, corps);
    },
    declarerClear: async () => (await api.post<{ message: string }>(`/parties/${partieId}/clear`)).message,
    rafraichir: apresAction,
    ouvrirSorts: onSorts,
  };

  return (
    <div className="planche page-book">
      <section className="gi-case scene gi-trame" aria-labelledby="t-book">
        <div className="scene-hud">
          <h1 id="t-book" className="sous-titre">
            Book
          </h1>
          {livre && (
            <>
              <span>
                Désignées{' '}
                <b>
                  {livre.cartesDesignees}
                  <small> / {livre.total}</small>
                </b>
              </span>
              <span>
                Libres{' '}
                <b>
                  {livre.libresUtilises}
                  <small> / {FREE_SLOTS}</small>
                </b>
              </span>
            </>
          )}
        </div>
        {!livre && <p className="doux">{erreur ?? 'Le Book arrive…'}</p>}
        {livre && <Bandeaux livre={livre} horsLigne={!!erreur} />}
        {livre && <Feuillets livre={livre} onPoche={(e) => ouvrir({ type: 'poche', e })} />}
        {livre && clearPossible(livre) && (
          <button className="gi-btn-encre btn-clear" onClick={() => ouvrir({ type: 'clear' })}>
            Clear !
          </button>
        )}
      </section>

      {livre && (
        <section className="gi-case objets-case" aria-labelledby="t-objets">
          <div className="scene-hud">
            <h2 id="t-objets" className="sous-titre">
              Objets
            </h2>
            <span>
              <b>
                {livre.objets.length}
                <small> / {livre.placesObjets}</small>
              </b>
            </span>
          </div>
          <div className="objets">
            {livre.objets.map((o) => {
              const d = OBJETS[o.objet];
              return (
                <button key={o.itemId} className="poche" onClick={() => ouvrir({ type: 'objet', o })} aria-label={`Objet ${d.nom}${o.engage ? ', dans un échange' : ''}`}>
                  <Carte genre="objet" numero={numeroSort(d.numero)} nom={d.nom} />
                  {o.engage && <span className="badge-poche">Échange</span>}
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, livre.placesObjets - livre.objets.length) }, (_, k) => (
              <span key={k} className="objet-vide" aria-hidden="true" />
            ))}
          </div>
          {livre.objets.length === 0 && <p className="doux">Une balise épuisée donne parfois un objet en plus des jenny.</p>}
        </section>
      )}

      {sujet && livre && <Fiche key={cle} sujet={sujet} livre={livre} actions={actions} onFermer={() => setSujet(null)} />}
      {invocation && <Invocation poches={apercu(livre)} onFini={() => setInvocation(false)} />}
    </div>
  );
}

/** États du Book en clair, dans la voix du jeu quand c'est grave. */
function Bandeaux({ livre, horsLigne }: { livre: LivreRecu; horsLigne: boolean }) {
  return (
    <>
      {livre.gele && <Dialogue qui="Book">Ton Book est gelé : va voir le Game Master.</Dialogue>}
      {!livre.gele && livre.libresUtilises >= FREE_SLOTS && <Dialogue qui="Book">Emplacements libres pleins : libère une place pour scanner à nouveau.</Dialogue>}
      {horsLigne && <p className="doux hors-ligne">Hors ligne : dernier état connu du Book.</p>}
    </>
  );
}

/** Les neuf premières pochettes, pour le Book de la cinématique. */
function apercu(livre: LivreRecu | null): (PocheApercu | null)[] {
  const premiere = livre?.pages[0] ?? [];
  return Array.from({ length: 9 }, (_, i) => {
    const e = premiere[i];
    if (!e || e.etat !== 'plein' || e.kind !== 'carte') return null;
    return { numero: e.numero === null ? '???' : String(e.numero).padStart(3, '0'), rang: e.rang ?? '' };
  });
}
