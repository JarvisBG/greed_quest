// RG-10 : sorts du Livre. Cibles calculées par le serveur (RG-10.1 « à portée », pseudos seulement,
// RG-10.12) ; Radar et Émission visent n'importe quel joueur. RG-5.4 : pouvoirs de Nen
// (Émission, Manipulation, Texture Surprise). Chaque intention porte la position (RG-10.9).
import type { PositionInput, Rank } from '@gq/shared';
import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { formatDuree, NENS, numeroCarte, SORTS, titrePage } from '../lib/format';
import { contenu, type EmplacementCarte, type LivreRecu } from '../lib/livre';
import { useLivre } from '../lib/useLivre';
import {
  cartesUtilisables,
  corpsSort,
  doublons,
  etapes,
  OFFENSIF,
  pouvoirDispo,
  resumeSort,
  sortsDisponibles,
  type ChoixSort,
  type ReponseSort,
} from '../lib/sorts';
import type { Moi } from '../lib/useJeu';

interface Props {
  partieId: string;
  moi: Moi;
  version: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  apresAction: () => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Délai restant, décompté depuis la réception du profil. */
function useRestant(ms: number, depuis: number): number {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    if (ms - (Date.now() - depuis) <= 0) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ms, depuis]);
  return Math.max(0, ms - (maintenant - depuis));
}

