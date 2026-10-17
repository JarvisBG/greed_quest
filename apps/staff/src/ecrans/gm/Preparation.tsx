// Préparation de la partie (RG-4.1), GM seulement : conseils d'organisation (moteur conseils.ts), zones (polygone
// relevé au GPS sur place ou saisi), balises (RG-6 : pose, activer / endormir / couper, rotation forcée), catalogue
// pioché dans la banque des 100 cartes (RG-8.1, avant le démarrage), checkpoints PNJ (RG-5.2) et équipe (RG-3.2).
import { conseilCartesDesignees, conseilOrganisation, repartitionCatalogue, tirerCatalogue, N_MAX, N_MIN } from '@gq/engine';
import { BANQUE_CARTES, RANKS, type CarteBanque, type Rank } from '@gq/shared';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/client';
import { numeroCarte, stockCheckpoint, type CarteCatalogue, type Checkpoint } from '../../lib/format';
import type { Equipe } from '../../lib/useEquipe';
import { Modal } from '../Modal';
import { CarteReelle, type Fond } from './CarteReelle';

type Onglet = 'zones' | 'balises' | 'catalogue' | 'checkpoints' | 'equipe';
const ONGLETS: { id: Onglet; titre: string; icone: string }[] = [
  { id: 'zones', titre: 'Zones', icone: 'fa-draw-polygon' },
  { id: 'balises', titre: 'Balises', icone: 'fa-tower-broadcast' },
  { id: 'catalogue', titre: 'Catalogue', icone: 'fa-book' },
  { id: 'checkpoints', titre: 'Checkpoints', icone: 'fa-location-dot' },
  { id: 'equipe', titre: 'Équipe', icone: 'fa-user-shield' },
];
export const TYPES_ZONE: Record<string, string> = {
  sauvage: 'Zone sauvage',
  masadora: 'Masadora (boutique)',
  antokiba: 'Antokiba (enchères)',
  soufrabi: 'Soufrabi (arène)',
};
const ETATS_BALISE: Record<string, { nom: string; pill: string }> = {
  active: { nom: 'Active', pill: 'online' },
  dormante: { nom: 'Endormie', pill: 'offline' },
  epuisee: { nom: 'Épuisée', pill: 'gele' },
  coupee: { nom: 'Coupée', pill: 'ko' },
};
const TYPES_BALISE: Record<string, string> = { standard: 'standard', rare: 'rare', fantome: 'fantôme' };

interface LatLng {
  lat: number;
  lng: number;
}
interface ZoneComplete {
  id: string;
  nom: string;
  type: string;
  polygone: LatLng[];
  qr: string | null;
}
interface Balise {
  id: string;
  zoneId: string;
  libelle: string;
  type: string | null;
  etat: string;
  stock: number;
  position: LatLng | null;
}
interface Membre {
  id: string;
  nom: string;
  role: 'gm' | 'pnj';
}
type Message = { ok: boolean; texte: string } | null;

const erreurDe = (e: unknown, defaut: string) => (e instanceof ApiError ? e.message : defaut);

/** Position du téléphone du GM (relevé des coins d'une zone ou de la pose d'une balise, sur place). */
function maPosition(): Promise<LatLng> {
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error('Pas de GPS sur cet appareil'));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => ko(new Error('Position indisponible (GPS refusé ou sans signal)')),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  });
}
/** « 48.8566, 2.3522 » par ligne. */
function lirePoints(texte: string): LatLng[] | null {
  const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean);
  const pts = lignes.map((l) => l.split(/[,;\s]+/).map(Number));
  if (pts.some((p) => p.length !== 2 || p.some((x) => !Number.isFinite(x)))) return null;
  return pts.map(([lat, lng]) => ({ lat: lat!, lng: lng! }));
}

/** Nombre de cartes saisi, borné à N_MIN..N_MAX seulement à l'usage (pas à chaque touche). */
const bornerN = (t: string) => Math.min(N_MAX, Math.max(N_MIN, Math.floor(Number(t) || N_MIN)));

