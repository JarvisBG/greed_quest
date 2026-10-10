// Accueil : profil et pouvoir de Nen (RG-5.4), gel (RG-10), Book fermé à invoquer, évènements en cours
// (RG-12 : bannières, raid), carte de l'île (zones, balises actives par zone RG-6.5, ta position, évènements de zone)
// et villes (boutique de Masadora RG-9, enchères d'Antokiba RG-11.4, Retour),
// licence (RG-5.2), Examen reporté, options, notifications.
import { Dialogue } from '@gq/ui';
import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/client';
import { eveilDisponible } from '../lib/eveil';
import { formatChrono, libelleEtat, NENS } from '../lib/format';
import { etatPouvoir } from '../lib/pouvoir';
import { useLivre } from '../lib/useLivre';
import type { Moi, Notif, Partie } from '../lib/useJeu';
import { BookFerme } from './BookFerme';
import { CaseCarte } from './carte/CaseCarte';

export interface Evenement {
  id: string;
  type: string;
  /** Zone visée (double gain, apparition, zone maudite) : l'évènement s'allume sur la carte. */
  zoneId?: string | null;
  texte: string | null;
  resteMs: number;
  pv?: number;
  pvMax?: number;
}

export type SousEcran = 'licence' | 'boutique' | 'encheres' | 'raid';

/** Évènements en cours, rechargés à chaque évènement reçu. */
export function useEvenements(partieId: string, version: number) {
  const [ev, setEv] = useState<{ liste: Evenement[]; recuA: number }>({ liste: [], recuA: 0 });
  useEffect(() => {
    if (!partieId) return;
    api.get<{ evenements: Evenement[] }>(`/parties/${partieId}/evenements`).then(
      (r) => setEv({ liste: r.evenements, recuA: Date.now() }),
      () => undefined,
    );
  }, [partieId, version]);
  return ev;
}

/** Étiquette courte d'un évènement de zone sur la carte (RG-12). */
const LIBELLE_ZONE: Record<string, string> = { double_gain: 'Double gain', apparition: 'Apparition', zone_maudite: 'Zone maudite' };

const VILLES = [
  { id: 'masadora', nom: 'Masadora', lieu: 'Boutique de sorts', ecran: 'boutique' },
  { id: 'antokiba', nom: 'Antokiba', lieu: 'Enchères', ecran: 'encheres' },
] as const;

