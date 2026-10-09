// RG-11.1 amendé : échange « à la Pokémon ». A choisit B parmi les joueurs à portée et propose ;
// B accepte ou refuse (60 s) ; chacun compose sa part en voyant celle de l'autre ; l'échange n'a lieu
// que si les deux valident (toute modification annule les validations). RG-11.2 / 11.3 / 11.6 côté serveur.
import type { PositionInput } from '@gq/shared';
import { useEffect, useState } from 'react';
import { api } from '../lib/client';
import { cartesEchangeables, partVide, resumePart, type Part, type VueEchange } from '../lib/echanges';
import { numeroCarte } from '../lib/format';
import type { LivreRecu } from '../lib/livre';
import { useLivre } from '../lib/useLivre';

interface Props {
  partieId: string;
  jenny: number;
  version: number;
  echange: VueEchange | null;
  setEchange: (e: VueEchange | null) => void;
  finEchange: string | null;
  fermerFinEchange: () => void;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Echanges(p: Props) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /** Action sur la session : la réponse contient la session à jour. */
  const agir = async (url: string, corps: Record<string, unknown> = {}) => {
    if (!p.echange) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ echange: VueEchange }>(`/parties/${p.partieId}/echanges/${p.echange.id}/${url}`, corps);
      p.setEchange(r.echange.etat === 'invitation' || r.echange.etat === 'composition' ? r.echange : null);
    } catch (e) {
      setErreur(message(e));
    } finally {
      setEnvoi(false);
    }
  };

  const e = p.echange;
  return (
    <div className="echanges">
      {p.finEchange && (
        <div className="carte resultat">
          <p>{p.finEchange}</p>
          <button className="secondaire" onClick={p.fermerFinEchange}>
            OK
          </button>
        </div>
      )}
      {!e && <Proposer {...p} />}
      {e?.etat === 'invitation' && e.invite && (
        <div className="carte">
          <h1>{e.avec.pseudo} te propose un échange</h1>
          <p className="info">Accepte pour composer l’échange ensemble. Rien n’est échangé sans vos deux validations.</p>
          <button disabled={envoi} onClick={() => void agir('reponse', { accepte: true })}>
            Accepter
          </button>
          <button className="secondaire" disabled={envoi} onClick={() => void agir('reponse', { accepte: false })}>
            Refuser
          </button>
        </div>
      )}
      {e?.etat === 'invitation' && !e.invite && (
        <div className="carte">
          <h1>En attente de {e.avec.pseudo}…</h1>
          <p className="info">Ta proposition expire au bout d’une minute sans réponse.</p>
          <button className="secondaire" disabled={envoi} onClick={() => void agir('annuler')}>
            Annuler
          </button>
        </div>
      )}
      {e?.etat === 'composition' && <Composition {...p} echange={e} envoi={envoi} agir={agir} />}
      {erreur && <p className="erreur">{erreur}</p>}
    </div>
  );
}

function Proposer({ partieId, positionAction, setEchange }: Props) {
  const [joueurs, setJoueurs] = useState<{ id: string; pseudo: string }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = async () => {
    setErreur(null);
    setJoueurs(null);
    try {
      await positionAction(true);
      setJoueurs((await api.get<{ joueurs: { id: string; pseudo: string }[] }>(`/parties/${partieId}/a-portee`)).joueurs);
    } catch (e) {
      setErreur(message(e));
    }
  };
  useEffect(() => {
    void charger();
  }, []);

  const proposer = async (cibleId: string) => {
    setErreur(null);
    try {
      await api.post(`/parties/${partieId}/echanges`, { cibleId, position: await positionAction() });
      const r = await api.get<{ echange: VueEchange | null }>(`/parties/${partieId}/echanges/courant`);
      setEchange(r.echange);
    } catch (e) {
      setErreur(message(e));
    }
  };

  return (
    <div className="carte">
      <h1>Proposer un échange</h1>
      <p className="info">Choisis un joueur près de toi (même portée que les sorts).</p>
      {!joueurs && !erreur && <p className="info">Recherche des joueurs…</p>}
      {joueurs?.length === 0 && <p className="info">Personne à portée pour l’instant.</p>}
      <div className="choix">
        {joueurs?.map((j) => (
          <button key={j.id} className="secondaire" onClick={() => void proposer(j.id)}>
            {j.pseudo}
          </button>
        ))}
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
      <button className="lien" onClick={() => void charger()}>
        Actualiser la liste
      </button>
    </div>
  );
}

