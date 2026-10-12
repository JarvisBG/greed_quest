// Page ⑫ (prototype validé le 2026-10-12 : docs/prototype/echanges.html) : joueurs à portée, « Échanger » ou
// « Vendre une carte ». RG-11.1 amendé : A choisit B parmi les joueurs à portée (même rayon que les sorts) et propose.
// La vente est le même échange côté serveur (une carte contre des jenny), la carte et le prix posés dès la proposition.
// La suite (attente, appel, table, cinématique) se joue par-dessus l'app : SessionEchange, Trade.
import type { PositionInput } from '@gq/shared';
import { useEffect, useState } from 'react';
import { api } from '../../lib/client';
import { mesPieces, type VueEchange } from '../../lib/echanges';
import { useLivre } from '../../lib/useLivre';
import { Tiroir } from './SessionEchange';

interface Props {
  partieId: string;
  version: number;
  echange: VueEchange | null;
  recevoir: (e: VueEchange) => void;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
}

type Joueur = { id: string; pseudo: string };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Echanges({ partieId, version, echange, recevoir, positionAction }: Props) {
  const [joueurs, setJoueurs] = useState<Joueur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Proposition en route (la position GPS peut prendre quelques secondes) : à qui. */
  const [envoi, setEnvoi] = useState<string | null>(null);
  /** Joueur à qui l'on vend : le tiroir s'ouvre pour choisir la carte et le prix. */
  const [vendreA, setVendreA] = useState<Joueur | null>(null);
  const { livre } = useLivre(partieId, version);

  const charger = async () => {
    setErreur(null);
    try {
      await positionAction(true);
      setJoueurs((await api.get<{ joueurs: Joueur[] }>(`/parties/${partieId}/a-portee`)).joueurs);
    } catch (e) {
      setErreur(message(e));
    }
  };
  useEffect(() => {
    void charger();
    const t = setInterval(() => void charger(), 20_000);
    return () => clearInterval(t);
  }, []);

  const proposer = async (j: Joueur, vente?: { itemId: string; prix: number }) => {
    setErreur(null);
    setEnvoi(j.id);
    try {
      await api.post(`/parties/${partieId}/echanges`, { cibleId: j.id, position: await positionAction(), ...(vente ? { vente } : {}) });
      const r = await api.get<{ echange: VueEchange | null }>(`/parties/${partieId}/echanges/courant`);
      if (r.echange) recevoir(r.echange);
      setVendreA(null);
    } catch (e) {
      setErreur(message(e));
      setVendreA(null);
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <div className="planche">
      <div className="tete-page">
        <h1 className="titre-ecran">Échanges</h1>
      </div>
      <section className="gi-case ech-portee" aria-labelledby="ech-t-portee">
        <h2 className="sous-titre" id="ech-t-portee">
          Joueurs à portée
        </h2>
        {joueurs === null && !erreur && <p className="doux">Recherche des joueurs…</p>}
        {joueurs?.length === 0 && <p className="doux">Personne à portée pour l’instant. Approche-toi d’un joueur.</p>}
        {joueurs && joueurs.length > 0 && (
          <ul className="ech-joueurs">
            {joueurs.map((j) => (
              <li key={j.id} className="ech-joueur">
                <span className="tete" aria-hidden="true">
                  {j.pseudo.slice(0, 1).toUpperCase()}
                </span>
                <span className="qui">
                  <b>{j.pseudo}</b>
                </span>
                <span className="actions">
                  <button className="plein" disabled={!!envoi || !!echange} onClick={() => void proposer(j)}>
                    {envoi === j.id && !vendreA ? 'Envoi…' : 'Échanger'}
                  </button>
                  <button disabled={!!envoi || !!echange || !livre} onClick={() => setVendreA(j)}>
                    Vendre une carte
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {erreur && <p className="erreur">{erreur}</p>}
        <p className="doux ech-aide">Même portée que les sorts. Une part peut être des cartes, des objets, des jenny ou tout à la fois ; chacun doit donner quelque chose. Les sorts ne s’échangent pas.</p>
        <button className="gi-lien" onClick={() => void charger()}>
          Actualiser la liste
        </button>
      </section>
      {vendreA && livre && (
        <Tiroir
          titre={`Que vends-tu à ${vendreA.pseudo} ?`}
          pieces={mesPieces(livre, null)}
          choisies={[]}
          vente={{ pour: vendreA.pseudo, envoi: !!envoi, onProposer: (itemId, prix) => void proposer(vendreA, { itemId, prix }) }}
          onFermer={() => setVendreA(null)}
        />
      )}
    </div>
  );
}
