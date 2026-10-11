// Fiche de lancement (page ⑧ ; prototype validé le 2026-10-11 : docs/prototype/sorts-lancer.html). La carte de sort
// quitte la main et vient au premier plan ; selon le sort, on choisit la carte à donner (Échange) ou à copier
// (Mimétisme), la page (Pénétration), la ville (Retour), puis la cible (RG-10.1 : pseudos seulement, RG-10.12).
// Une seule action en aplat noir, au pouce. La requête part à son toucher (P1 : l'intention et la position, RG-10.9).
import { FREE_SLOTS } from '@gq/engine';
import type { PositionInput } from '@gq/shared';
import { Carte } from '@gq/ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../../lib/client';
import { numeroSort, SORTS } from '../../lib/format';
import { contenu, titreDePage, type LivreRecu } from '../../lib/livre';
import { CIBLE_CROISEE, cartesUtilisables, corpsSort, etapes, OFFENSIF, pagesVision, pouvoirDispo, resumeSort, type ChoixSort, type ReponseSort } from '../../lib/sorts';
import type { Moi } from '../../lib/useJeu';
import type { DemandeLancer } from './Lancer';

const VILLES = { masadora: 'Masadora', antokiba: 'Antokiba' } as const;
interface Cible {
  id: string;
  pseudo: string;
}
type Cibles = { joueurs: Cible[]; tous: Cible[]; croises: Cible[] };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** « 1:12 » : décompte du délai entre deux sorts offensifs. */
export const minSec = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  partieId: string;
  moi: Moi;
  livre: LivreRecu;
  /** Sort à lancer : carte de sort du Book, ou `itemId: null` pour le pouvoir de Manipulation. */
  depart: ChoixSort;
  /** Place de la carte dans la main : elle en part. */
  origine: DOMRect | null;
  offensifDans: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  onFermer: () => void;
  onLancer: (d: DemandeLancer) => void;
}

