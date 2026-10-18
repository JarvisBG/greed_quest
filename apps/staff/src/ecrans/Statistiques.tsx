// Statistiques et rapports (comme la page Statistiques d'Otaku Quest) : une partie (GM, menu de la console) ou toutes
// les parties (organisateur, depuis « Mes parties »). Exports : chiffres en CSV, Journal complet en CSV (sans
// positions), rapport Word, impression / PDF par le navigateur.
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import { libelleEtat } from '../lib/format';
import { ACTIVITES, csv, csvPartie, csvParties, date, documentWord, duree, heureDe, nomFichier, telecharger, type Statistiques } from '../lib/rapport';
import type { Equipe } from '../lib/useEquipe';

const CSV = 'text/csv;charset=utf-8';
const WORD = 'application/msword';

/** Barres horizontales d'une seule série, valeur écrite au bout. */
function Barres({ lignes }: { lignes: { libelle: string; n: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.n));
  return (
    <div className="barres">
      {lignes.map((l) => (
        <div key={l.libelle} className="barres__ligne" title={`${l.libelle} : ${l.n}`}>
          <span className="barres__lib">{l.libelle}</span>
          <span className="barres__piste">
            <span className="barres__barre" style={{ width: `${(l.n / max) * 100}%` }} />
          </span>
          <span className="barres__n">{l.n}</span>
        </div>
      ))}
    </div>
  );
}