export function Accueil({
  partie,
  moi,
  version,
  evenements,
  notifs,
  ecranAllume,
  onEcranAllume,
  onExamen,
  onOuvrir,
  onBook,
  position,
}: {
  partie: Partie;
  moi: Moi;
  version: number;
  evenements: { liste: Evenement[]; recuA: number };
  notifs: Notif[];
  ecranAllume: boolean;
  onEcranAllume: (oui: boolean) => void;
  onExamen: () => void;
  onOuvrir: (s: SousEcran) => void;
  onBook: () => void;
  /** Dernière position GPS de ce téléphone (seule position montrée, RG-10.12). */
  position: { lat: number; lng: number; precisionM: number } | null;
}) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { livre } = useLivre(partie.id, version);
  const ecoule = maintenant - moi.recuA;
  const encours = evenements.liste.filter((e) => e.resteMs - (maintenant - evenements.recuA) > 0);
  const raid = encours.find((e) => e.type === 'raid');
  // Les évènements d'une zone s'allument sur la carte ; les autres restent en bannière.
  const bannieres = encours.filter((e) => e.type !== 'raid' && !e.zoneId);
  const surCarte = encours
    .filter((e) => e.type !== 'raid' && e.zoneId)
    .map((e) => ({ zoneId: e.zoneId!, texte: `${LIBELLE_ZONE[e.type] ?? 'Évènement'} · ${Math.max(1, Math.ceil((e.resteMs - (maintenant - evenements.recuA)) / 60_000))} min` }));
  const pouvoir = etatPouvoir(moi, ecoule);
  const gel = Math.max(0, moi.delais.gel - ecoule);
  const suivi = Math.max(0, moi.accompagne - ecoule);
  const retour = moi.retour && moi.retour.resteMs - ecoule > 0 ? { ville: moi.retour.ville, reste: moi.retour.resteMs - ecoule } : null;

  return (
    <div className="planche accueil">
      {moi.statut === 'gele' && (
        <section className="gi-case gel" role="status">
          <h2 className="sous-titre">Tu es gelé par l’équipe</h2>
          <p>Tu ne peux plus jouer pour l’instant. Va voir un PNJ ou le Game Master.</p>
        </section>
      )}
      {(gel > 0 || suivi > 0) && (
        <section className="gi-case gel" role="status">
          <h2 className="sous-titre">{suivi > 0 ? 'Accompagnement : tu es suivi' : 'Gel : tu ne peux plus scanner'}</h2>
          <p className="temps">{formatChrono(Math.max(gel, suivi))}</p>
        </section>
      )}

      <section className="gi-case profil">
        <h1 className="pseudo">{moi.pseudo}</h1>
        <p className="doux partie-ligne">
          {partie.nom} · {libelleEtat(partie.etat)}
        </p>
        {moi.nen && (
          <span className="nen-pastille" style={{ '--type': `var(--nen-${moi.nen})` } as CSSProperties}>
            <span lang="ja">{NENS[moi.nen].court}</span>
            {NENS[moi.nen].nom}
          </span>
        )}
        {pouvoir && (
          <div className={`pouvoir-ligne ${pouvoir.etat}`}>
            <div>
              <b>{pouvoir.nom === NENS[moi.nen!].nom ? `Pouvoir de ${pouvoir.nom}` : `Pouvoir secret : ${pouvoir.nom}`}</b>
              <span>{pouvoir.libelle}</span>
            </div>
            {pouvoir.resteMs > 0 && <span className="temps">{formatChrono(pouvoir.resteMs)}</span>}
            {pouvoir.etat === 'pret' && <span className="pret" aria-hidden="true">Prêt</span>}
          </div>
        )}
        <button className="gi-btn-trait" onClick={() => onOuvrir('licence')}>
          Ma licence de Hunter
        </button>
      </section>

      <BookFerme designees={livre?.cartesDesignees ?? null} total={livre?.total ?? null} libres={livre?.libresUtilises ?? null} onOuvert={onBook} />

      {raid && (
        <section className="gi-case raid-case">
          <h2 className="sous-titre">Raid en cours</h2>
          <p>{raid.texte ?? 'Un monstre attaque : tout le monde peut frapper.'}</p>
          <div className="vie" role="img" aria-label={`Points de vie : ${raid.pv ?? 0} sur ${raid.pvMax ?? 0}`}>
            <i style={{ transform: `scaleX(${raid.pvMax ? (raid.pv ?? 0) / raid.pvMax : 0})` }} />
          </div>
          <div className="raid-pied">
            <span className="temps">{formatChrono(raid.resteMs - (maintenant - evenements.recuA))}</span>
            <button className="gi-btn-encre" onClick={() => onOuvrir('raid')}>
              Combattre
            </button>
          </div>
        </section>
      )}

      {bannieres.length > 0 && (
        <section className="gi-case">
          <h2 className="sous-titre">En ce moment</h2>
          <ul className="evenements">
            {bannieres.map((e) => (
              <li key={e.id}>
                <span>{e.texte ?? 'Évènement en cours'}</span>
                <span className="temps">{formatChrono(e.resteMs - (maintenant - evenements.recuA))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CaseCarte partieId={partie.id} version={version} position={position} evenements={surCarte}>
        <div className="villes">
          {VILLES.map((v) => {
            const distance = retour?.ville === v.id;
            return (
              <button key={v.id} className={`ville${distance ? ' a-distance' : ''}`} onClick={() => onOuvrir(v.ecran)}>
                <b>{v.nom}</b>
                <span>{v.lieu}</span>
                {distance ? (
                  <span className="etat-ville">
                    À distance <em className="temps">{formatChrono(retour.reste)}</em>
                  </span>
                ) : (
                  moi.villesVisitees.includes(v.id) && <span className="etat-ville">Déjà visitée</span>
                )}
              </button>
            );
          })}
        </div>
      </CaseCarte>

      {!moi.examenFait && (
        <>
          <Dialogue qui="Examinateur">L’Examen Hunter t’attend : trois questions, des jenny à gagner.</Dialogue>
          <button className="gi-btn-trait" onClick={onExamen}>
            Passer l’Examen
          </button>
        </>
      )}

      <section className="gi-case">
        <h2 className="sous-titre">Notifications</h2>
        {notifs.length === 0 ? (
          <p className="doux">Rien pour l’instant.</p>
        ) : (
          <ul className="fil">
            {notifs.map((n) => (
              <li key={n.n}>{n.texte}</li>
            ))}
          </ul>
        )}
      </section>

      {eveilDisponible() && (
        <label className="gi-case option">
          <input type="checkbox" checked={ecranAllume} onChange={(e) => onEcranAllume(e.target.checked)} />
          <span>
            <b>Garder l’écran allumé</b>
            <span className="doux"> Ta position reste à jour, mais la batterie se vide plus vite.</span>
          </span>
        </label>
      )}
    </div>
  );
}
