// Dashboard, comme la « Vue d'ensemble » d'Otaku Quest : bandeau de chiffres, phase du jeu (GM), activité récente,
// dernières alertes.
import { heure, libelleAlerte, libelleLigne } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';
import { Partie } from './gm/Partie';

export function Tableau({ eq, aller }: { eq: Equipe; aller: (page: string) => void }) {
  const actifs = eq.joueurs.filter((j) => j.statut === 'actif').length;
  const clears = eq.joueurs.filter((j) => j.livreGele).length;
  const kpis = [
    { icone: 'fa-users', couleur: 'var(--violet)', fond: 'rgba(139,92,246,.14)', val: eq.joueurs.length, lbl: 'Joueurs inscrits' },
    { icone: 'fa-signal', couleur: 'var(--success)', fond: 'rgba(74,222,128,.14)', val: actifs, lbl: 'Joueurs actifs' },
    { icone: 'fa-flag-checkered', couleur: 'var(--gold)', fond: 'rgba(255,201,74,.14)', val: clears, lbl: 'Clear en attente' },
    { icone: 'fa-triangle-exclamation', couleur: 'var(--danger)', fond: 'rgba(251,91,91,.14)', val: eq.alertes.length, lbl: 'Alertes' },
  ];
  return (
    <div className="page">
      <div className="kpi-row">
        {kpis.map((k) => (
          <div key={k.lbl} className="kpi-card">
            <div className="kpi-card__top">
              <div className="kpi-card__icon" style={{ background: k.fond, color: k.couleur }}>
                <i className={`fa-solid ${k.icone}`} aria-hidden="true" />
              </div>
            </div>
            <div className="val">{k.val}</div>
            <div className="lbl">{k.lbl}</div>
          </div>
        ))}
      </div>

      {eq.session!.role === 'gm' && (
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-gamepad" aria-hidden="true" /> Phase du jeu
            </h3>
          </div>
          <Partie eq={eq} />
        </div>
      )}

      <div className="grid-main">
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-satellite-dish" aria-hidden="true" /> Activité
            </h3>
            <a href="#journal" onClick={(e) => (e.preventDefault(), aller('journal'))}>
              Tout voir <i className="fa-solid fa-chevron-right" aria-hidden="true" />
            </a>
          </div>
          <div className="timeline">
            {eq.journal.slice(0, 12).map((l) => (
              <div key={l.id} className="timeline-item">
                <span className="timeline-item__dot" style={{ background: l.acteurType === 'joueur' ? 'var(--cyan)' : l.acteurType === 'systeme' ? 'var(--ink-faint)' : 'var(--violet)' }} />
                <div>
                  <p>{libelleLigne(l, eq.nomActeur, eq.pseudos)}</p>
                  <time>{heure(l.creeLe)}</time>
                </div>
              </div>
            ))}
            {eq.journal.length === 0 && <p className="vide">Rien pour l’instant.</p>}
          </div>
        </div>
        <div className="panel-card">
          <div className="section-head">
            <h3>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Dernières alertes
            </h3>
            <a href="#alertes" onClick={(e) => (e.preventDefault(), aller('alertes'))}>
              Tout voir <i className="fa-solid fa-chevron-right" aria-hidden="true" />
            </a>
          </div>
          <div className="timeline">
            {eq.alertes.slice(0, 6).map((a, i) => (
              <div key={a.id ?? i} className="timeline-item">
                <span className="timeline-item__dot" style={{ background: 'var(--danger)' }} />
                <div>
                  <p>{libelleAlerte(a.pseudo || !a.joueurId ? a : { ...a, pseudo: eq.pseudos.get(a.joueurId) ?? 'Un joueur' })}</p>
                  <time>{a.creeLe ? heure(a.creeLe) : ''}</time>
                </div>
              </div>
            ))}
            {eq.alertes.length === 0 && <p className="vide">Aucune alerte.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
