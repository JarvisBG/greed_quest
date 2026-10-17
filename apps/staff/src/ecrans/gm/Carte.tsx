// Carte du GM : zones (contours), balises posées (couleur selon l'état) et positions exactes des joueurs
// (RG-10.12 : GM seulement, jamais envoyées aux joueurs ni à l'écran géant). Rechargée à chaque évènement
// `position` ou `balises` reçu (au plus toutes les 3 s).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/client';
import { libelleStatut, type JoueurVue } from '../../lib/format';
import type { Equipe } from '../../lib/useEquipe';
import { CarteReelle, type PointSurCarte } from './CarteReelle';

interface LatLng {
  lat: number;
  lng: number;
}
interface ZoneCarte {
  id: string;
  nom: string;
  type: string;
  polygone: LatLng[];
}
interface BaliseCarte {
  id: string;
  libelle: string;
  etat: string;
  position: LatLng | null;
}
interface PositionJoueur extends LatLng {
  joueurId: string;
  pseudo: string;
  statut: JoueurVue['statut'];
  precisionM?: number;
}

const LARGEUR = 1000;
const COULEURS_ZONE: Record<string, string> = { sauvage: '#4ade80', masadora: '#ffc94a', antokiba: '#8b5cf6', soufrabi: '#fb5b5b' };
const COULEURS_BALISE: Record<string, string> = { active: '#22e7e7', dormante: '#6b6b78', epuisee: '#7cc4f0', coupee: '#fb5b5b' };
const COULEURS_JOUEUR: Record<string, string> = { actif: '#ffffff', gele: '#7cc4f0', inactif: '#6b6b78', disqualifie: '#fb5b5b', abandon: '#fb5b5b' };

