// Page ⑦ Book. RG-8.5 : pages de 10, emplacements fixes dans l'ordre des numéros de l'anime puis emplacements libres ;
// amendement 2026-10-10 : une carte désignée se cache dans les libres puis se remet en place ; page des objets en fin de Book.
// RG-8.14 : provenance en clair ; RG-8.13 : emplacement perdu ; RG-8.9 : contrefaçons telles que le joueur les connaît ;
// RG-13.1 : Clear provisoire (Book gelé). Le serveur décide de tout ce qui est montré.
// À chaque ouverture, la cinématique d'invocation (Invocation.tsx) ; toucher pour passer.
import { FREE_SLOTS } from '@gq/engine';
import type { ObjetType, PositionInput } from '@gq/shared';
import { Dialogue } from '@gq/ui';
import { useRef, useState } from 'react';
import { api } from '../../lib/client';
import { clearPossible, type CarteGmRecue, type LivreRecu } from '../../lib/livre';
import { useLivre } from '../../lib/useLivre';
import { Feuillets } from './Feuillets';
import { Fiche, type ActionsFiche, type ResultatObjet, type Sujet } from './Fiche';
import { Invocation, type PocheApercu } from './Invocation';
import { Sceau } from '../clear/Sceau';

export function Book({
  partieId,
  version,
  apresAction,
  positionAction,
  onSorts,
  onClearDeclare,
  onJouerGm,
}: {
  partieId: string;
  version: number;
  apresAction: () => void;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  onSorts: () => void;
  /** Page ⑰ : Clear provisoire accepté (Book gelé) ; l'App joue le sceau. */
  onClearDeclare: () => void;
  /** RG-8.19, RG-8.20 : jouer une carte de Maître du jeu (l'App ouvre le choix puis la cinématique). */
  onJouerGm: (g: CarteGmRecue) => void;
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
    clearDeclare: () => {
      onClearDeclare();
      apresAction();
    },
    rafraichir: apresAction,
    ouvrirSorts: onSorts,
    jouerGm: onJouerGm,
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
        {livre && (
          <div className={`cl-book-zone${livre.gele ? ' scelle' : ''}`}>
            <Feuillets livre={livre} onPoche={ouvrir} />
            {/* Page ⑰ : Clear déclaré, le sceau doré posé sur le Book. */}
            {livre.gele && <Sceau className="cl-sceau-book" />}
          </div>
        )}
        {livre && clearPossible(livre) && (
          <button className="gi-btn-encre btn-clear" onClick={() => ouvrir({ type: 'clear' })}>
            Clear !
          </button>
        )}
      </section>

      {sujet && livre && <Fiche key={cle} sujet={sujet} livre={livre} actions={actions} onFermer={() => setSujet(null)} />}
      {invocation && <Invocation poches={apercu(livre)} onFini={() => setInvocation(false)} />}
    </div>
  );
}

/** États du Book en clair, dans la voix du jeu quand c'est grave. */
function Bandeaux({ livre, horsLigne }: { livre: LivreRecu; horsLigne: boolean }) {
  return (
    <>
      {livre.gele && <Dialogue qui="Book">Ton Book est gelé : plus rien ne peut le toucher. Montre ta licence au Game Master.</Dialogue>}
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
