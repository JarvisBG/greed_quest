// Page ⑧ : les sorts (RG-10 ; prototype validé par Sivraj le 2026-10-11 : docs/prototype/sorts-lancer.html).
// Les sorts du Book sont de vraies cartes bleues, rangées en deux familles : les offensifs (en gris tramé pendant le
// délai entre deux sorts offensifs, RG-10.3, décompte dans l'en-tête) et les autres ; ×2 en pile, Mur défensif
// tamponné « PASSIF ». Toucher une carte ouvre la fiche de lancement (FicheSort), puis la cinématique (Lancer).
// Page ⑨ (validée le 2026-10-12) : après un Accompagnement réussi, le suivi s'ouvre (SuiviAccompagnement) ; tant
// qu'il dure, un bandeau en haut de la page le rouvre. Après Retour, la ville s'ouvre (onVille).
// Page ⑩ (validée le 2026-10-12, docs/prototype/pouvoirs-nen.html) : la case du Nen en tête de page (CaseNen) ;
// Émission charge le prochain sort offensif touché ; Texture Surprise, Alchimie, L'épée du vol et l'Échange forcé
// passent par la fiche en deux temps (FichePouvoir) ; Zetsu et Fortune partent tout de suite ; puis la cinématique
// « aura puis effet » (Pouvoir).
import type { PositionInput } from '@gq/shared';
import { Carte } from '@gq/ui';
import { useEffect, useState } from 'react';
import { resteSuivi, type SuiviCible } from '../../lib/accompagnement';
import { construirePlan } from '../../lib/carte';
import { numeroSort, SORTS } from '../../lib/format';
import { useLivre } from '../../lib/useLivre';
import { AVEC_FICHE, type ClePouvoir } from '../../lib/pouvoir';
import { api } from '../../lib/client';
import { familles, sortsDisponibles, type ChoixSort, type ReponseSort, type SortDisponible } from '../../lib/sorts';
import type { Moi } from '../../lib/useJeu';
import { useCarte } from '../carte/CaseCarte';
import { FicheSort, minSec } from './FicheSort';
import { Lancer, type DemandeLancer, type FinLancer } from './Lancer';
import { CaseNen } from './CaseNen';
import { FichePouvoir, type PouvoirAvecFiche } from './FichePouvoir';
import { Pouvoir, type DemandePouvoir, type IssuePouvoir } from './Pouvoir';
import { SuiviAccompagnement } from './SuiviAccompagnement';

interface Props {
  partieId: string;
  moi: Moi;
  version: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  apresAction: () => void;
  /** Accompagnement (amendement 2026-10-10) : suivi de la cible, ouvert après un lancer réussi. */
  suiviCible: SuiviCible | null;
  ouvrirSuivi: (s: Omit<SuiviCible, 'recuA'>) => void;
  /** Dernière position connue, même ancienne : ta place sur la carte de l'île. */
  positionCarte: () => { lat: number; lng: number; precisionM: number } | null;
  /** Retour : ouvrir la ville à distance (boutique de Masadora, enchères d'Antokiba). */
  onVille: (v: 'masadora' | 'antokiba') => void;
}

/** Délai restant, décompté depuis la réception du profil. */
function useRestant(ms: number, depuis: number): number {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    if (ms - (Date.now() - depuis) <= 0) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ms, depuis]);
  // Profil rechargé depuis le dernier tic (`depuis` plus récent que `maintenant`) : rien d'écoulé, pas un délai fantôme.
  return Math.max(0, ms - Math.max(0, maintenant - depuis));
}