export function Preparation({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [onglet, setOnglet] = useState<Onglet>('zones');
  const [zones, setZones] = useState<ZoneComplete[]>([]);
  const [attendus, setAttendus] = useState(30);
  // Joueurs attendus saisis à la création de la partie (journal), sinon 30.
  const attendusCreation = eq.journal.find((l) => l.action === 'creation_partie')?.details?.joueursAttendus;
  useEffect(() => {
    if (typeof attendusCreation === 'number') setAttendus(attendusCreation);
  }, [attendusCreation]);
  const [duree, setDuree] = useState(120);
  const conseil = conseilOrganisation(attendus);
  const nConseil = conseilCartesDesignees(attendus, duree);

  const chargerZones = () => api.get<{ zones: ZoneComplete[] }>(`${base}/zones`).then((r) => setZones(r.zones), () => {});
  useEffect(() => void chargerZones(), [base]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void api.get<{ parametres: { key: string; applied: number }[] }>(`${base}/parametres`).then(
      (r) => setDuree(r.parametres.find((p) => p.key === 'dureePartieMin')?.applied ?? 120),
      () => {},
    );
  }, [base]);

  return (
    <div className="page">
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-lightbulb" aria-hidden="true" /> Conseils d’organisation
          </h3>
        </div>
        <label>
          Joueurs attendus
          <input type="number" min={1} value={attendus} onChange={(e) => setAttendus(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </label>
        <div className="kpi-row" style={{ marginBottom: 0 }}>
          {[
            { val: conseil.balises, lbl: 'Balises à poser' },
            { val: conseil.checkpoints, lbl: 'Checkpoints PNJ' },
            { val: conseil.cartesParCheckpoint, lbl: 'Cartes par checkpoint' },
            { val: nConseil, lbl: `Cartes au catalogue (${duree} min)` },
          ].map((k) => (
            <div key={k.lbl} className="kpi-card">
              <div className="val">{k.val}</div>
              <div className="lbl">{k.lbl}</div>
            </div>
          ))}
        </div>
        <p className="vide">Ce sont des recommandations : rien n’est bloqué.</p>
      </div>

      <div className="segments">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" className={`modal-btn modal-btn--ghost${onglet === o.id ? ' choisi' : ''}`} onClick={() => setOnglet(o.id)}>
            <i className={`fa-solid ${o.icone}`} aria-hidden="true" /> {o.titre}
          </button>
        ))}
      </div>

      {onglet === 'zones' && <Zones base={base} zones={zones} recharger={() => (void chargerZones(), void eq.chargerPartie())} />}
      {onglet === 'balises' && <Balises base={base} zones={zones} eq={eq} />}
      {onglet === 'catalogue' && <Catalogue base={base} eq={eq} nConseil={nConseil} />}
      {onglet === 'checkpoints' && <Checkpoints base={base} zones={zones} eq={eq} conseil={conseil.stockParCheckpoint} />}
      {onglet === 'equipe' && <EquipeOnglet base={base} />}
    </div>
  );
}

// --- Zones ---