/** Projection plane locale (mètres), cadrée sur tout ce qui est à dessiner. */
function projection(points: LatLng[]) {
  if (points.length === 0) return null;
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const m = (p: LatLng): [number, number] => [p.lng * kx, -p.lat * 110_540];
  const xs = points.map((p) => m(p)[0]);
  const ys = points.map((p) => m(p)[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(maxX - minX, 20);
  const h = Math.max(maxY - minY, 20);
  const k = (LARGEUR * 0.9) / Math.max(w, h * 1.4);
  const hauteur = Math.max(400, h * k + LARGEUR * 0.1);
  const ox = (LARGEUR - w * k) / 2 - minX * k;
  const oy = (hauteur - h * k) / 2 - minY * k;
  return { hauteur, parMetre: k, xy: (p: LatLng): [number, number] => [m(p)[0] * k + ox, m(p)[1] * k + oy] };
}

export function Carte({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [zones, setZones] = useState<ZoneCarte[]>([]);
  const [balises, setBalises] = useState<BaliseCarte[]>([]);
  const [positions, setPositions] = useState<PositionJoueur[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [voir, setVoir] = useState({ balises: true, joueurs: true });
  const [maj, setMaj] = useState<Date | null>(null);
  // Vraie carte par défaut (satellite) ; « dessin » = plan sans fond, aussi utilisé sans réseau.
  const [vue, setVue] = useState<'satellite' | 'plan' | 'dessin'>('satellite');
  const [horsLigne, setHorsLigne] = useState(false);
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernier = useRef(0);

  const charger = () => {
    void api.get<{ balises: BaliseCarte[] }>(`${base}/balises`).then((r) => setBalises(r.balises), () => {});
    void api.get<{ positions: PositionJoueur[] }>(`${base}/positions`).then((r) => (setPositions(r.positions), setMaj(new Date())), () => {});
  };
  useEffect(() => {
    void api.get<{ zones: ZoneCarte[] }>(`${base}/zones`).then((r) => setZones(r.zones), () => {});
  }, [base]);
  // Au plus un rechargement toutes les 3 s, même si les positions arrivent en rafale.
  useEffect(() => {
    const reste = 3000 - (Date.now() - dernier.current);
    if (attente.current) return;
    attente.current = setTimeout(() => {
      attente.current = null;
      dernier.current = Date.now();
      charger();
    }, Math.max(0, reste));
  }, [base, eq.version.position, eq.version.balises]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      if (attente.current) clearTimeout(attente.current);
      attente.current = null;
    },
    [],
  );

  const posees = balises.filter((b) => b.position);
  const pr = projection([...zones.flatMap((z) => z.polygone), ...posees.map((b) => b.position!), ...positions]);
  const joueur = positions.find((p) => p.joueurId === choisi);
  const points = useMemo<PointSurCarte[]>(
    () => [
      ...(voir.balises ? posees.map((b) => ({ id: b.id, libelle: b.libelle, couleur: COULEURS_BALISE[b.etat] ?? '#888', ...b.position! })) : []),
      ...(voir.joueurs
        ? positions.map((p) => ({ id: p.joueurId, libelle: p.pseudo, couleur: COULEURS_JOUEUR[p.statut] ?? '#fff', lat: p.lat, lng: p.lng, joueur: true, ...(p.precisionM !== undefined ? { precisionM: p.precisionM } : {}) }))
        : []),
    ],
    [balises, positions, voir], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const r = (m: number) => Math.max(5, m * (pr?.parMetre ?? 1));

  return (
    <div className="page">
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-map-location-dot" aria-hidden="true" /> Terrain
          </h3>
          <span className="vide">{maj ? `Mis à jour à ${maj.toLocaleTimeString('fr-FR')}` : ''}</span>
        </div>
        <div className="segments">
          {(
            [
              ['balises', `Balises (${posees.length}/${balises.length} placées)`],
              ['joueurs', `Joueurs (${positions.length})`],
            ] as const
          ).map(([k, nom]) => (
            <button key={k} type="button" className={`modal-btn modal-btn--ghost${voir[k] ? ' choisi' : ''}`} onClick={() => setVoir((v) => ({ ...v, [k]: !v[k] }))}>
              <i className={`fa-${voir[k] ? 'solid fa-square-check' : 'regular fa-square'}`} aria-hidden="true" /> {nom}
            </button>
          ))}
        </div>
        <div className="segments">
          {(
            [
              ['satellite', 'Satellite'],
              ['plan', 'Plan'],
              ['dessin', 'Dessin (sans réseau)'],
            ] as const
          ).map(([k, nom]) => (
            <button key={k} type="button" className={`modal-btn modal-btn--ghost${vue === k ? ' choisi' : ''}`} onClick={() => (setVue(k), setHorsLigne(false))}>
              {nom}
            </button>
          ))}
        </div>
        {horsLigne && <p className="msg ko">Pas de réseau pour charger la vraie carte : voici le plan dessiné.</p>}
        {vue !== 'dessin' ? (
          <CarteReelle zones={zones} points={points} fond={vue} onHorsLigne={() => (setVue('dessin'), setHorsLigne(true))} />
        ) : !pr ? (
          <p className="vide">Rien à afficher : crée d’abord les zones (Préparation).</p>
        ) : (
          <svg className="carte-gm" viewBox={`0 0 ${LARGEUR} ${pr.hauteur}`} role="img" aria-label="Carte du terrain">
            {zones.map((z) => {
              const pts = z.polygone.map(pr.xy);
              const c = COULEURS_ZONE[z.type] ?? '#888';
              const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
              const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
              return (
                <g key={z.id}>
                  <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={c} fillOpacity={0.08} stroke={c} strokeOpacity={0.6} strokeWidth={2} />
                  <text x={cx} y={cy} className="carte-gm__zone" fill={c}>
                    {z.nom}
                  </text>
                </g>
              );
            })}
            {voir.balises &&
              posees.map((b) => {
                const [x, y] = pr.xy(b.position!);
                return (
                  <g key={b.id}>
                    <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} fill={COULEURS_BALISE[b.etat] ?? '#888'} />
                    <text x={x + 10} y={y + 4} className="carte-gm__balise">
                      {b.libelle}
                    </text>
                  </g>
                );
              })}
            {voir.joueurs &&
              positions.map((p) => {
                const [x, y] = pr.xy(p);
                const c = COULEURS_JOUEUR[p.statut] ?? '#fff';
                return (
                  <g key={p.joueurId} className="cliquable" onClick={() => setChoisi(p.joueurId === choisi ? null : p.joueurId)}>
                    {p.precisionM !== undefined && <circle cx={x} cy={y} r={r(p.precisionM)} fill={c} fillOpacity={0.08} />}
                    <circle cx={x} cy={y} r={7} fill={c} stroke={p.joueurId === choisi ? '#22e7e7' : '#09090b'} strokeWidth={3} />
                    <text x={x} y={y - 12} className="carte-gm__joueur" fill={c}>
                      {p.pseudo}
                    </text>
                  </g>
                );
              })}
          </svg>
        )}
        {joueur && (
          <p className="info">
            <strong>{joueur.pseudo}</strong> · {libelleStatut(joueur.statut)} · {joueur.lat.toFixed(5)}, {joueur.lng.toFixed(5)}
            {joueur.precisionM !== undefined ? ` · précision ± ${Math.round(joueur.precisionM)} m` : ''}
          </p>
        )}
        <p className="vide">
          Balises (petits points sur la vraie carte, carrés sur le dessin) : cyan active, gris endormie, bleu épuisée, rouge coupée. Joueurs : points avec leur
          pseudo, le halo montre l’imprécision du GPS. Ces positions ne sont visibles que du GM.
        </p>
      </div>
    </div>
  );
}
