// Dessin de la carte de l'île (prototype v3 validé le 2026-10-17 : docs/prototype/carte-ile-v3.html ; v1 du
// 2026-10-10 pour le parchemin). L'île est tirée des zones (@gq/ui/ile) : mer et côte, territoires qui se touchent
// peints au lavis, frontières en pointillé qui ondulent, trame selon le nombre de balises actives (RG-6.5), icône et
// nom de chaque zone, évènements de zone, ta position « Tu es ici » (RG-10.12). Le même dessin sert à l'accueil, à
// la carte agrandie et aux cinématiques des sorts d'information.
import { ICONES_ZONE as ICONES } from '@gq/ui/ile';
import type { Plan, TypeZone, ZonePlan } from '../../lib/carte';

export interface EvenementZone {
  zoneId: string;
  texte: string;
}

/** Fiche d'une zone (carte agrandie) : ce qu'on y fait, en clair. */
export const INFOS_ZONE: Record<TypeZone, { titre: string; texte: string }> = {
  masadora: { titre: 'Boutique de sorts', texte: 'Achète des paquets de sorts avec tes jenny. Scanne le QR de la boutique, sur place.' },
  antokiba: { titre: 'Salle des enchères', texte: 'Mise tes jenny sur des cartes rares. Scanne le QR de la salle pour entrer.' },
  soufrabi: { titre: 'Arène', texte: 'Mise des jenny et affronte un PNJ : la victoire rapporte gros.' },
  sauvage: { titre: 'Zone de chasse', texte: 'Des balises QR y sont cachées. Trouve-les et scanne-les pour tirer des cartes.' },
};

export function IconeZone({ type, r = 13 }: { type: TypeZone; r?: number }) {
  return (
    <>
      <circle r={r} className="ville-rond" />
      <path d={ICONES[type]} className="ville-trait" />
    </>
  );
}