export function Sorts(p: Props) {
  const { livre, erreur } = useLivre(p.partieId, p.version);
  const [choix, setChoix] = useState<ChoixSort | null>(null);
  const [transfo, setTransfo] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  const offensifDans = useRestant(p.moi.delais.offensif, p.moi.recuA);
  const transfoDans = useRestant(p.moi.delais.transformation, p.moi.recuA);

  if (!livre) return <p className="info">{erreur ?? 'Chargement…'}</p>;
  const fin = (texte: string) => {
    setChoix(null);
    setTransfo(false);
    setResultat(texte);
    p.apresAction();
  };

  if (choix) return <Lancement {...p} livre={livre} choix={choix} onAnnuler={() => setChoix(null)} onFini={fin} />;
  if (transfo) return <TextureSurprise partieId={p.partieId} livre={livre} onAnnuler={() => setTransfo(false)} onFini={fin} />;

  const dispo = sortsDisponibles(livre);
  const ecoule = Date.now() - p.moi.recuA;
  const emission = pouvoirDispo(p.moi.nen, p.moi.delais.pouvoir, ecoule, 'emission');
  const manipulation = pouvoirDispo(p.moi.nen, p.moi.delais.pouvoir, ecoule, 'manipulation');
  return (
    <div className="sorts">
      {resultat && (
        <div className="carte resultat">
          <p>{resultat}</p>
          <button className="secondaire" onClick={() => setResultat(null)}>
            OK
          </button>
        </div>
      )}
      {offensifDans > 0 && <p className="info">Prochain sort offensif possible dans {formatDuree(offensifDans)} (RG-10.3).</p>}
      {emission && <p className="info">Émission : tu peux viser une fois un joueur hors de portée avec un sort offensif.</p>}
      {dispo.length === 0 && !manipulation && <p className="info">Aucun sort dans ton Livre. Les balises en donnent parfois.</p>}
      <ul className="liste-sorts">
        {dispo.map((d) => (
          <li key={d.sort} className="carte">
            <div>
              <strong>{SORTS[d.sort].nom}</strong> {d.itemIds.length > 1 && <span className="info">×{d.itemIds.length}</span>}
              <div className="detail info">{SORTS[d.sort].effet}</div>
            </div>
            {d.sort === 'barriere' ? (
              <span className="info">Passif</span>
            ) : (
              <button disabled={OFFENSIF.includes(d.sort) && offensifDans > 0} onClick={() => setChoix({ sort: d.sort, itemId: d.itemIds[0]! })}>
                Lancer
              </button>
            )}
          </li>
        ))}
        {manipulation && (
          <li className="carte">
            <div>
              <strong>Échange forcé gratuit</strong>
              <div className="detail info">Pouvoir de Manipulation, une fois par partie.</div>
            </div>
            <button disabled={offensifDans > 0} onClick={() => setChoix({ sort: 'echange_force', itemId: null })}>
              Utiliser
            </button>
          </li>
        )}
        {p.moi.nen === 'transformation' && (
          <li className="carte">
            <div>
              <strong>Texture Surprise</strong>
              <div className="detail info">{NENS.transformation.passif}</div>
            </div>
            <button disabled={transfoDans > 0} onClick={() => setTransfo(true)}>
              {transfoDans > 0 ? formatDuree(transfoDans) : 'Utiliser'}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function Lancement({
  partieId,
  moi,
  livre,
  choix: depart,
  positionAction,
  onAnnuler,
  onFini,
}: Props & { livre: LivreRecu; choix: ChoixSort; onAnnuler: () => void; onFini: (texte: string) => void }) {
  const [choix, setChoix] = useState(depart);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [cibles, setCibles] = useState<{ joueurs: Cible[]; tous: Cible[] } | null>(null);
  const sort = SORTS[choix.sort];
  const reste = etapes(choix.sort).find((e) => (e === 'carte' ? !choix.carteItemId : e === 'page' ? !choix.page : !choix.cibleId));
  const emissionPossible = OFFENSIF.includes(choix.sort) && pouvoirDispo(moi.nen, moi.delais.pouvoir, Date.now() - moi.recuA, 'emission');

  // Liste des cibles : la position est d'abord envoyée pour que le serveur calcule la portée à jour.
  const chargerCibles = async () => {
    setErreur(null);
    setCibles(null);
    try {
      await positionAction(true);
      setCibles(await api.get<{ joueurs: Cible[]; tous: Cible[] }>(`/parties/${partieId}/a-portee`));
    } catch (e) {
      setErreur(message(e));
    }
  };
  useEffect(() => {
    if (reste === 'cible' && !cibles) void chargerCibles();
  }, [reste]);

  const lancer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<ReponseSort>(`/parties/${partieId}/sort`, corpsSort(choix, await positionAction()));
      const noms = new Map(contenu(livre).map((e) => [e.itemId, e.kind === 'carte' ? e.nom : SORTS[e.sort].nom]));
      onFini(resumeSort(r, nomCible, (id) => noms.get(id) ?? 'une carte'));
    } catch (e) {
      setErreur(message(e));
      setEnvoi(false);
    }
  };

  const titre = choix.itemId === null ? 'Échange forcé gratuit' : sort.nom;
  const nomCible = cibles?.tous.find((c) => c.id === choix.cibleId)?.pseudo ?? null;
  return (
    <div className="carte lancement">
      <h1>{titre}</h1>
      <p className="info">{sort.effet}</p>
      {reste === 'carte' && (
        <ChoixCarte
          titre={choix.sort === 'duplication' ? 'Carte à copier' : 'Carte que tu donnes'}
          cartes={cartesUtilisables(livre)}
          onChoix={(id) => setChoix({ ...choix, carteItemId: id })}
        />
      )}
      {reste === 'page' && (
        <>
          <p>Page à analyser :</p>
          <div className="choix">
            {livre.pages.map((_, i) => (
              <button key={i} className="secondaire" onClick={() => setChoix({ ...choix, page: i + 1 })}>
                {titrePage(i, livre.total)}
              </button>
            ))}
          </div>
        </>
      )}
      {reste === 'cible' && (
        <>
          {emissionPossible && (
            <label className="case">
              <input type="checkbox" checked={!!choix.emission} onChange={(e) => setChoix({ ...choix, emission: e.target.checked })} />
              Utiliser Émission : viser un joueur hors de portée (une fois par partie)
            </label>
          )}
          <ChoixCible
            cibles={cibles ? (choix.sort === 'radar' || choix.emission ? cibles.tous : cibles.joueurs) : null}
            vide={choix.sort === 'radar' ? 'Aucun autre joueur.' : 'Personne à portée (30 m environ). Rapproche-toi.'}
            onChoix={(id) => setChoix({ ...choix, cibleId: id })}
            onActualiser={() => void chargerCibles()}
          />
        </>
      )}
      {!reste && (
        <button disabled={envoi} onClick={() => void lancer()}>
          {envoi ? 'Lancement…' : `Lancer ${titre}${nomCible ? ` sur ${nomCible}` : ''}`}
        </button>
      )}
      {erreur && <p className="erreur">{erreur}</p>}
      <button className="lien" onClick={onAnnuler}>
        Annuler
      </button>
    </div>
  );
}

interface Cible {
  id: string;
  pseudo: string;
}

function ChoixCible({ cibles, vide, onChoix, onActualiser }: { cibles: Cible[] | null; vide: string; onChoix: (id: string) => void; onActualiser: () => void }) {
  if (!cibles) return <p className="info">Recherche des joueurs…</p>;
  return (
    <>
      <p>Cible :</p>
      {cibles.length === 0 && <p className="info">{vide}</p>}
      <div className="choix">
        {cibles.map((c) => (
          <button key={c.id} className="secondaire" onClick={() => onChoix(c.id)}>
            {c.pseudo}
          </button>
        ))}
      </div>
      <button className="lien" onClick={onActualiser}>
        Actualiser la liste
      </button>
    </>
  );
}

function ChoixCarte({ titre, cartes, onChoix }: { titre: string; cartes: EmplacementCarte[]; onChoix: (itemId: string) => void }) {
  return (
    <>
      <p>{titre} :</p>
      {cartes.length === 0 && <p className="info">Aucune carte disponible.</p>}
      <div className="choix">
        {cartes.map((c) => (
          <button key={c.itemId} className="secondaire" onClick={() => onChoix(c.itemId)}>
            {numeroCarte(c.numero)} {c.nom} {c.rang && <span className={`rang r${c.rang}`}>{c.rang}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

/** RG-5.4 Transformation : un doublon prend l'apparence d'une autre carte de même rang (contrefaçon). */
function TextureSurprise({ partieId, livre, onAnnuler, onFini }: { partieId: string; livre: LivreRecu; onAnnuler: () => void; onFini: (t: string) => void }) {
  const [doublon, setDoublon] = useState<EmplacementCarte | null>(null);
  const [catalogue, setCatalogue] = useState<{ id: string; numero: number; nom: string; rang: Rank }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    api.get<{ cartes: { id: string; numero: number; nom: string; rang: Rank }[] }>(`/parties/${partieId}/cartes`).then(
      (r) => setCatalogue(r.cartes),
      (e: unknown) => setErreur(message(e)),
    );
  }, [partieId]);

  const transformer = async (cibleCarteId: string, nom: string) => {
    try {
      await api.post(`/parties/${partieId}/transformation`, { itemId: doublon!.itemId, cibleCarteId });
      onFini(`Ton doublon ${doublon!.nom} a maintenant l’apparence de ${nom}. Pour les autres, c’est une vraie carte.`);
    } catch (e) {
      setErreur(message(e));
    }
  };

  return (
    <div className="carte lancement">
      <h1>Texture Surprise</h1>
      <p className="info">{NENS.transformation.passif}</p>
      {!doublon ? (
        <ChoixCarte titre="Doublon à déguiser" cartes={doublons(livre)} onChoix={(id) => setDoublon(doublons(livre).find((c) => c.itemId === id) ?? null)} />
      ) : (
        <>
          <p>Apparence à prendre (rang {doublon.rang}) :</p>
          <div className="choix">
            {(catalogue ?? [])
              .filter((c) => c.rang === doublon.rang && c.id !== doublon.carteId)
              .map((c) => (
                <button key={c.id} className="secondaire" onClick={() => void transformer(c.id, c.nom)}>
                  {numeroCarte(c.numero)} {c.nom}
                </button>
              ))}
          </div>
        </>
      )}
      {erreur && <p className="erreur">{erreur}</p>}
      <button className="lien" onClick={onAnnuler}>
        Annuler
      </button>
    </div>
  );
}