/** « À quelle heure ils jouent » : actions des joueurs par heure, pic nommé, détail au survol. */
function ParHeure({ heures }: { heures: Statistiques['parHeure'] }) {
  const max = Math.max(1, ...heures.map((h) => h.actions));
  const pic = heures.find((h) => h.actions === max);
  return (
    <div>
      {pic && pic.actions > 0 && (
        <p className="info">
          Pic à <strong>{heureDe(pic.heure)}</strong> : {pic.actions} actions de {pic.joueurs} joueurs.
        </p>
      )}
      <div className="heures" role="img" aria-label="Actions des joueurs par heure">
        {heures.map((h) => (
          <div key={h.heure} className="heures__col" tabIndex={0}>
            <span className="heures__bulle">
              {heureDe(h.heure)} · {h.actions} actions · {h.joueurs} joueurs · {h.inscriptions} inscriptions
            </span>
            <span className="heures__barre" style={{ height: `${Math.max(2, (h.actions / max) * 100)}%` }} />
            <span className="heures__lib">{heureDe(h.heure)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rapport détaillé d'une partie. */
export function Rapport({ s }: { s: Statistiques }) {
  const kpis = [
    { icone: 'fa-users', val: s.joueurs.inscrits, lbl: 'Joueurs inscrits' },
    { icone: 'fa-hourglass-half', val: duree(Math.round(s.joueurs.tempsDeJeuMoyenMin)), lbl: 'Temps de jeu moyen' },
    { icone: 'fa-qrcode', val: s.scans.reussis, lbl: 'Scans réussis' },
    { icone: 'fa-stopwatch', val: duree(s.partie.dureeMin), lbl: 'Durée de la partie' },
  ];
  const activites = ACTIVITES.map(([k, l]) => ({ libelle: l, n: s.activites[k] ?? 0 })).filter((a) => a.n > 0);
  return (
    <div className="page">
      <p className="info">
        <strong>{s.partie.nom}</strong> ({s.partie.id}) · {libelleEtat(s.partie.etat)} · {date(s.partie.demarreeA ?? s.partie.creeLe)}
        {s.partie.gagnant ? ` · gagnant : ${s.partie.gagnant}` : ''}
      </p>
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.lbl} className="kpi-card">
            <div className="kpi-card__top">
              <div className="kpi-card__icon" style={{ background: 'rgba(139,92,246,.14)', color: 'var(--violet)' }}>
                <i className={`fa-solid ${k.icone}`} aria-hidden="true" />
              </div>
            </div>
            <div className="val">{k.val}</div>
            <div className="lbl">{k.lbl}</div>
          </div>
        ))}
      </div>
      <div className="panel-card">
        <div className="section-head">
          <h3>
            <i className="fa-solid fa-clock" aria-hidden="true" /> À quelle heure ils jouent
          </h3>
        </div>
        {s.parHeure.length ? <ParHeure heures={s.parHeure} /> : <p className="vide">Aucune activité pour l’instant.</p>}
      </div>
      <div className="grid-main">
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-map-location-dot" aria-hidden="true" /> Zones les plus fréquentées
            </h3>
          </div>
          {s.scans.parZone.length ? <Barres lignes={s.scans.parZone.map((z) => ({ libelle: z.nom, n: z.n }))} /> : <p className="vide">Aucun scan réussi.</p>}
          {s.scans.balises.length > 0 && (
            <>
              <div className="section-head">
                <h3>
                  <i className="fa-solid fa-location-dot" aria-hidden="true" /> Balises les plus scannées
                </h3>
              </div>
              <Barres lignes={s.scans.balises.map((b) => ({ libelle: `${b.libelle} · ${b.zone}`, n: b.n }))} />
            </>
          )}
          <p className="vide">{s.scans.refuses} scans refusés (trop loin, trop tôt, balise vide…).</p>
        </div>
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-bolt" aria-hidden="true" /> Ce qu’ils ont fait
            </h3>
          </div>
          {activites.length ? <Barres lignes={activites} /> : <p className="vide">Pas encore d’activité.</p>}
          <p className="profile-meta">
            Joueurs : <strong>{s.joueurs.actifs}</strong> actifs à la fin · <strong>{s.joueurs.abandons}</strong> abandons · <strong>{s.joueurs.disqualifies}</strong>{' '}
            disqualifiés · <strong>{s.joueurs.actionsParJoueur}</strong> actions par joueur
            <br />
            Équipe : <strong>{s.equipe.gm}</strong> actions du GM · <strong>{s.equipe.pnj}</strong> des PNJ
          </p>
        </div>
      </div>
      {s.classement.length > 0 && (
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-trophy" aria-hidden="true" /> Classement final
            </h3>
          </div>
          <table className="tableau-simple">
            <thead>
              <tr>
                <th>Place</th>
                <th>Joueur</th>
                <th>Cartes</th>
                <th>Points</th>
                <th>Jenny</th>
              </tr>
            </thead>
            <tbody>
              {s.classement.map((c) => (
                <tr key={c.pseudo}>
                  <td>{c.place}</td>
                  <td>{c.pseudo}</td>
                  <td>{c.cartes}</td>
                  <td>{c.points}</td>
                  <td>{c.jenny}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Boutons d'export d'une partie (en-têtes : jeton du GM, ou code organisateur). */
function ExportsPartie({ s, entetes }: { s: Statistiques; entetes: Record<string, string> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const base = nomFichier(`greed-island-${s.partie.nom}-${s.partie.id}`);
  async function journal() {
    setMsg('Préparation du journal…');
    try {
      const r = await api.getAvec<{ lignes: Record<string, unknown>[] }>(`/parties/${s.partie.id}/journal/export`, entetes);
      const cles = ['date', 'heureJeuMin', 'acteur', 'joueur', 'action', 'resultat', 'motif', 'details'];
      telecharger(`${base}-journal.csv`, csv([['Date', 'Heure de jeu (min)', 'Acteur', 'Joueur', 'Action', 'Résultat', 'Motif', 'Détails'], ...r.lignes.map((l) => cles.map((k) => l[k]))]), CSV);
      setMsg(`${r.lignes.length} lignes exportées.`);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Export impossible');
    }
  }
  return (
    <div className="exports sans-impression">
      <button type="button" className="modal-btn modal-btn--primary" onClick={() => telecharger(`${base}-rapport.doc`, documentWord(`Rapport · ${s.partie.nom}`, [s]), WORD)}>
        <i className="fa-solid fa-file-word" aria-hidden="true" /> Rapport Word
      </button>
      <button type="button" className="modal-btn modal-btn--ghost" onClick={() => window.print()}>
        <i className="fa-solid fa-print" aria-hidden="true" /> Imprimer / PDF
      </button>
      <button type="button" className="modal-btn modal-btn--ghost" onClick={() => telecharger(`${base}-chiffres.csv`, csvPartie(s), CSV)}>
        <i className="fa-solid fa-file-csv" aria-hidden="true" /> Chiffres (CSV)
      </button>
      <button type="button" className="modal-btn modal-btn--ghost" onClick={() => void journal()}>
        <i className="fa-solid fa-list" aria-hidden="true" /> Journal complet (CSV)
      </button>
      {msg && <span className="vide">{msg}</span>}
    </div>
  );
}

/** Page « Statistiques » de la console (GM) : la partie ouverte. */
export function PageStatistiques({ eq }: { eq: Equipe }) {
  const id = eq.session!.partieId;
  const [s, setS] = useState<Statistiques | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = () =>
    void api.get<{ statistiques: Statistiques }>(`/parties/${id}/statistiques`).then(
      (r) => setS(r.statistiques),
      (e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  useEffect(charger, [id]);
  if (erreur) return <p className="erreur">{erreur}</p>;
  if (!s) return <p className="info">Chargement…</p>;
  return (
    <div className="page">
      <ExportsPartie s={s} entetes={{}} />
      <Rapport s={s} />
    </div>
  );
}

/** Toutes les parties (organisateur) : synthèse, comparaison, puis le détail d'une partie. */
export function StatsFestivals({ codeOrga, retour }: { codeOrga: string; retour: () => void }) {
  const [stats, setStats] = useState<Statistiques[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [detail, setDetail] = useState<Statistiques | null>(null);
  const entetes = { 'x-code-admin': codeOrga };
  useEffect(() => {
    void api.getAvec<{ parties: Statistiques[] }>('/admin/statistiques', { 'x-code-admin': codeOrga }).then(
      (r) => setStats(r.parties),
      (e) => setErreur(e instanceof ApiError ? e.message : 'Chargement impossible'),
    );
  }, [codeOrga]);

  const tete = (titre: string, sous: string, retourVers: () => void) => (
    <div className="parties__tete">
      <div>
        <div className="eyebrow">
          <i className="fa-solid fa-hexagon-nodes" aria-hidden="true" /> GREED ISLAND · {sous}
        </div>
        <h1>{titre}</h1>
      </div>
      <button type="button" className="modal-btn modal-btn--ghost sans-impression" onClick={retourVers}>
        <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Retour
      </button>
    </div>
  );

  if (detail)
    return (
      <div className="parties parties--large">
        {tete(detail.partie.nom, 'Statistiques d’une partie', () => setDetail(null))}
        <ExportsPartie s={detail} entetes={entetes} />
        <Rapport s={detail} />
      </div>
    );

  const total = (f: (s: Statistiques) => number) => (stats ?? []).reduce((n, s) => n + f(s), 0);
  const joueurs = total((s) => s.joueurs.inscrits);
  const avecJoueurs = (stats ?? []).filter((s) => s.joueurs.inscrits > 0);
  // Moyenne pondérée par le nombre de joueurs de chaque partie.
  const tempsMoyen = joueurs ? Math.round(avecJoueurs.reduce((n, s) => n + s.joueurs.tempsDeJeuMoyenMin * s.joueurs.inscrits, 0) / joueurs) : 0;
  return (
    <div className="parties parties--large">
      {tete('Toutes les parties', 'Statistiques des festivals', retour)}
      {erreur && <p className="erreur">{erreur}</p>}
      {!stats && !erreur && <p className="info">Chargement…</p>}
      {stats && (
        <>
          <div className="exports sans-impression">
            <button type="button" className="modal-btn modal-btn--primary" onClick={() => telecharger('greed-island-toutes-les-parties.doc', documentWord('Rapport · toutes les parties', stats), WORD)}>
              <i className="fa-solid fa-file-word" aria-hidden="true" /> Rapport Word
            </button>
            <button type="button" className="modal-btn modal-btn--ghost" onClick={() => window.print()}>
              <i className="fa-solid fa-print" aria-hidden="true" /> Imprimer / PDF
            </button>
            <button type="button" className="modal-btn modal-btn--ghost" onClick={() => telecharger('greed-island-toutes-les-parties.csv', csvParties(stats), CSV)}>
              <i className="fa-solid fa-file-csv" aria-hidden="true" /> Tableau (CSV)
            </button>
          </div>
          <div className="kpi-row">
            {[
              { icone: 'fa-layer-group', val: stats.length, lbl: 'Parties' },
              { icone: 'fa-users', val: joueurs, lbl: 'Joueurs en tout' },
              { icone: 'fa-hourglass-half', val: duree(tempsMoyen), lbl: 'Temps de jeu moyen' },
              { icone: 'fa-qrcode', val: total((s) => s.scans.reussis), lbl: 'Scans réussis' },
            ].map((k) => (
              <div key={k.lbl} className="kpi-card">
                <div className="kpi-card__top">
                  <div className="kpi-card__icon" style={{ background: 'rgba(139,92,246,.14)', color: 'var(--violet)' }}>
                    <i className={`fa-solid ${k.icone}`} aria-hidden="true" />
                  </div>
                </div>
                <div className="val">{k.val}</div>
                <div className="lbl">{k.lbl}</div>
              </div>
            ))}
          </div>
          <div className="panel-card">
            <div className="section-head">
              <h3>
                <i className="fa-solid fa-users" aria-hidden="true" /> Joueurs par partie
              </h3>
            </div>
            {stats.length ? <Barres lignes={stats.map((s) => ({ libelle: `${s.partie.nom} (${s.partie.id})`, n: s.joueurs.inscrits }))} /> : <p className="vide">Aucune partie.</p>}
          </div>
          <div className="panel-card" style={{ overflowX: 'auto' }}>
            <table className="tableau-simple">
              <thead>
                <tr>
                  <th>Partie</th>
                  <th>Date</th>
                  <th>État</th>
                  <th>Joueurs</th>
                  <th>Durée</th>
                  <th>Scans</th>
                  <th>Échanges</th>
                  <th>Sorts</th>
                  <th>Gagnant</th>
                  <th className="sans-impression" />
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.partie.id}>
                    <td>
                      {s.partie.nom} <code>{s.partie.id}</code>
                    </td>
                    <td>{date(s.partie.demarreeA ?? s.partie.creeLe)}</td>
                    <td>{libelleEtat(s.partie.etat)}</td>
                    <td>{s.joueurs.inscrits}</td>
                    <td>{duree(s.partie.dureeMin)}</td>
                    <td>{s.scans.reussis}</td>
                    <td>{s.activites.echanges ?? 0}</td>
                    <td>{s.activites.sorts ?? 0}</td>
                    <td>{s.partie.gagnant ?? '—'}</td>
                    <td className="sans-impression">
                      <button type="button" className="lien" onClick={() => setDetail(s)}>
                        Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