function Zones({ base, zones, recharger }: { base: string; zones: ZoneComplete[]; recharger: () => void }) {
  const [nom, setNom] = useState('');
  const [type, setType] = useState('sauvage');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [fond, setFond] = useState<Fond>('satellite');
  const [ici, setIci] = useState<LatLng | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const pts = lirePoints(points);
  const ajouterCoin = (p: LatLng) => setPoints((t) => `${t.trim() ? `${t.trim()}\n` : ''}${p.lat}, ${p.lng}`);
  const retirerCoin = () => setPoints((t) => t.trim().split('\n').slice(0, -1).join('\n'));

  async function ajouterIci() {
    try {
      const p = await maPosition();
      ajouterCoin(p);
      setIci(p);
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
    }
  }
  async function creer() {
    try {
      await api.post(`${base}/zones`, { nom: nom.trim(), type, polygone: pts });
      setMessage({ ok: true, texte: `Zone « ${nom.trim()} » créée.` });
      setNom('');
      setPoints('');
      recharger();
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Création impossible') });
    }
  }

  return (
    <>
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Nouvelle zone
          </h3>
        </div>
        <label>
          Nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="Ex. Forêt de l’Est" />
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(TYPES_ZONE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <p className="info">
          Contour (au moins 3 coins) : touche la carte à chaque coin de la zone. Sur place, tu peux aussi marcher jusqu’à chaque coin et toucher « Ajouter ma position ».
        </p>
        <div className="segments">
          {(['satellite', 'plan'] as const).map((f) => (
            <button key={f} type="button" className={`modal-btn modal-btn--ghost${fond === f ? ' choisi' : ''}`} onClick={() => (setFond(f), setHorsLigne(false))}>
              {f === 'satellite' ? 'Satellite' : 'Plan'}
            </button>
          ))}
          <button type="button" className="modal-btn modal-btn--ghost" onClick={() => void maPosition().then(setIci, (e: Error) => setMessage({ ok: false, texte: e.message }))}>
            <i className="fa-solid fa-crosshairs" aria-hidden="true" /> Centrer sur moi
          </button>
        </div>
        {horsLigne ? (
          <p className="msg ko">Pas de réseau pour la carte : utilise « Ajouter ma position » ou colle les coordonnées.</p>
        ) : (
          <CarteReelle zones={zones} trace={pts ?? []} fond={fond} onClic={ajouterCoin} onHorsLigne={() => setHorsLigne(true)} centrerSur={ici} hauteur="50dvh" />
        )}
        <div className="segments">
          <button type="button" className="modal-btn modal-btn--ghost" onClick={() => void ajouterIci()}>
            <i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> Ajouter ma position
          </button>
          <button type="button" className="modal-btn modal-btn--ghost" disabled={!points.trim()} onClick={retirerCoin}>
            <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Retirer le dernier coin
          </button>
        </div>
        <label>
          Coins ({pts?.length ?? 0})
          <textarea rows={4} value={points} onChange={(e) => setPoints(e.target.value)} placeholder={'4.05110, 9.76790\n4.05150, 9.76850\n4.05080, 9.76880'} />
        </label>
        {points.trim() && !pts && <p className="msg ko">Une ligne n’est pas lisible : « latitude, longitude » attendu.</p>}
        <button type="button" className="modal-btn modal-btn--primary" disabled={!nom.trim() || !pts || pts.length < 3} onClick={() => void creer()}>
          Créer la zone
        </button>
        {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Zone</th>
                <th>Type</th>
                <th>Coins</th>
                <th>QR sur place</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td>
                    <div className="player-cell__name">{z.nom}</div>
                  </td>
                  <td>{TYPES_ZONE[z.type] ?? z.type}</td>
                  <td>{z.polygone.length}</td>
                  <td>{z.qr ? <span className="vide">à imprimer (Planche QR)</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>{zones.length === 0 ? 'Aucune zone : commence par là.' : `${zones.length} zone${zones.length > 1 ? 's' : ''}`}</span>
        </div>
      </div>
    </>
  );
}

// --- Balises ---

function Balises({ base, zones, eq }: { base: string; zones: ZoneComplete[]; eq: Equipe }) {
  const [liste, setListe] = useState<Balise[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [libelle, setLibelle] = useState('');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [action, setAction] = useState<{ b: Balise; action: 'activer' | 'endormir' | 'couper' } | null>(null);
  const [motif, setMotif] = useState('');

  const charger = () => api.get<{ balises: Balise[] }>(`${base}/balises`).then((r) => setListe(r.balises), () => {});
  useEffect(() => void charger(), [base, eq.version.balises]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomZone = (id: string) => zones.find((z) => z.id === id)?.nom ?? '';
  const actives = liste.filter((b) => b.etat === 'active').length;

  async function poser() {
    try {
      await api.post(`${base}/balises`, { zoneId, libelle: libelle.trim(), ...(position ? { position } : {}) });
      setMessage({ ok: true, texte: `Balise « ${libelle.trim()} » ajoutée.` });
      setLibelle('');
      setPosition(null);
      void charger();
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Ajout impossible') });
    }
  }
  async function changer() {
    if (!action) return;
    try {
      await api.post(`${base}/balises/${action.b.id}/etat`, { action: action.action, ...(motif.trim() ? { motif: motif.trim() } : {}) });
      setMessage({ ok: true, texte: `Balise « ${action.b.libelle} » : ${action.action === 'activer' ? 'activée' : action.action === 'couper' ? 'coupée' : 'endormie'}.` });
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Changement impossible') });
    }
    setAction(null);
    setMotif('');
    void charger();
  }
  async function rotation() {
    try {
      const r = await api.post<{ changements: number }>(`${base}/balises/rotation`);
      setMessage({ ok: true, texte: `Rotation faite : ${r.changements} changement${r.changements > 1 ? 's' : ''}.` });
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Rotation impossible') });
    }
    void charger();
  }

  return (
    <>
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Poser une balise
          </h3>
        </div>
        <label>
          Zone
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Choisir la zone…</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repère (étiquette au dos, jamais montré aux joueurs)
          <input value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={20} placeholder="Ex. B-07 chêne" />
        </label>
        <button
          type="button"
          className="modal-btn modal-btn--ghost"
          onClick={() => void maPosition().then(setPosition, (e: Error) => setMessage({ ok: false, texte: e.message }))}
        >
          <i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> {position ? `Position relevée (${position.lat}, ${position.lng})` : 'Relever ma position (facultatif)'}
        </button>
        <button type="button" className="modal-btn modal-btn--primary" disabled={!zoneId || !libelle.trim()} onClick={() => void poser()}>
          Ajouter la balise
        </button>
        {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>}
      </div>

      <div className="table-card">
        <div className="section-head" style={{ padding: '16px 18px 0' }}>
          <h3>
            <i className="fa-solid fa-tower-broadcast" aria-hidden="true" /> {liste.length} balise{liste.length > 1 ? 's' : ''} · {actives} active{actives > 1 ? 's' : ''}
          </h3>
          <button type="button" className="modal-btn modal-btn--ghost" style={{ width: "auto", flex: "none" }} onClick={() => void rotation()}>
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Forcer une rotation
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Repère</th>
                <th>Zone</th>
                <th>État</th>
                <th>Stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.map((b) => {
                const e = ETATS_BALISE[b.etat] ?? { nom: b.etat, pill: 'offline' };
                return (
                  <tr key={b.id}>
                    <td>
                      <div className="player-cell__name">{b.libelle}</div>
                      {!b.position && <div className="vide">sans position</div>}
                    </td>
                    <td>{nomZone(b.zoneId)}</td>
                    <td>
                      <span className={`status-pill ${e.pill}`}>
                        <span className="dot" /> {e.nom}
                        {b.etat === 'active' && b.type ? ` · ${TYPES_BALISE[b.type] ?? b.type}` : ''}
                      </span>
                    </td>
                    <td>{b.etat === 'active' ? b.stock : '—'}</td>
                    <td>
                      <div className="row-actions">
                        {b.etat !== 'active' && (
                          <button type="button" className="view" onClick={() => setAction({ b, action: 'activer' })} aria-label={`Activer ${b.libelle}`}>
                            <i className="fa-solid fa-power-off" aria-hidden="true" />
                          </button>
                        )}
                        {b.etat !== 'dormante' && (
                          <button type="button" className="view" onClick={() => setAction({ b, action: 'endormir' })} aria-label={`Endormir ${b.libelle}`}>
                            <i className="fa-solid fa-moon" aria-hidden="true" />
                          </button>
                        )}
                        {b.etat !== 'coupee' && (
                          <button type="button" className="view" onClick={() => setAction({ b, action: 'couper' })} aria-label={`Couper ${b.libelle}`}>
                            <i className="fa-solid fa-ban" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {action && (
        <Modal titre={`Balise ${action.b.libelle}`} icone="fa-tower-broadcast" onFermer={() => setAction(null)}>
          <p className="info">
            {action.action === 'activer' && 'La balise s’allume avec un type et un stock tirés au hasard.'}
            {action.action === 'endormir' && 'La balise s’éteint ; la rotation pourra la rallumer plus tard.'}
            {action.action === 'couper' && 'La balise est retirée du jeu (abîmée, volée…) ; la rotation ne la rallumera pas.'}
          </p>
          <label style={{ margin: '12px 0' }}>
            Motif (facultatif)
            <input value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} placeholder="Ex. QR arraché" />
          </label>
          <div className="segments">
            <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setAction(null)}>
              Annuler
            </button>
            <button type="button" className={`modal-btn ${action.action === 'couper' ? 'modal-btn--danger' : 'modal-btn--primary'}`} onClick={() => void changer()}>
              Confirmer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// --- Catalogue ---

function Catalogue({ base, eq, nConseil }: { base: string; eq: Equipe; nConseil: number }) {
  const [composer, setComposer] = useState(false);
  const [edite, setEdite] = useState<CarteCatalogue | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [saisieN, setSaisieN] = useState(String(eq.catalogue.length || nConseil));
  const n = bornerN(saisieN);
  const [aConfirmer, setAConfirmer] = useState(false);
  const demarree = eq.partie ? !['brouillon', 'inscriptions'].includes(eq.partie.etat) : false;
  const parRang = RANKS.map((r) => `${r} ${eq.catalogue.filter((c) => c.rang === r).length}`).join(' · ');
  const avecLots = eq.catalogue.some((c) => c.lotReel);

  // RG-8.1 (amendement 2026-10-17) : la plateforme propose un catalogue tiré au hasard ; le GM peut retirer.
  async function retirer() {
    setAConfirmer(false);
    const cartes = tirerCatalogue(BANQUE_CARTES, n, { next: Math.random }).map((c) => ({ numero: c.numero, nom: c.nom, rang: c.rang, texte: c.texte }));
    try {
      await api.put(`${base}/catalogue`, { cartes });
      setMessage({ ok: true, texte: `Nouveau tirage : ${cartes.length} cartes.` });
      void eq.chargerCatalogue();
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Tirage impossible') });
    }
  }

  return (
    <>
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-book" aria-hidden="true" /> Book à compléter pour le Clear : {eq.catalogue.length} cartes
          </h3>
        </div>
        <p className="info">{eq.catalogue.length > 0 ? parRang : 'Pas encore de catalogue.'}</p>
        <p className="vide">
          Les joueurs doivent réunir toutes ces cartes dans leur Book. La plateforme les a tirées au hasard parmi les 100 cartes de Greed Island (1 seule SS). Le lot réel
          est le cadeau remis au gagnant pour chaque carte ; les joueurs ne le voient pas.
        </p>
        {demarree ? (
          <p className="vide">La partie a démarré : le catalogue ne peut plus changer (seuls les noms et les lots).</p>
        ) : (
          <>
            <label>
              Nombre de cartes pour le Clear (conseillé : {nConseil})
              <input type="number" min={N_MIN} max={N_MAX} value={saisieN} onChange={(e) => setSaisieN(e.target.value)} onBlur={() => setSaisieN(String(n))} />
            </label>
            <div className="segments">
              <button type="button" className="modal-btn modal-btn--primary" onClick={() => (avecLots ? setAConfirmer(true) : void retirer())}>
                <i className="fa-solid fa-dice" aria-hidden="true" /> {eq.catalogue.length > 0 ? 'Proposer un autre tirage' : 'Proposer un tirage'}
              </button>
              <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setComposer(true)}>
                <i className="fa-solid fa-pen" aria-hidden="true" /> Retoucher à la main
              </button>
            </div>
          </>
        )}
        {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>}
      </div>
      {aConfirmer && (
        <Modal titre="Autre tirage" icone="fa-dice" onFermer={() => setAConfirmer(false)}>
          <div className="delete-warning">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            <p>Des lots réels sont déjà saisis : un nouveau tirage remplace toutes les cartes et efface ces lots.</p>
          </div>
          <div className="segments">
            <button type="button" className="modal-btn modal-btn--ghost" onClick={() => setAConfirmer(false)}>
              Annuler
            </button>
            <button type="button" className="modal-btn modal-btn--primary" onClick={() => void retirer()}>
              Tirer quand même
            </button>
          </div>
        </Modal>
      )}

      {eq.catalogue.length > 0 && (
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Carte</th>
                  <th>Rang</th>
                  <th>Lot réel</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {eq.catalogue.map((c) => (
                  <tr key={c.id} className="cliquable" onClick={() => setEdite(c)}>
                    <td>{numeroCarte(c.numero)}</td>
                    <td>
                      <div className="player-cell__name">{c.nom}</div>
                    </td>
                    <td>
                      <span className="rang">{c.rang}</span>
                    </td>
                    <td>{c.lotReel || <span className="vide">—</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="view" aria-label={`Modifier ${c.nom}`}>
                          <i className="fa-solid fa-pen" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {composer && (
        <Composer
          base={base}
          nConseil={n}
          initial={eq.catalogue.map((c) => c.numero)}
          fermer={(texte) => {
            setComposer(false);
            if (texte) {
              setMessage({ ok: true, texte });
              void eq.chargerCatalogue();
            }
          }}
        />
      )}
      {edite && <EditionCarte base={base} carte={edite} fermer={() => (setEdite(null), void eq.chargerCatalogue())} />}
    </>
  );
}

function Composer({ base, nConseil, initial, fermer }: { base: string; nConseil: number; initial: number[]; fermer: (texte?: string) => void }) {
  const [saisieN, setSaisieN] = useState(String(nConseil));
  const n = bornerN(saisieN);
  const [choix, setChoix] = useState<Set<number>>(() => new Set(initial));
  const [rang, setRang] = useState<Rank | ''>('');
  const [erreur, setErreur] = useState<string | null>(null);
  const cible = repartitionCatalogue(n);
  const compte = (r: Rank) => BANQUE_CARTES.filter((c) => c.rang === r && choix.has(c.numero)).length;

  function auHasard() {
    setChoix(new Set(tirerCatalogue(BANQUE_CARTES, n, { next: Math.random }).map((c) => c.numero)));
  }
  function basculer(c: CarteBanque) {
    setChoix((s) => {
      const t = new Set(s);
      if (t.has(c.numero)) t.delete(c.numero);
      else t.add(c.numero);
      return t;
    });
  }
  async function enregistrer() {
    const cartes = BANQUE_CARTES.filter((c) => choix.has(c.numero)).map((c) => ({ numero: c.numero, nom: c.nom, rang: c.rang, texte: c.texte }));
    try {
      await api.put(`${base}/catalogue`, { cartes });
      fermer(`Catalogue de ${cartes.length} cartes enregistré.`);
    } catch (e) {
      setErreur(erreurDe(e, 'Enregistrement impossible'));
    }
  }
  const visibles = BANQUE_CARTES.filter((c) => !rang || c.rang === rang);

  return (
    <Modal titre="Retoucher le catalogue" icone="fa-book" large onFermer={() => fermer()}>
      <p className="info">Choisis les cartes parmi les 100 cartes de Greed Island. Remplace le catalogue actuel (les stocks des checkpoints seront vidés).</p>
      <label style={{ margin: '12px 0' }}>
        Nombre de cartes conseillé ({N_MIN} à {N_MAX})
        <input type="number" min={N_MIN} max={N_MAX} value={saisieN} onChange={(e) => setSaisieN(e.target.value)} onBlur={() => setSaisieN(String(n))} />
      </label>
      <button type="button" className="modal-btn modal-btn--ghost" style={{ width: '100%' }} onClick={auHasard}>
        <i className="fa-solid fa-dice" aria-hidden="true" /> Tirer {n} cartes au hasard selon la répartition conseillée
      </button>
      <div className="segments" style={{ margin: '12px 0' }}>
        <button type="button" className={`modal-btn modal-btn--ghost${rang === '' ? ' choisi' : ''}`} onClick={() => setRang('')}>
          Tous · {choix.size}
        </button>
        {RANKS.map((r) => (
          <button key={r} type="button" className={`modal-btn modal-btn--ghost${rang === r ? ' choisi' : ''}`} onClick={() => setRang(r)}>
            {r} · {compte(r)}/{cible[r]}
          </button>
        ))}
      </div>
      <div className="actions-liste" style={{ maxHeight: '40dvh', overflowY: 'auto' }}>
        {visibles.map((c) => (
          <button key={c.numero} type="button" className={`modal-btn modal-btn--ghost${choix.has(c.numero) ? ' choisi' : ''}`} onClick={() => basculer(c)}>
            <i className={`fa-${choix.has(c.numero) ? 'solid fa-square-check' : 'regular fa-square'}`} aria-hidden="true" />
            <span>
              {numeroCarte(c.numero)} · {c.nom} <span className="rang">{c.rang}</span>
            </span>
          </button>
        ))}
      </div>
      {erreur && <p className="msg ko">{erreur}</p>}
      <div className="segments" style={{ marginTop: 14 }}>
        <button type="button" className="modal-btn modal-btn--ghost" onClick={() => fermer()}>
          Annuler
        </button>
        <button type="button" className="modal-btn modal-btn--primary" disabled={choix.size < N_MIN} onClick={() => void enregistrer()}>
          Enregistrer {choix.size} cartes
        </button>
      </div>
    </Modal>
  );
}

function EditionCarte({ base, carte, fermer }: { base: string; carte: CarteCatalogue; fermer: () => void }) {
  const [nom, setNom] = useState(carte.nom);
  const [lot, setLot] = useState(carte.lotReel ?? '');
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    try {
      await api.patch(`${base}/cartes/${carte.id}`, { nom: nom.trim(), lotReel: lot.trim() || null });
      fermer();
    } catch (e) {
      setErreur(erreurDe(e, 'Modification impossible'));
    }
  }

  return (
    <Modal titre={`Carte ${numeroCarte(carte.numero)}`} icone="fa-pen" onFermer={fermer}>
      <label>
        Nom
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
      </label>
      <label style={{ margin: '12px 0' }}>
        Lot réel remis au gagnant
        <input value={lot} onChange={(e) => setLot(e.target.value)} maxLength={120} placeholder="Ex. Bon d’achat de 20 €" />
      </label>
      {erreur && <p className="msg ko">{erreur}</p>}
      <div className="segments">
        <button type="button" className="modal-btn modal-btn--ghost" onClick={fermer}>
          Annuler
        </button>
        <button type="button" className="modal-btn modal-btn--primary" disabled={!nom.trim()} onClick={() => void enregistrer()}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

// --- Checkpoints ---

function Checkpoints({ base, zones, eq, conseil }: { base: string; zones: ZoneComplete[]; eq: Equipe; conseil: Partial<Record<Rank, number>> }) {
  const [liste, setListe] = useState<Checkpoint[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [defi, setDefi] = useState('');
  const [arbitreId, setArbitreId] = useState('');
  const [stock, setStock] = useState<string[]>([]);
  const [ajout, setAjout] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const charger = () => api.get<{ checkpoints: Checkpoint[] }>(`${base}/checkpoints`).then((r) => setListe(r.checkpoints), () => {});
  useEffect(() => {
    void charger();
    void api.get<{ equipe: Membre[] }>(`${base}/staff`).then((r) => setMembres(r.equipe), () => {});
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomZone = (id: string) => zones.find((z) => z.id === id)?.nom ?? '';
  const nomMembre = (id: string | null) => membres.find((m) => m.id === id)?.nom ?? '—';

  function remplir() {
    const ids = (Object.entries(conseil) as [Rank, number][]).flatMap(([r, k]) => {
      const du = eq.catalogue.filter((c) => c.rang === r);
      return du.length ? Array.from({ length: k }, () => du[Math.floor(Math.random() * du.length)]!.id) : [];
    });
    setStock(ids);
  }
  async function creer() {
    try {
      await api.post(`${base}/checkpoints`, { zoneId, defi: defi.trim(), cartes: stock, ...(arbitreId ? { arbitreId } : {}) });
      setMessage({ ok: true, texte: 'Checkpoint créé.' });
      setDefi('');
      setStock([]);
      void charger();
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Création impossible') });
    }
  }

  return (
    <>
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-plus" aria-hidden="true" /> Nouveau checkpoint
          </h3>
        </div>
        <label>
          Zone
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Choisir la zone…</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Défi proposé aux joueurs
          <input value={defi} onChange={(e) => setDefi(e.target.value)} maxLength={200} placeholder="Ex. Réussir 3 paniers de suite" />
        </label>
        <label>
          PNJ arbitre
          <select value={arbitreId} onChange={(e) => setArbitreId(e.target.value)}>
            <option value="">N’importe quel membre de l’équipe</option>
            {membres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom} ({m.role === 'gm' ? 'GM' : 'PNJ'})
              </option>
            ))}
          </select>
        </label>
        <p className="info">Cartes à donner ({stock.length}) : une ligne par exemplaire.</p>
        {eq.catalogue.length === 0 ? (
          <p className="vide">Compose d’abord le catalogue.</p>
        ) : (
          <>
            <button type="button" className="modal-btn modal-btn--ghost" onClick={remplir}>
              <i className="fa-solid fa-dice" aria-hidden="true" /> Remplir selon le conseil ({Object.entries(conseil).map(([r, k]) => `${k} ${r}`).join(', ')})
            </button>
            <div className="saisie">
              <select value={ajout} onChange={(e) => setAjout(e.target.value)}>
                <option value="">Ajouter une carte…</option>
                {eq.catalogue.map((c) => (
                  <option key={c.id} value={c.id}>
                    {numeroCarte(c.numero)} · {c.nom} ({c.rang})
                  </option>
                ))}
              </select>
              <button type="button" className="modal-btn modal-btn--ghost" disabled={!ajout} onClick={() => setStock((s) => [...s, ajout])}>
                Ajouter
              </button>
            </div>
            {stockCheckpoint(stock, eq.catalogue).map(({ carte, n }) => (
              <div key={carte.id} className="saisie" style={{ alignItems: 'center' }}>
                <span style={{ flex: 1, fontSize: '.85rem' }}>
                  {n} × {carte.nom} <span className="rang">{carte.rang}</span>
                </span>
                <button type="button" className="lien" onClick={() => setStock((s) => s.filter((_, i) => i !== s.indexOf(carte.id)))}>
                  Retirer 1
                </button>
              </div>
            ))}
          </>
        )}
        <button type="button" className="modal-btn modal-btn--primary" disabled={!zoneId || !defi.trim()} onClick={() => void creer()}>
          Créer le checkpoint
        </button>
        {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Défi</th>
                <th>Zone</th>
                <th>Arbitre</th>
                <th>Cartes en stock</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="player-cell__name">{c.defi}</div>
                  </td>
                  <td>{nomZone(c.zoneId)}</td>
                  <td>{nomMembre(c.arbitreId)}</td>
                  <td>{c.cartes.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>{liste.length} checkpoint{liste.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </>
  );
}

// --- Équipe ---

function EquipeOnglet({ base }: { base: string }) {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<'pnj' | 'gm'>('pnj');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const charger = () => api.get<{ equipe: Membre[] }>(`${base}/staff`).then((r) => setMembres(r.equipe), () => {});
  useEffect(() => void charger(), [base]); // eslint-disable-line react-hooks/exhaustive-deps

  async function ajouter() {
    try {
      await api.post(`${base}/staff`, { nom: nom.trim(), role, code });
      setMessage({ ok: true, texte: `${nom.trim()} ajouté. Donne-lui son code en main propre : il ne sera plus affiché.` });
      setNom('');
      setCode('');
      void charger();
    } catch (e) {
      setMessage({ ok: false, texte: erreurDe(e, 'Ajout impossible') });
    }
  }

  return (
    <>
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-user-plus" aria-hidden="true" /> Ajouter un membre
          </h3>
        </div>
        <label>
          Nom
          <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="Ex. Wing" />
        </label>
        <div className="segments">
          {(['pnj', 'gm'] as const).map((r) => (
            <button key={r} type="button" className={`modal-btn modal-btn--ghost${role === r ? ' choisi' : ''}`} onClick={() => setRole(r)}>
              {r === 'pnj' ? 'PNJ (arbitre sur le terrain)' : 'Game Master (tous les droits)'}
            </button>
          ))}
        </div>
        <label>
          Code de connexion (6 caractères ou plus)
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
        </label>
        <button type="button" className="modal-btn modal-btn--primary" disabled={!nom.trim() || code.length < 6} onClick={() => void ajouter()}>
          Ajouter
        </button>
        {message && <p className={`msg ${message.ok ? 'ok' : 'ko'}`}>{message.texte}</p>}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Membre</th>
                <th>Rôle</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="player-cell">
                      <div className="player-cell__avatar">{m.nom.charAt(0).toUpperCase()}</div>
                      <div className="player-cell__name">{m.nom}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${m.role === 'gm' ? 'gele' : 'online'}`}>{m.role === 'gm' ? 'Game Master' : 'PNJ'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
