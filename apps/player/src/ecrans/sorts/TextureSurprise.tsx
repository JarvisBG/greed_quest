// RG-5.4 Transformation : Texture Surprise (pouvoir de Nen). Écran gardé de la version précédente, à refaire avec la
// page ⑩ (pouvoirs de Nen et de Spécialisation) ; habillé par `.ancien` en attendant.
import type { Rank } from '@gq/shared';
import { useEffect, useState } from 'react';
import { api } from '../../lib/client';
import { NENS, numeroCarte } from '../../lib/format';
import type { EmplacementCarte, LivreRecu } from '../../lib/livre';
import { doublons } from '../../lib/sorts';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
export function TextureSurprise({ partieId, livre, onAnnuler, onFini }: { partieId: string; livre: LivreRecu; onAnnuler: () => void; onFini: (t: string) => void }) {
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