/** Trames, plume, lavis et dérive : `p` préfixe les identifiants (plusieurs cartes peuvent être dans la page). */
export function DefsCarte({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}t1`} width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="6" cy="6" r="1" fill="#1b150c" opacity=".55" />
      </pattern>
      <pattern id={`${p}t2`} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.35" fill="#1b150c" opacity=".6" />
      </pattern>
      <pattern id={`${p}t3`} width="4.5" height="4.5" patternUnits="userSpaceOnUse">
        <circle cx="2.25" cy="2.25" r="1.75" fill="#1b150c" opacity=".78" />
      </pattern>
      <pattern id={`${p}ev`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0v8" stroke="#a8231f" strokeWidth="2.4" opacity=".55" />
      </pattern>
      <filter id={`${p}plume`} x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves={2} seed={4} />
        <feDisplacementMap in="SourceGraphic" scale="3" />
      </filter>
      {/* Grain d'aquarelle : la couleur passe par un masque de bruit. */}
      <filter id={`${p}lavis`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".045 .06" numOctaves={3} seed={9} result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="a" />
        <feComposite in="SourceGraphic" in2="a" operator="in" />
      </filter>
      {/* Dérive : fait onduler territoires et frontières (des zones alignées ne donnent plus une grille). */}
      <filter id={`${p}derive`} x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency=".013" numOctaves={2} seed={11} />
        <feDisplacementMap in="SourceGraphic" scale="28" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  );
}

/** Où poser l'étiquette d'une zone : à son centre, sauf si ton épingle et sa plaque la cacheraient. */
function placeEtiquette(z: ZonePlan, moi: Plan['moi']): { x: number; y: number; decale: boolean } {
  const [cx, cy] = z.centre;
  if (!moi) return { x: cx, y: cy, decale: false };
  const decale = Math.abs(moi.x - cx) < 42 && moi.y - cy > -24 && moi.y - cy < 64;
  if (!decale) return { x: cx, y: cy, decale };
  const haut = Math.min(...z.points.map((q) => q[1]));
  const bas = Math.max(...z.points.map((q) => q[1]));
  // Épingle et plaque occupent de moi.y - 58 à moi.y + 6 : dessous s'il y a la place, sinon au-dessus de la plaque.
  return { x: cx, y: moi.y + 32 <= bas ? moi.y + 32 : moi.y - 92 >= haut ? moi.y - 92 : moi.y + 32, decale };
}

/**
 * `comptes` : pastilles des balises (pas dans les cinématiques de sort) ; `moi` : ta position (le suivi la dessine
 * lui-même) ; `choisie` : la zone touchée (les autres pâlissent) ; `guide` : la zone vers laquelle on te guide.
 */
export function DessinCarte({
  plan,
  evenements,
  p,
  comptes = true,
  moi = true,
  choisie = null,
  guide = null,
  interactive = false,
  rose = true,
}: {
  plan: Plan;
  evenements: readonly EvenementZone[];
  p: string;
  comptes?: boolean;
  moi?: boolean;
  choisie?: string | null;
  guide?: string | null;
  /** Zones focalisables au clavier (carte agrandie). */
  interactive?: boolean;
  /** Rose des vents dans le dessin (la carte agrandie a la sienne, fixe pendant le zoom). */
  rose?: boolean;
}) {
  const ile = plan.ile;
  const W = plan.largeur;
  const H = plan.hauteur;
  const zGuide = guide ? plan.zones.find((z) => z.id === guide) : undefined;
  return (
    <>
      <DefsCarte p={p} />
      <rect className="mer-fond" x={-200} y={-200} width={W + 400} height={H + 400} />
      {ile && (
        <>
          <clipPath id={`${p}ile`}>
            <path d={ile.littoral} />
          </clipPath>
          {/* Lignes d'eau gravées : traits épais de la côte recouverts de mer, du large vers le rivage. */}
          <g className="ondes">
            {[30, 20, 11].map((w, i) => (
              <g key={w}>
                <path d={ile.littoral} className="cotes-ondes" strokeWidth={w} opacity={0.16 + i * 0.06} />
                <path d={ile.littoral} className="cotes-mer" strokeWidth={w - 1.6} />
              </g>
            ))}
          </g>
          <g className="vagues">
            {ile.vagues.map(([x, y], i) => (
              <path key={i} className="vague" d={`M${(x - 9).toFixed(1)} ${y.toFixed(1)}q4.5 -4 9 0t9 0`} />
            ))}
          </g>
          {ile.ilots.map(([x, y, s], i) => (
            <ellipse key={i} className="ilot" cx={x} cy={y} rx={s} ry={s * 0.7} filter={`url(#${p}plume)`} />
          ))}
          <g className="cartouche" transform="translate(30 24)">
            <text>GREED ISLAND</text>
            <path d="M0 7h104" />
          </g>
          <path className="terre" d={ile.littoral} />
          <g clipPath={`url(#${p}ile)`}>
            <g filter={`url(#${p}derive)`}>
              {plan.zones.map((z, i) => {
                const ev = evenements.some((e) => e.zoneId === z.id);
                const t = ile.territoires[i]!;
                return (
                  <g key={z.id} className="terr zone-terr" data-zone={z.id}>
                    {/* Trait de la même couleur pour fermer les coutures entre cellules ; transparence sur le groupe. */}
                    <g opacity=".62" filter={`url(#${p}lavis)`}>
                      <path className="terr-lavis" d={t} fill={ile.lavis[i]} stroke={ile.lavis[i]} />
                    </g>
                    {comptes && z.niveau > 0 && <path d={t} fill={`url(#${p}t${z.niveau})`} />}
                    {ev && <path className="terr-ev" d={t} fill={`url(#${p}ev)`} />}
                    {choisie && choisie !== z.id && <path className="terr-voile" d={t} />}
                  </g>
                );
              })}
              <g className="frontieres">
                <path className="frontiere-ombre" d={ile.frontieres} />
                <path className="frontiere" d={ile.frontieres} />
              </g>
            </g>
          </g>
          <path className="cote" d={ile.littoral} filter={`url(#${p}plume)`} />
        </>
      )}
      {plan.zones.map((z) => {
        const ev = evenements.find((e) => e.zoneId === z.id);
        const { x, y, decale } = placeEtiquette(z, moi ? plan.moi : null);
        const w = z.balises >= 10 ? 34 : 28;
        const bas = Math.max(...z.points.map((q) => q[1]));
        const largeurEv = ev ? ev.texte.length * 5.6 + 12 : 0;
        return (
          <g
            key={z.id}
            className={`zone zone-etiq${ev ? ' zone-ev' : ''}${choisie === z.id ? ' zone-choisie' : ''}`}
            data-zone={z.id}
            {...(interactive ? { tabIndex: 0, role: 'button', 'aria-label': `${z.nom}, ${z.balises} balise${z.balises > 1 ? 's' : ''} active${z.balises > 1 ? 's' : ''}` } : {})}
          >
            <g transform={`translate(${x.toFixed(1)} ${(y - 4).toFixed(1)})`}>
              <g className="zone-label">
                {/* Étiquette déplacée près de ton épingle : sans icône, elle la toucherait. */}
                {!decale && (
                  <g transform="translate(0 -24)">
                    <IconeZone type={z.type} />
                  </g>
                )}
                <text className="zone-nom" textAnchor="middle" y="4">
                  {z.nom}
                </text>
                {comptes && (
                  <g className={`zone-compte${z.balises ? '' : ' vide'}`} transform="translate(0 11)">
                    <rect x={-w / 2} width={w} height="17" rx="2" />
                    <path className="ond" d={`M${-w / 2 + 6} 11.5a3.5 3.5 0 0 1 7 0M${-w / 2 + 7.8} 11.5a1.7 1.7 0 0 1 3.4 0`} />
                    <text x={w / 2 - 5} textAnchor="end" y="13">
                      {z.balises}
                    </text>
                  </g>
                )}
              </g>
            </g>
            {ev && (
              <g className="ev-etiquette" transform={`translate(${(z.centre[0] - largeurEv / 2).toFixed(1)} ${(bas - 8).toFixed(1)})`}>
                <rect width={largeurEv} height="17" />
                <text x="6" y="12.5">
                  {ev.texte}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {moi && plan.moi && zGuide && <path className="guide-trait" d={`M${plan.moi.x.toFixed(1)} ${plan.moi.y.toFixed(1)}L${zGuide.centre[0].toFixed(1)} ${zGuide.centre[1].toFixed(1)}`} />}
      {moi && plan.moi && (
        <g transform={`translate(${plan.moi.x} ${plan.moi.y})`}>
          <g className="moi">
            <circle className="moi-halo" r={plan.moi.r} />
            {/* Trois pulsations à chaque nouvelle position, puis repos : une animation sans fin dans ce SVG le ferait
                redessiner en entier (filtres de l'île compris) 60 fois par seconde, ce qui rame sur un téléphone d'entrée de gamme. */}
            <circle key={`${Math.round(plan.moi.x)} ${Math.round(plan.moi.y)}`} className="moi-onde" r="9" />
            <path className="moi-epingle" d="M0 0C-3 -5 -10 -11 -10 -19a10 10 0 1 1 20 0c0 8 -7 14 -10 19z" />
            <circle cy="-19" r="4" fill="#fff" />
            <g className="moi-plaque" transform="translate(0 -44)">
              <rect x="-33" y="-11" width="66" height="21" rx="3" />
              <text textAnchor="middle" y="4">
                Tu es ici
              </text>
            </g>
          </g>
        </g>
      )}
      {rose && (
      <g transform={`translate(${(W - 26).toFixed(1)} ${(H - 30).toFixed(1)})`} className="rose">
        <path d="M0 -14 4 0 0 14 -4 0z" fill="#1b150c" />
        <path d="M0 -14 4 0 -4 0z" fill="#f6edd3" stroke="#1b150c" strokeWidth="1" />
        <text y="-18" textAnchor="middle">
          N
        </text>
      </g>
      )}
    </>
  );
}

/** Épingle de « Tu es dans … » (bandeaux de l'accueil et de la carte agrandie). */
export function EpingleTexte() {
  return (
    <svg className="epingle" viewBox="-11 -31 22 32" aria-hidden="true">
      <path d="M0 0C-3 -5 -10 -11 -10 -19a10 10 0 1 1 20 0c0 8 -7 14 -10 19z" fill="#1f4a9c" stroke="#fff" strokeWidth="2" />
      <circle cy="-19" r="4" fill="#fff" />
    </svg>
  );
}
