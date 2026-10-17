// Évènements (RG-12) : lancer, suivre (temps restant, PV du raid), annuler ; propositions de l'agenda automatique.
import { DEFAULT_EVENT_DURATION_MS, ZONE_EVENTS, type EventType } from '@gq/engine';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/client';
import { formatRebours } from '../../lib/format';
import type { Equipe } from '../../lib/useEquipe';

const NOMS: Record<EventType, string> = {
  apparition: 'Apparition',
  double_gain: 'Double gain',
  zone_maudite: 'Zone maudite',
  raid: 'Raid de la Brigade',
  krach: 'Krach de Masadora',
  carte_maudite: 'Carte maudite',
  mission_secrete: 'Mission secrète',
};
// Effets du tableau RG-12 (docs/REGLES.md), en clair.
const AIDES: Record<EventType, string> = {
  apparition: 'Une balise fantôme apparaît dans la zone (1 à 2 tirages S ou SS).',
  double_gain: 'Chaque tirage dans la zone donne 2 gains.',
  zone_maudite: 'La zone est fermée : les scans y sont refusés.',
  raid: 'Boss collectif : chaque bonne réponse lui retire des PV ; s’il tombe, les participants reçoivent un paquet de sorts.',
  krach: 'La boutique de Masadora est à -50 %.',
  carte_maudite: 'Une carte piégée part chez un joueur au hasard et circule ; celui qui l’a à la fin perd 2 cartes au hasard (hors SS).',
  mission_secrete: 'Un objectif pour un seul joueur, validé par un PNJ quand il montre la preuve.',
};

interface EvenementVue {
  id: string;
  type: EventType;
  texte: string | null;
  resteMs: number;
  pv?: number;
  pvMax?: number;
}

export function Evenements({ eq }: { eq: Equipe }) {
  const base = `/parties/${eq.session!.partieId}`;
  const [liste, setListe] = useState<{ e: EvenementVue; lu: number }[]>([]);
  const [type, setType] = useState<EventType>('apparition');
  const [zoneId, setZoneId] = useState('');
  const [duree, setDuree] = useState(DEFAULT_EVENT_DURATION_MS.apparition / 60_000);
  const [joueurId, setJoueurId] = useState('');
  const [objectif, setObjectif] = useState('');
  const [recompense, setRecompense] = useState(50);
  const [carteGm, setCarteGm] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [ignoree, setIgnoree] = useState<number | null>(null);
  const [, tic] = useState(0);

  const charger = () => api.get<{ evenements: EvenementVue[] }>(`${base}/evenements`).then((r) => setListe(r.evenements.map((e) => ({ e, lu: Date.now() }))), () => {});
  useEffect(() => void charger(), [base, eq.version.evenement, eq.version.evenement_fin, eq.version.raid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => tic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Dernière proposition de l'agenda automatique (journal), tant qu'elle n'est ni lancée ni ignorée.
  const prop = eq.journal.find((l) => l.action === 'agenda' && l.resultat === 'proposition');
  const propData = prop?.details as { type: EventType; zoneId: string | null; zone: string | null } | undefined;

  const zoneRequise = ZONE_EVENTS.includes(type);
  const mission = type === 'mission_secrete';
  const pret = (!zoneRequise || zoneId) && (!mission || (joueurId && objectif.trim()));

  function choisirType(t: EventType) {
    setType(t);
    setDuree(DEFAULT_EVENT_DURATION_MS[t] / 60_000);
  }

  async function lancer(corps: Record<string, unknown>) {
    try {
      await api.post(`${base}/evenements`, corps);
      setMessage({ ok: true, texte: `${NOMS[corps.type as EventType]} lancé.` });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Lancement impossible' });
    }
    void charger();
  }
  async function annuler(id: string) {
    try {
      await api.post(`${base}/evenements/${id}/annuler`);
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof ApiError ? e.message : 'Annulation impossible' });
    }
    void charger();
  }

  return (
    <section className="pile">
      <h1>Évènements</h1>
      {prop && propData && ignoree !== prop.id && (
        <div className="carte">
          <h2>Proposition de l’agenda</h2>
          <p>
            {NOMS[propData.type]}
            {propData.zone ? ` · ${propData.zone}` : ''}
          </p>
          <div className="segments">
            <button type="button" onClick={() => (setIgnoree(prop.id), void lancer({ type: propData.type, ...(propData.zoneId ? { zoneId: propData.zoneId } : {}) }))}>
              Lancer
            </button>
            <button type="button" className="secondaire" onClick={() => setIgnoree(prop.id)}>
              Ignorer
            </button>
          </div>
        </div>
      )}

      <div className="carte">
        <h2>Lancer un évènement</h2>
        <select value={type} onChange={(e) => choisirType(e.target.value as EventType)}>
          {(Object.keys(NOMS) as EventType[]).map((t) => (
            <option key={t} value={t}>
              {NOMS[t]}
            </option>
          ))}
        </select>
        <p className="info">{AIDES[type]}</p>
        {zoneRequise && (
          <label>
            Zone
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">Choisir la zone…</option>
              {eq.partie?.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        {mission && (
          <>
            <label>
              Joueur
              <select value={joueurId} onChange={(e) => setJoueurId(e.target.value)}>
                <option value="">Choisir le joueur…</option>
                {eq.joueurs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.pseudo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Objectif
              <input value={objectif} onChange={(e) => setObjectif(e.target.value)} maxLength={200} placeholder="Ex. Photo avec un PNJ déguisé" />
            </label>
            <label>
              Récompense (J)
              <input type="number" min={0} value={recompense} onChange={(e) => setRecompense(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
            </label>
          </>
        )}
        {type === 'raid' && (
          <label>
            Carte de Maître du jeu promise au meilleur chasseur
            <select value={carteGm} onChange={(e) => setCarteGm(e.target.value)}>
              <option value="">Aucune</option>
              <option value="jarvis">Jarvis tout-puissant</option>
              <option value="ange">Le Sceau d’Ange</option>
            </select>
          </label>
        )}
        <label>
          Durée (minutes)
          <input type="number" min={1} max={120} value={duree} onChange={(e) => setDuree(Math.min(120, Math.max(1, Math.floor(Number(e.target.value) || 1))))} />
        </label>
        <button
          type="button"
          disabled={!pret}
          onClick={() =>
            void lancer({
              type,
              dureeMin: duree,
              ...(zoneRequise ? { zoneId } : {}),
              ...(mission ? { joueurId, objectif: objectif.trim(), recompenseJenny: recompense } : {}),
              ...(type === 'raid' && carteGm ? { carteGm } : {}),
            })
          }
        >
          Lancer : {NOMS[type]}
        </button>
        {message && <p className={message.ok ? 'ok' : 'erreur'}>{message.texte}</p>}
      </div>

      <h2>En cours</h2>
      {liste.length === 0 && <p className="info">Aucun évènement en cours.</p>}
      <ul className="fil">
        {liste.map(({ e, lu }) => (
          <li key={e.id} className="pile">
            <strong>
              {NOMS[e.type]} <span className="quand">· reste {formatRebours(e.resteMs - (Date.now() - lu))}</span>
            </strong>
            {e.texte && <p className="detail">{e.texte}</p>}
            {e.pv !== undefined && e.pvMax !== undefined && (
              <p className="detail">
                Boss : {e.pv} / {e.pvMax} PV
              </p>
            )}
            <button type="button" className="secondaire danger" onClick={() => void annuler(e.id)}>
              Arrêter maintenant
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
