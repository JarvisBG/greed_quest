// Planche d'impression des QR, GM seulement : QR des balises (RG-6.1 : identifiant non devinable, brut ou en lien
// `…?balise=<id>` qui ouvre l'app joueur), QR des lieux (Masadora, Antokiba, Soufrabi : code secret de la zone,
// RG-9.2 / RG-11.4) et QR d'inscription si l'adresse de l'app joueur est connue. Impression par le navigateur, 3 par ligne
// ou une affiche par page ; chaque QR se télécharge aussi en image (étiquette PNG, comme Otaku Quest).
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/client';
import type { Equipe } from '../../lib/useEquipe';
import { TYPES_ZONE } from './Preparation';

interface ZoneQr {
  id: string;
  nom: string;
  type: string;
  qr: string | null;
}
interface BaliseQr {
  id: string;
  zoneId: string;
  libelle: string;
  etat: string;
}
interface Etiquette {
  cle: string;
  texte: string;
  titre: string;
  repere: string;
}

const CLE_ADRESSE = 'gq-staff-adresse-app';
const lireAdresse = () => {
  try {
    return localStorage.getItem(CLE_ADRESSE) ?? '';
  } catch {
    return '';
  }
};

/** Étiquette en image PNG : titre, QR, repère facultatif ; fond blanc pour l'impression. */
function telecharger(e: Etiquette, avecRepere: boolean) {
  const qr = qrcode(0, 'M');
  qr.addData(e.texte);
  qr.make();
  const n = qr.getModuleCount();
  const W = 660, P = 44, QS = 520, m = QS / (n + 8);
  const repere = avecRepere && e.repere;
  const H = P + 40 + 24 + QS + (repere ? 24 + 44 : 0) + P;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '700 30px "Orbitron", system-ui, sans-serif';
  ctx.fillText(`GREED ISLAND · ${e.titre}`, W / 2, P);
  const x0 = (W - QS) / 2, y0 = P + 40 + 24;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect(Math.floor(x0 + (x + 4) * m), Math.floor(y0 + (y + 4) * m), Math.ceil(m), Math.ceil(m));
  if (repere) {
    ctx.fillStyle = '#555';
    ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(e.repere, W / 2, y0 + QS + 24);
  }
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `${[e.titre, repere ? e.repere : e.cle].join(' ').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase()}.png`;
  a.click();
}

export function Qr({ texte }: { texte: string }) {
  const { n, chemin } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texte);
    qr.make();
    const n = qr.getModuleCount();
    let chemin = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) chemin += `M${x + 4} ${y + 4}h1v1h-1z`;
    return { n, chemin };
  }, [texte]);
  return (
    <svg viewBox={`0 0 ${n + 8} ${n + 8}`} shapeRendering="crispEdges" role="img" aria-label="QR code">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={chemin} fill="#000" />
    </svg>
  );
}

