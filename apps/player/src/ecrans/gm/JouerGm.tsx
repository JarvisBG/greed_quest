// Jouer une carte de Maître du jeu (RG-8.19, RG-8.20) : choisir la carte du Décret ou le joueur à sceller (feuille qui
// monte du bas, comme la fiche), envoyer l'intention, puis jouer la cinématique avec la réponse du serveur (P1).
import type { PositionInput } from '@gq/shared';
import { Carte } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { texteJarvis, texteSceau, type CarteDecret, type ResultatGm } from '../../lib/cartesGm';
import { api } from '../../lib/client';
import type { CarteGmRecue } from '../../lib/livre';
import { CinematiqueGm, type CineGm } from './CinematiqueGm';

export function JouerGm({
  partieId,
  carte,
  positionAction,
  onFini,
}: {
  partieId: string;
  carte: CarteGmRecue;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  /** Fin (jouée ou abandonnée) : le Book et le profil se rechargent. */
  onFini: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const appuiFond = useRef(false);
  const [decret, setDecret] = useState<CarteDecret[] | null>(null);
  const [cibles, setCibles] = useState<{ id: string; pseudo: string }[] | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const [cine, setCine] = useState<CineGm | null>(null);
  const jarvis = carte.gm === 'jarvis';

  useEffect(() => {
    ref.current?.showModal();
    (jarvis
      ? api.get<{ cartes: CarteDecret[] }>(`/parties/${partieId}/cartes-gm/decret`).then((r) => setDecret(r.cartes))
      : api.get<{ joueurs: { id: string; pseudo: string }[] }>(`/parties/${partieId}/a-portee`).then((r) => setCibles(r.joueurs))
    ).catch((e: unknown) => setRefus(e instanceof Error ? e.message : String(e)));
  }, []);

  const jouer = async () => {
    if (!choix) return;
    setEnvoi(true);
    setRefus(null);
    try {
      const position = await positionAction();
      const corps = jarvis ? { gm: 'jarvis', itemId: carte.itemId, carteId: choix, position } : { gm: 'ange', itemId: carte.itemId, cibleId: choix, position };
      const r = await api.post<ResultatGm>(`/parties/${partieId}/cartes-gm/jouer`, corps);
      ref.current?.close();
      setCine(r.gm === 'jarvis' ? { kind: 'jarvis', carte: r.carte, reprisA: r.reprisA, figes: r.figes, texte: texteJarvis(r) } : { kind: 'sceau', cible: r.cible, texte: texteSceau(r.cible) });
    } catch (e) {
      // Refus du serveur affiché tel quel (RG-7.4).
      setRefus(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  if (cine) return <CinematiqueGm cine={cine} onFini={onFini} />;

  return (
    <dialog
      className="fiche choix-gm"
      ref={ref}
      aria-labelledby="choix-gm-titre"
      onClose={() => !cine && onFini()}
      onPointerDown={(e) => {
        appuiFond.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && appuiFond.current) ref.current?.close();
        appuiFond.current = false;
      }}
    >
      <div className="fiche-corps">
        <div className="fiche-info">
          <p className="gros" id="choix-gm-titre">
            {jarvis ? 'Décret de Jarvis' : 'Le Sceau d’Ange'}
          </p>
          <p>
            {jarvis
              ? 'Choisis la carte qui apparaîtra dans ton Book. Si elle est à sa limite, elle est reprise à un joueur qui l’a.'
              : 'Choisis le joueur dont le Book sera scellé pendant 5 minutes.'}
          </p>
        </div>
        {jarvis && decret && (
          <div className="grille">
            {decret.map((c) => (
              <button key={c.carteId} type="button" aria-pressed={choix === c.carteId} onClick={() => setChoix(c.carteId)}>
                <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} limite={c.limite} />
                {c.reprise && <span className="reprise">Limite atteinte : reprise</span>}
              </button>
            ))}
          </div>
        )}
        {jarvis && decret?.length === 0 && <p className="doux">Toutes les cartes désignées sont déjà dans ton Book (la SS ne peut pas être créée).</p>}
        {!jarvis && cibles && (
          <div className="cibles">
            {cibles.map((j) => (
              <button key={j.id} type="button" aria-pressed={choix === j.id} onClick={() => setChoix(j.id)}>
                {j.pseudo}
              </button>
            ))}
          </div>
        )}
        {!jarvis && cibles?.length === 0 && <p className="doux">Personne n’est à portée pour l’instant.</p>}
        {refus && (
          <p className="erreur" role="alert">
            {refus}
          </p>
        )}
        <div className="actions">
          <button className="gi-btn-encre" disabled={!choix || envoi} onClick={() => void jouer()}>
            {envoi ? 'Un instant…' : jarvis ? 'Jarvis a parlé' : 'Sceller son Book'}
          </button>
          <button className="gi-btn-trait" onClick={() => ref.current?.close()}>
            Annuler
          </button>
        </div>
      </div>
    </dialog>
  );
}
