// Case « L'île » de l'accueil : petite carte (toucher pour l'agrandir) et accès directs aux villes (children).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { construirePlan, type ZoneRecue } from '../../lib/carte';
import { api } from '../../lib/client';
import { DessinCarte, type EvenementZone } from './CarteIle';
import { CartePleine } from './CartePleine';

/** Zones et balises actives par zone, rechargées à chaque évènement reçu et toutes les minutes. */
function useCarte(partieId: string, version: number) {
  const [carte, setCarte] = useState<{
    zones: ZoneRecue[];
    balisesParZone: Record<string, number>;
  } | null>(null);
  const [tic, setTic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!partieId) return;
    api.get<{ zones: ZoneRecue[]; balisesParZone: Record<string, number> }>(`/parties/${partieId}/carte`).then(setCarte, () => undefined);
  }, [partieId, version, tic]);
  return carte;
}

export function CaseCarte({
  partieId,
  version,
  position,
  evenements,
  children,
}: {
  partieId: string;
  version: number;
  position: { lat: number; lng: number; precisionM: number } | null;
  evenements: readonly EvenementZone[];
  children: ReactNode;
}) {
  const carte = useCarte(partieId, version);
  const [ouverte, setOuverte] = useState(false);
  const mini = useRef<HTMLButtonElement>(null);
  // Position arrondie à ~1 m : le plan n'est recalculé que si tu bouges vraiment.
  const cle = position ? `${position.lat.toFixed(5)},${position.lng.toFixed(5)},${Math.round(position.precisionM)}` : '';
  const plan = useMemo(
    () => (carte ? construirePlan(carte.zones, carte.balisesParZone, position) : null),
    [carte, cle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const total = plan ? plan.zones.reduce((s, z) => s + z.balises, 0) : 0;

  return (
    <section className="gi-case case-carte" aria-labelledby="titre-ile">
      <div className="carte-tete">
        <h2 id="titre-ile" className="sous-titre">
          L’île
        </h2>
        {plan && plan.zones.length > 0 && (
          <span className="doux">
            {total} balise{total > 1 ? 's' : ''} active{total > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {plan && plan.zones.length > 0 && (
        <button
          ref={mini}
          className="carte-mini"
          style={{
            aspectRatio: `${plan.largeur} / ${Math.min(plan.hauteur, plan.largeur * 1.1)}`,
          }}
          onClick={() => setOuverte(true)}
          aria-label={`Agrandir la carte de l’île. ${plan.zones.map((z) => `${z.nom} : ${z.balises} balise${z.balises > 1 ? 's' : ''} active${z.balises > 1 ? 's' : ''}`).join(', ')}.`}
        >
          <svg viewBox={`0 0 ${plan.largeur} ${plan.hauteur}`} aria-hidden="true">
            <DessinCarte plan={plan} evenements={evenements} p="mi" />
          </svg>
          <span className="agrandir" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
            </svg>
          </span>
        </button>
      )}
      {children}
      {ouverte && plan && <CartePleine plan={plan} evenements={evenements} onFermer={() => {
            setOuverte(false);
            mini.current?.focus({ preventScroll: true });
          }} />}
    </section>
  );
}