export function Sorts(p: Props) {
  const { livre, erreur } = useLivre(p.partieId, p.version);
  const [fiche, setFiche] = useState<{ choix: ChoixSort; origine: DOMRect | null } | null>(null);
  const [lancer, setLancer] = useState<{ n: number; demande: DemandeLancer } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [emission, setEmission] = useState(false);
  const [fichePouvoir, setFichePouvoir] = useState<PouvoirAvecFiche | null>(null);
  const [pouvoir, setPouvoir] = useState<{ n: number; demande: DemandePouvoir } | null>(null);
  const [suiviOuvert, setSuiviOuvert] = useState(false);
  const carte = useCarte(p.partieId, p.version);
  const offensifDans = useRestant(p.moi.delais.offensif, p.moi.recuA);
  const suiviDans = useRestant(p.suiviCible?.resteMs ?? 0, p.suiviCible?.recuA ?? 0);

  if (!livre) return <p className="sorts-attente">{erreur ?? 'Chargement…'}</p>;

  const dispo = sortsDisponibles(livre);
  const { offensifs, autres } = familles(dispo);
  const total = dispo.reduce((t, d) => t + d.itemIds.length, 0);
  const ouvrir = (choix: ChoixSort, el: Element | null) => setFiche({ choix, origine: el?.querySelector('.sorts-tas')?.getBoundingClientRect() ?? null });
  // Page ⑩ : la case du Nen. Zetsu et Fortune partent tout de suite (la requête part au toucher, P1).
  const lancerPouvoir = (demande: DemandePouvoir) => {
    setFichePouvoir(null);
    setPouvoir((x) => ({ n: (x?.n ?? 0) + 1, demande }));
  };
  const utiliser = (cle: ClePouvoir) => {
    if (cle === 'emission') return setEmission(true);
    if ((AVEC_FICHE as readonly string[]).includes(cle)) return setFichePouvoir(cle as PouvoirAvecFiche);
    if ((cle === 'zetsu' || cle === 'fortune') && p.moi.nen) {
      const reponse = api.post(`/parties/${p.partieId}/specialisation`, { pouvoir: cle }).then(
        (): IssuePouvoir => ({ phrase: '' }),
        (e: unknown): IssuePouvoir => ({ phrase: '', refus: e instanceof Error ? e.message : String(e) }),
      );
      lancerPouvoir({ nen: p.moi.nen, scene: cle === 'zetsu' ? { cle, dureeMs: p.moi.recharges.zetsu } : { cle }, reponse });
    }
  };
  const finPouvoir = (i: IssuePouvoir | null) => {
    setPouvoir(null);
    if (i) p.apresAction();
  };
  // La nuit se lève : sous elle, la fiche est déjà fermée et, après Accompagnement, le suivi déjà ouvert.
  const rangement = (r: ReponseSort) => {
    setFiche(null);
    if (r.accompagnement && r.resultat === 'reussi') {
      p.ouvrirSuivi({ ...r.accompagnement, resteMs: 3 * 60_000 });
      setSuiviOuvert(true);
    }
  };
  const finLancer = (f: FinLancer) => {
    setLancer(null);
    if (f.type === 'refus') return;
    setFiche(null);
    p.apresAction();
    if (f.r.sort === 'retour' && f.r.resultat === 'reussi' && f.r.ville) p.onVille(f.r.ville);
  };
  const plan = carte ? construirePlan(carte.zones, carte.balisesParZone, p.positionCarte()) : null;

  const pochette = (d: SortDisponible) => {
    const s = SORTS[d.sort];
    const n = d.itemIds.length;
    const passif = d.sort === 'barriere';
    const attend = offensifs.includes(d) && offensifDans > 0;
    const etat = passif ? ', passif' : attend ? ', en attente du délai' : '';
    // Émission chargée : seuls les offensifs se touchent, et partent hors de portée.
    const charge = emission && offensifs.includes(d);
    return (
      <li key={d.sort}>
        <button
          className={`sorts-pochette${attend ? ' attend' : ''}${charge ? ' charge' : ''}${fiche?.choix.itemId === d.itemIds[0] ? ' part' : ''}`}
          aria-label={`${s.nom}${n > 1 ? `, ${n} exemplaires` : ''}${etat}${charge ? ', hors de portée' : ''}`}
          disabled={emission && !charge}
          onClick={(e) => {
            ouvrir({ sort: d.sort, itemId: d.itemIds[0]!, ...(charge ? { emission: true } : {}) }, e.currentTarget);
            setEmission(false);
          }}
        >
          <span className={`sorts-tas${n > 1 ? ' double' : ''}`}>
            {n > 1 && <Carte genre="sort" numero={numeroSort(s.numero)} nom={s.nom} />}
            <Carte genre="sort" numero={numeroSort(s.numero)} nom={s.nom} />
            {n > 1 && <span className="sorts-nb">×{n}</span>}
            {passif && <span className="sorts-tampon">PASSIF</span>}
          </span>
          <span className="sorts-nom">
            {s.nom}
            {passif && <span>s’active tout seul</span>}
            {charge && <span>hors portée</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="sorts-page">
      <div className="tete-page sorts-tete">
        <h1>Sorts</h1>
        <span className="sorts-compte">
          {total} carte{total > 1 ? 's' : ''}
        </span>
      </div>

      {note && (
        <div className="gi-dialogue sorts-note" role="status">
          <span className="a-qui">Greed Island</span>
          <p className="a-texte">{note}</p>
          <button className="gi-lien" onClick={() => setNote(null)}>
            OK
          </button>
        </div>
      )}

      {p.suiviCible && suiviDans > 0 && (
        <button className="sorts-suivi" onClick={() => setSuiviOuvert(true)}>
          <b>Accompagnement · {p.suiviCible.pseudo}</b>
          <span>Voir sa position</span>
          <span className="sorts-suivi-chrono">{minSec(resteSuivi(p.suiviCible, Date.now()))}</span>
        </button>
      )}

      <CaseNen moi={p.moi} offensifDans={offensifDans} emission={emission} onUtiliser={utiliser} onAnnulerEmission={() => setEmission(false)} />

      {offensifs.length > 0 && (
        <section className="sorts-famille" aria-labelledby="sorts-off">
          <div className="sorts-famille-tete">
            <h2 id="sorts-off">Offensifs</h2>
            {offensifDans > 0 && (
              <span className="sorts-delai">
                prochain dans <b>{minSec(offensifDans)}</b>
              </span>
            )}
          </div>
          <ul className="sorts-main">{offensifs.map(pochette)}</ul>
        </section>
      )}
      {autres.length > 0 && (
        <section className="sorts-famille" aria-labelledby="sorts-autres">
          <div className="sorts-famille-tete">
            <h2 id="sorts-autres">Autres sorts</h2>
          </div>
          <ul className="sorts-main">{autres.map(pochette)}</ul>
        </section>
      )}
      {dispo.length === 0 && (
        <section className="sorts-case">
          <h2>Aucun sort</h2>
          <p>Ton Book n’a pas encore de carte de sort. Les balises en donnent parfois, et Masadora en vend.</p>
        </section>
      )}

      {fiche && (
        <FicheSort
          key={`${fiche.choix.sort}-${fiche.choix.itemId}`}
          partieId={p.partieId}
          moi={p.moi}
          livre={livre}
          depart={fiche.choix}
          origine={fiche.origine}
          offensifDans={offensifDans}
          plan={plan}
          positionAction={p.positionAction}
          onFermer={() => setFiche(null)}
          onLancer={(demande) => setLancer((l) => ({ n: (l?.n ?? 0) + 1, demande }))}
        />
      )}
      {suiviOuvert && p.suiviCible && <SuiviAccompagnement suivi={p.suiviCible} carte={carte} maPosition={p.positionCarte} onFermer={() => setSuiviOuvert(false)} />}
      {fichePouvoir && p.moi.nen && (
        <FichePouvoir partieId={p.partieId} nen={p.moi.nen} cle={fichePouvoir} livre={livre} positionAction={p.positionAction} onFermer={() => setFichePouvoir(null)} onLancer={lancerPouvoir} />
      )}
      {lancer && <Lancer key={lancer.n} demande={lancer.demande} onRangement={rangement} onFini={finLancer} />}
      {pouvoir && <Pouvoir key={pouvoir.n} demande={pouvoir.demande} onFini={finPouvoir} />}
    </div>
  );
}