export function FicheSort({ partieId, moi, livre, depart, origine, offensifDans, positionAction, onFermer, onLancer }: Props) {
  const [choix, setChoix] = useState<ChoixSort>(depart);
  const [cibles, setCibles] = useState<Cibles | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const carte = useRef<HTMLDivElement>(null);
  const fiche = useRef<HTMLDivElement>(null);
  const retour = useRef<HTMLButtonElement>(null);
  const sort = SORTS[choix.sort];
  const gratuit = choix.itemId === null;
  const passif = choix.sort === 'barriere';
  const besoins = etapes(choix.sort);
  const croisee = CIBLE_CROISEE.includes(choix.sort);
  const offensif = OFFENSIF.includes(choix.sort);
  const villes = moi.villesVisitees.filter((v): v is keyof typeof VILLES => v in VILLES);
  const utilisables = cartesUtilisables(livre);
  const emissionPossible = offensif && pouvoirDispo(moi.nen, moi.delais.pouvoir, Date.now() - moi.recuA, 'emission');

  // La carte quitte la main et vient au premier plan.
  useLayoutEffect(() => {
    retour.current?.focus({ preventScroll: true });
    if (!origine || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const vers = carte.current!.getBoundingClientRect();
    fiche.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    carte.current!.animate(
      [{ transform: `translate(${origine.left - vers.left}px, ${origine.top - vers.top}px) scale(${origine.width / vers.width}) rotate(2deg)` }, { transform: 'none' }],
      { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' },
    );
  }, []);
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.lancer')) onFermer();
    };
    addEventListener('keydown', clavier);
    return () => removeEventListener('keydown', clavier);
  }, [onFermer]);

  // Liste des cibles : la position est d'abord envoyée pour que le serveur calcule la portée à jour (RG-10.1).
  const chargerCibles = async () => {
    setErreur(null);
    setCibles(null);
    try {
      await positionAction(true);
      setCibles(await api.get<Cibles>(`/parties/${partieId}/a-portee`));
    } catch (e) {
      setErreur(message(e));
    }
  };
  useEffect(() => {
    if (besoins.includes('cible')) void chargerCibles();
  }, []);

  const liste = cibles ? (croisee ? cibles.croises : choix.sort === 'radar' || choix.emission ? cibles.tous : cibles.joueurs) : null;
  const nomCible = cibles?.tous.find((c) => c.id === choix.cibleId)?.pseudo ?? liste?.find((c) => c.id === choix.cibleId)?.pseudo ?? null;
  const manque = besoins.find((e) => (e === 'carte' ? !choix.carteItemId : e === 'page' ? !choix.page : e === 'ville' ? !choix.ville : !choix.cibleId));
  const enDelai = offensif && offensifDans > 0;

  let action: string;
  if (passif) action = 'Rien à faire : il veille';
  else if (enDelai) action = `Prochain sort offensif dans ${minSec(offensifDans)}`;
  else if (manque === 'carte') action = choix.sort === 'duplication' ? 'Choisis la carte à copier' : 'Choisis la carte à donner';
  else if (manque === 'page') action = 'Choisis la page';
  else if (manque === 'ville') action = villes.length ? 'Choisis la ville' : 'Aucune ville visitée';
  else if (manque === 'cible') action = 'Choisis une cible';
  else action = `Lancer ${sort.nom}${nomCible ? ` sur ${nomCible}` : choix.ville ? ` vers ${VILLES[choix.ville]}` : ''}`;
  const pret = !passif && !enDelai && !manque;

  const lancer = () => {
    if (!pret) return;
    const donnee = choix.carteItemId ? utilisables.find((c) => c.itemId === choix.carteItemId) : undefined;
    // La requête part maintenant ; la cinématique attend sa réponse au moment de lâcher le sort.
    const reponse = (async () => api.post<ReponseSort>(`/parties/${partieId}/sort`, corpsSort(choix, await positionAction())))();
    const noms = new Map(contenu(livre).map((e) => [e.itemId, e.kind === 'carte' ? e.nom : SORTS[e.sort].nom]));
    onLancer({
      sort: choix.sort,
      nomSort: sort.nom,
      carteSort: { genre: 'sort', numero: numeroSort(sort.numero), nom: sort.nom, texte: sort.effet },
      cible: nomCible,
      carteChoisie: donnee ? { genre: 'designee', numero: donnee.numero, nom: donnee.nom, rang: donnee.rang, limite: donnee.limite ?? null, texte: donnee.texte ?? null } : null,
      depart: carte.current?.getBoundingClientRect() ?? null,
      reponse,
      phrase: (r) => resumeSort(r, nomCible, (id) => noms.get(id) ?? 'une carte', choix.sort === 'echange_force' ? donnee?.nom : undefined),
      pagesVision: (r) => pagesVision(r, livre, FREE_SLOTS),
      placesLibres: FREE_SLOTS,
    });
  };

  return (
    <>
      <div ref={fiche} className="sorts-fiche" role="dialog" aria-modal="true" aria-label={gratuit ? 'Échange forcé gratuit' : sort.nom}>
        <div className="sorts-fiche-corps">
          <button ref={retour} className="sorts-fermer" onClick={onFermer}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
            Sorts
          </button>
          <div ref={carte} className="sorts-fiche-carte">
            <Carte genre="sort" numero={numeroSort(sort.numero)} nom={sort.nom} texte={gratuit ? 'Pouvoir de Manipulation : un échange forcé sans carte de sort.' : sort.effet} />
          </div>

          {passif && (
            <section className="sorts-case">
              <h2>Passif</h2>
              <p>Il te protège tout seul : le prochain sort offensif lancé sur toi est annulé, et le Mur défensif est perdu.</p>
            </section>
          )}

          {besoins.includes('carte') && (
            <section className="sorts-case">
              <h2>{choix.sort === 'duplication' ? 'Carte à copier' : 'Carte que tu donnes'}</h2>
              <p className="aide">
                {choix.sort === 'duplication'
                  ? 'Une carte de ton Book. Si sa limite d’exemplaires est atteinte, la copie sera une contrefaçon.'
                  : 'Le joueur visé la reçoit, et tu lui prends une carte au hasard.'}
              </p>
              {utilisables.length === 0 ? (
                <p>Aucune carte disponible dans ton Book.</p>
              ) : (
                <ul className="sorts-mes-cartes">
                  {utilisables.map((c) => (
                    <li key={c.itemId}>
                      <button aria-pressed={choix.carteItemId === c.itemId} onClick={() => setChoix({ ...choix, carteItemId: c.itemId })}>
                        <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} limite={c.limite ?? null} />
                        <span>{c.nom}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {besoins.includes('page') && (
            <section className="sorts-case">
              <h2>Page à examiner</h2>
              <ul className="sorts-liste">
                {livre.pages.map((_, i) => (
                  <li key={i}>
                    <button aria-pressed={choix.page === i + 1} onClick={() => setChoix({ ...choix, page: i + 1 })}>
                      {titreDePage(livre, i)}
                      <Coche />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {besoins.includes('ville') && (
            <section className="sorts-case">
              <h2>Ville déjà visitée</h2>
              {villes.length === 0 ? (
                <p>Scanne d’abord le QR de Masadora ou d’Antokiba, sur place.</p>
              ) : (
                <ul className="sorts-liste">
                  {villes.map((v) => (
                    <li key={v}>
                      <button aria-pressed={choix.ville === v} onClick={() => setChoix({ ...choix, ville: v })}>
                        {VILLES[v]}
                        <Coche />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {besoins.includes('cible') && (
            <section className="sorts-case">
              <div className="sorts-case-tete">
                <h2>Cible</h2>
                <button className="gi-lien" onClick={() => void chargerCibles()}>
                  Actualiser
                </button>
              </div>
              <p className="aide">{croisee ? 'Joueurs que tu as déjà croisés' : choix.sort === 'radar' || choix.emission ? 'Tous les joueurs de la partie' : 'Joueurs à portée, 30 m environ'}</p>
              {emissionPossible && (
                <label className="sorts-emission">
                  <input type="checkbox" checked={!!choix.emission} onChange={(e) => setChoix(({ cibleId: _, ...reste }) => ({ ...reste, emission: e.target.checked }))} />
                  Émission : viser un joueur hors de portée (pouvoir de Nen)
                </label>
              )}
              {erreur ? (
                <p className="sorts-erreur">{erreur}</p>
              ) : !liste ? (
                <p>Recherche des joueurs…</p>
              ) : liste.length === 0 ? (
                <p>{croisee ? 'Tu n’as encore croisé personne.' : choix.sort === 'radar' ? 'Aucun autre joueur.' : 'Personne à portée (30 m environ). Rapproche-toi d’un joueur.'}</p>
              ) : (
                <ul className="sorts-liste">
                  {liste.map((c) => (
                    <li key={c.id}>
                      <button aria-pressed={choix.cibleId === c.id} onClick={() => setChoix({ ...choix, cibleId: c.id })}>
                        {c.pseudo}
                        <Coche />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {besoins.length === 0 && !passif && (
            <section className="sorts-case">
              <h2>Sans cible</h2>
              <p className="aide">Le sort part sans viser personne.</p>
            </section>
          )}
        </div>
      </div>
      <div className="sorts-pied">
        <button className="gi-btn-encre sorts-agir" disabled={!pret} onClick={lancer}>
          {action}
        </button>
      </div>
    </>
  );
}

function Coche() {
  return (
    <svg className="coche" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
