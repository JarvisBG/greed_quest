// Vraie carte du lieu pour le GM (décision C du 2026-10-17) : fond satellite ou plan, trouvé tout seul à partir des
// coordonnées des zones (la partie peut se jouer n'importe où au Cameroun) ; zones, balises posées et joueurs
// par-dessus (RG-10.12 : GM seulement). Un toucher sur la carte peut ajouter un coin de zone (Préparation).
// Sans réseau, les tuiles ne chargent pas : `onHorsLigne` prévient l'écran, qui revient au plan dessiné.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}
export interface ZoneSurCarte {
  id: string;
  nom: string;
  type: string;
  polygone: LatLng[];
}
export interface PointSurCarte extends LatLng {
  id: string;
  libelle: string;
  couleur: string;
  /** Rayon d'imprécision en mètres (halo des joueurs). */
  precisionM?: number;
  joueur?: boolean;
}
export type Fond = 'satellite' | 'plan';

export const COULEURS_ZONE: Record<string, string> = { sauvage: '#4ade80', masadora: '#ffc94a', antokiba: '#8b5cf6', soufrabi: '#fb5b5b' };

const FONDS: Record<Fond, { url: string; attribution: string; maxZoom: number }> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Images © Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  plan: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© contributeurs OpenStreetMap', maxZoom: 19 },
};
/** Sans zone ni position : le Cameroun en entier. */
const CAMEROUN: L.LatLngExpression = [5.7, 12.4];

export function CarteReelle({
  zones,
  points = [],
  trace = [],
  fond,
  onClic,
  onHorsLigne,
  centrerSur,
  hauteur = '65dvh',
}: {
  zones: ZoneSurCarte[];
  points?: PointSurCarte[];
  /** Coins de la zone en cours de tracé. */
  trace?: LatLng[];
  fond: Fond;
  onClic?: (p: LatLng) => void;
  onHorsLigne?: () => void;
  /** Recentre la carte (ex. position du GM). */
  centrerSur?: LatLng | null;
  hauteur?: string;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const tuiles = useRef<L.TileLayer | null>(null);
  const calques = useRef<L.LayerGroup | null>(null);
  const cadree = useRef(false);
  const clic = useRef(onClic);
  clic.current = onClic;
  const horsLigne = useRef(onHorsLigne);
  horsLigne.current = onHorsLigne;

  // Création de la carte, une seule fois.
  useEffect(() => {
    if (!boite.current) return;
    const m = L.map(boite.current, { center: CAMEROUN, zoom: 6, zoomControl: true, attributionControl: true });
    calques.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => clic.current?.({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 }));
    carte.current = m;
    // La boîte prend sa taille après la création (page qui s'ouvre, onglet) : Leaflet doit la relire, sinon
    // il garde un cadrage faux (le monde entier). Tant que rien n'est cadré, on revient sur le Cameroun.
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (!cadree.current) m.setView(CAMEROUN, 6);
    });
    ro.observe(boite.current);
    return () => {
      ro.disconnect();
      m.remove();
      carte.current = null;
    };
  }, []);

  // Fond : satellite ou plan. Plusieurs tuiles en erreur sans aucune chargée = pas de réseau.
  useEffect(() => {
    const m = carte.current;
    if (!m) return;
    tuiles.current?.remove();
    const f = FONDS[fond];
    let chargees = 0;
    let erreurs = 0;
    const t = L.tileLayer(f.url, { attribution: f.attribution, maxZoom: f.maxZoom });
    t.on('tileload', () => chargees++);
    t.on('tileerror', () => {
      if (++erreurs === 4 && chargees === 0) horsLigne.current?.();
    });
    t.addTo(m);
    tuiles.current = t;
  }, [fond]);

  // Zones, points et tracé ; cadrage automatique au premier chargement des zones.
  useEffect(() => {
    const m = carte.current;
    const g = calques.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const z of zones) {
      const c = COULEURS_ZONE[z.type] ?? '#cccccc';
      L.polygon(
        z.polygone.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: c, weight: 2, fillColor: c, fillOpacity: 0.12 },
      )
        .bindTooltip(z.nom, { permanent: true, direction: 'center', className: 'gq-etiquette-zone' })
        .addTo(g);
    }
    for (const p of points) {
      if (p.joueur && p.precisionM) L.circle([p.lat, p.lng], { radius: p.precisionM, color: p.couleur, weight: 0, fillOpacity: 0.15 }).addTo(g);
      L.circleMarker([p.lat, p.lng], {
        radius: p.joueur ? 8 : 6,
        color: p.joueur ? '#09090b' : p.couleur,
        weight: p.joueur ? 3 : 1,
        fillColor: p.couleur,
        fillOpacity: 1,
      })
        .bindTooltip(p.libelle, { permanent: p.joueur === true, direction: 'top', offset: [0, -8], className: 'gq-etiquette' })
        .addTo(g);
    }
    if (trace.length > 0) {
      const pts = trace.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      (trace.length >= 3 ? L.polygon(pts, { color: '#22e7e7', weight: 2, dashArray: '6 6', fillOpacity: 0.1 }) : L.polyline(pts, { color: '#22e7e7', weight: 2, dashArray: '6 6' })).addTo(g);
      trace.forEach((p, i) => L.circleMarker([p.lat, p.lng], { radius: 5, color: '#22e7e7', fillColor: '#09090b', fillOpacity: 1, weight: 2 }).bindTooltip(String(i + 1), { permanent: true, direction: 'right', className: 'gq-etiquette' }).addTo(g));
    }
    const tous = [...zones.flatMap((z) => z.polygone), ...points];
    if (!cadree.current && tous.length > 0) {
      m.fitBounds(L.latLngBounds(tous.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [30, 30], maxZoom: 18 });
      cadree.current = true;
    }
  }, [zones, points, trace]);

  useEffect(() => {
    if (centrerSur && carte.current) carte.current.setView([centrerSur.lat, centrerSur.lng], 18);
  }, [centrerSur]);

  return <div ref={boite} className={`carte-reelle${onClic ? ' tracable' : ''}`} style={{ height: hauteur }} />;
}