function Composition({
  partieId,
  jenny,
  version,
  echange: e,
  envoi,
  agir,
}: Props & { echange: VueEchange; envoi: boolean; agir: (url: string, corps?: Record<string, unknown>) => Promise<void> }) {
  const { livre } = useLivre(partieId, version);
  const [edition, setEdition] = useState(false);
  return (
    <div className="carte composition">
      <h1>Échange avec {e.avec.pseudo}</h1>
      <section>
        <h2>
          Tu donnes {e.jeValide && <span className="ok">✓ validé</span>}
        </h2>
        {edition && livre ? (
          <EditionPart livre={livre} part={e.maPart} jennyMax={jenny} onAnnuler={() => setEdition(false)} onEnvoyer={async (itemIds, j) => {
            await agir('offre', { itemIds, jenny: j });
            setEdition(false);
          }} />
        ) : (
          <>
            <ListePart part={e.maPart} />
            <button className="secondaire" disabled={envoi} onClick={() => setEdition(true)}>
              Modifier ma part
            </button>
          </>
        )}
      </section>
      <section>
        <h2>
          {e.avec.pseudo} donne {e.ilValide && <span className="ok">✓ validé</span>}
        </h2>
        <ListePart part={e.sonPart} />
      </section>
      {!edition && (
        <>
          {(partVide(e.maPart) || partVide(e.sonPart)) && <p className="info">Chacun doit donner au moins une carte ou des jenny.</p>}
          <button disabled={envoi || e.jeValide || partVide(e.maPart) || partVide(e.sonPart)} onClick={() => void agir('valider')}>
            {e.jeValide ? `En attente de ${e.avec.pseudo}…` : 'Je valide l’échange'}
          </button>
          <button className="lien" disabled={envoi} onClick={() => void agir('annuler')}>
            Annuler l’échange
          </button>
        </>
      )}
    </div>
  );
}

function ListePart({ part }: { part: Part }) {
  return <p>{resumePart(part)}</p>;
}

function EditionPart({
  livre,
  part,
  jennyMax,
  onAnnuler,
  onEnvoyer,
}: {
  livre: LivreRecu;
  part: Part;
  jennyMax: number;
  onAnnuler: () => void;
  onEnvoyer: (itemIds: string[], jenny: number) => Promise<void>;
}) {
  const [choisies, setChoisies] = useState(() => new Set(part.cartes.map((c) => c.itemId)));
  const [jenny, setJenny] = useState(String(part.jenny));
  const montant = Math.max(0, Math.floor(Number(jenny) || 0));
  const cartes = cartesEchangeables(livre, part);
  return (
    <div className="edition">
      {cartes.length === 0 && <p className="info">Aucune carte à proposer.</p>}
      <ul className="emplacements">
        {cartes.map((c) => (
          <li key={c.itemId} className="emplacement">
            <label className="case">
              <input
                type="checkbox"
                checked={choisies.has(c.itemId)}
                onChange={(ev) => {
                  const n = new Set(choisies);
                  if (ev.target.checked) n.add(c.itemId);
                  else n.delete(c.itemId);
                  setChoisies(n);
                }}
              />
              <span>
                <span className="numero">{numeroCarte(c.numero)}</span> {c.nom} {c.rang && <span className={`rang r${c.rang}`}>{c.rang}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label>
        Jenny (tu as {jennyMax} J)
        <input inputMode="numeric" value={jenny} onChange={(ev) => setJenny(ev.target.value.replace(/\D/g, ''))} />
      </label>
      {montant > jennyMax && <p className="erreur">Tu n’as pas assez de jenny.</p>}
      <button disabled={montant > jennyMax} onClick={() => void onEnvoyer([...choisies], montant)}>
        Proposer cette part
      </button>
      <button className="lien" onClick={onAnnuler}>
        Annuler
      </button>
    </div>
  );
}