export function Planche({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [zones, setZones] = useState<ZoneQr[]>([]);
  const [balises, setBalises] = useState<BaliseQr[]>([]);
  const [adresse, setAdresse] = useState(lireAdresse);
  const [reperes, setReperes] = useState(true);
  const [affiche, setAffiche] = useState(false);
  const [quoi, setQuoi] = useState({ balises: true, lieux: true, inscription: true });

  useEffect(() => {
    void api.get<{ zones: ZoneQr[] }>(`${base}/zones`).then((r) => setZones(r.zones), () => {});
    void api.get<{ balises: BaliseQr[] }>(`${base}/balises`).then((r) => setBalises(r.balises), () => {});
  }, [base]);
  useEffect(() => {
    try {
      localStorage.setItem(CLE_ADRESSE, adresse);
    } catch {
      /* stockage indisponible : l'adresse sera à retaper */
    }
  }, [adresse]);

  const app = adresse.trim().replace(/\/+$/, '');
  const lien = (param: string, valeur: string) => `${app}/?${param}=${encodeURIComponent(valeur)}`;
  const nomZone = (id: string) => zones.find((z) => z.id === id)?.nom ?? '';
  const etiquettes: Etiquette[] = [
    ...(quoi.inscription && app && eq.session ? [{ cle: 'inscription', texte: lien('partie', eq.session.partieId), titre: 'Rejoindre la partie', repere: eq.partie?.nom ?? '' }] : []),
    ...(quoi.lieux ? zones.filter((z) => z.qr).map((z) => ({ cle: z.id, texte: z.qr!, titre: TYPES_ZONE[z.type]?.split(' ')[0] ?? z.nom, repere: z.nom })) : []),
    ...(quoi.balises
      ? balises.filter((b) => b.etat !== 'coupee').map((b) => ({ cle: b.id, texte: app ? lien('balise', b.id) : b.id, titre: 'Balise', repere: `${b.libelle} · ${nomZone(b.zoneId)}` }))
      : []),
  ];

  return (
    <div className="page">
      <div className="panel-card sans-impression">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-print" aria-hidden="true" /> Impression
          </h3>
        </div>
        <label>
          Adresse de l’app joueur (facultatif)
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Ex. https://jeu.exemple.fr" />
        </label>
        <p className="vide">
          Avec l’adresse, un QR de balise scanné avec l’appareil photo du téléphone ouvre directement l’app ; on peut aussi imprimer le QR pour rejoindre la partie. Sans
          adresse, les QR ne se lisent que dans l’app.
        </p>
        <div className="segments">
          {(
            [
              ['balises', `Balises (${balises.filter((b) => b.etat !== 'coupee').length})`],
              ['lieux', `Lieux (${zones.filter((z) => z.qr).length})`],
              ['inscription', 'Inscription'],
            ] as const
          ).map(([k, nom]) => (
            <button key={k} type="button" className={`modal-btn modal-btn--ghost${quoi[k] ? ' choisi' : ''}`} onClick={() => setQuoi((q) => ({ ...q, [k]: !q[k] }))}>
              <i className={`fa-${quoi[k] ? 'solid fa-square-check' : 'regular fa-square'}`} aria-hidden="true" /> {nom}
            </button>
          ))}
          <button type="button" className={`modal-btn modal-btn--ghost${reperes ? ' choisi' : ''}`} onClick={() => setReperes((r) => !r)}>
            <i className={`fa-${reperes ? 'solid fa-square-check' : 'regular fa-square'}`} aria-hidden="true" /> Repère sous chaque QR
          </button>
        </div>
        <div className="segments">
          <button type="button" className={`modal-btn modal-btn--ghost${!affiche ? ' choisi' : ''}`} onClick={() => setAffiche(false)}>
            <i className="fa-solid fa-table-cells" aria-hidden="true" /> 3 par ligne
          </button>
          <button type="button" className={`modal-btn modal-btn--ghost${affiche ? ' choisi' : ''}`} onClick={() => setAffiche(true)}>
            <i className="fa-solid fa-file" aria-hidden="true" /> Un QR par page (affiche A4)
          </button>
        </div>
        {reperes && <p className="vide">Le repère (ex. « B07 · Forêt ») aide à poser chaque balise au bon endroit : découpe-le ou plie-le au dos pour que les joueurs ne le voient pas.</p>}
        <button type="button" className="modal-btn modal-btn--primary" disabled={etiquettes.length === 0} onClick={() => window.print()}>
          <i className="fa-solid fa-print" aria-hidden="true" /> Imprimer {etiquettes.length} QR
        </button>
      </div>

      <div className={`planche${affiche ? ' planche--affiche' : ''}`}>
        {etiquettes.map((e) => (
          <div key={e.cle} className="etiquette">
            <div className="etiquette__titre">GREED ISLAND · {e.titre}</div>
            <Qr texte={e.texte} />
            {reperes && e.repere && <div className="etiquette__repere">{e.repere}</div>}
            <button type="button" className="etiquette__dl sans-impression" onClick={() => telecharger(e, reperes)}>
              <i className="fa-solid fa-download" aria-hidden="true" /> Télécharger
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
