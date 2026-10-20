// Onglet Joueur : scan de la licence (RG-5.2) ou choix dans la liste, puis fiche et actions de l'arbitre :
// avertir, geler 5 min, annuler les gains d'une balise (RG-15), expertise d'Antokiba (RG-8.8).
// Disqualification : GM seulement (RG-3, RG-15.2).
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { api } from '../lib/client';
import { libelleNen, libelleStatut, lireLicence, heure, type JoueurVue } from '../lib/format';
import type { Equipe } from '../lib/useEquipe';
import { Action } from './Action';
import { CameraQr } from './CameraQr';
import { Corrections, type ModeCorrection } from './gm/Corrections';

/** Joueur ciblé par la console ; `licence` si elle vient d'être scannée (preuve de présence). */
export interface Cible {
  joueurId: string;
  licence?: { qr: string; luA: number };
  /** Balise pré-remplie depuis une alerte « photo partagée ». */
  baliseId?: string;
  /** Vue renvoyée par la vérification de licence, en attendant la liste à jour. */
  vue?: JoueurVue;
}

/** Au-delà, la licence scannée a tourné (fenêtre de 30 s, RG-5.2) : on la redemande. */
const LICENCE_FRAICHE_MS = 45_000;

type Mode = 'fiche' | 'avertir' | 'geler' | 'annuler' | 'expertise' | 'disqualifier' | ModeCorrection;

export function Joueur({ eq, cible, setCible }: { eq: Equipe; cible: Cible | null; setCible: (c: Cible | null) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [liste, setListe] = useState(false);
  const [filtre, setFiltre] = useState('');
  const [mode, setMode] = useState<Mode>('fiche');
  const [rescan, setRescan] = useState(false);
  const base = `/parties/${eq.session!.partieId}`;

  useEffect(() => setMode(cible?.baliseId ? 'annuler' : 'fiche'), [cible?.joueurId, cible?.baliseId]);

  async function verifier(qr: string) {
    setErreur(null);
    try {
      const r = await api.post<{ joueur: JoueurVue }>(`${base}/licence/verifier`, { qr });
      setCible({ joueurId: r.joueur.id, licence: { qr, luA: Date.now() }, vue: r.joueur });
      setRescan(false);
      void eq.chargerJoueurs();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Vérification impossible');
    }
  }

  const scanner = (
    <>
      <CameraQr lire={lireLicence} onLu={verifier} invalide="Ce QR n’est pas une licence Greed Island" saisie="Code de la licence (GQL1…)" />
      {erreur && <p className="erreur">{erreur}</p>}
    </>
  );

  const j = cible ? (eq.joueurs.find((x) => x.id === cible.joueurId) ?? cible.vue) : undefined;

  if (!cible || !j) {
    return (
      <section className="pile">
        {!liste ? (
          <>
            {scanner}
            <button type="button" className="lien" onClick={() => setListe(true)}>
              Le joueur n’est pas là : choisir dans la liste
            </button>
          </>
        ) : (
          <>
            <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Pseudo" autoCapitalize="off" />
            <ul className="fil">
              {eq.joueurs
                .filter((x) => x.pseudo.toLowerCase().includes(filtre.trim().toLowerCase()))
                .map((x) => (
                  <li key={x.id}>
                    <button type="button" className="secondaire large" onClick={() => setCible({ joueurId: x.id })}>
                      {x.pseudo} <span className="info">· {libelleStatut(x.statut)}</span>
                    </button>
                  </li>
                ))}
            </ul>
            <button type="button" className="lien" onClick={() => setListe(false)}>
              Scanner une licence
            </button>
          </>
        )}
      </section>
    );
  }

  const licenceFraiche = cible.licence && Date.now() - cible.licence.luA < LICENCE_FRAICHE_MS ? cible.licence.qr : null;
  const fiche = () => setMode('fiche');

  return (
    <section className="pile">
      <div>
        <div className="profile-head">
          <div className="avatar">{j.pseudo.charAt(0).toUpperCase()}</div>
          <div>
            <h4>{j.pseudo}</h4>
            <p>{cible.licence ? `Licence vérifiée à ${heure(cible.licence.luA)}` : 'Choisi dans la liste (licence non scannée)'}</p>
          </div>
        </div>
        <div className="profile-stats">
          <div className="ps">
            <div className={`n statut s-${j.statut}`}>{libelleStatut(j.statut)}</div>
            <div className="l">Statut</div>
          </div>
          <div className="ps">
            <div className="n">{j.jenny ?? '—'}</div>
            <div className="l">Jenny</div>
          </div>
          <div className="ps">
            <div className="n">{libelleNen(j.nen)}</div>
            <div className="l">Nen</div>
          </div>
        </div>
        <button type="button" className="lien" onClick={() => setCible(null)}>
          Fermer la fiche
        </button>
      </div>

      {mode === 'fiche' && (
        <div className="choix">
          <button type="button" className="secondaire" onClick={() => setMode('avertir')}>Avertir</button>
          <button type="button" className="secondaire" onClick={() => setMode('geler')}>Geler 5 min</button>
          <button type="button" className="secondaire" onClick={() => setMode('annuler')}>Annuler les gains d’une balise (photo)</button>
          <button type="button" className="secondaire" onClick={() => setMode('expertise')}>Expertise d’Antokiba</button>
          {eq.session!.role === 'gm' && (
            <>
              <button type="button" className="secondaire" onClick={() => setMode('jenny')}>Corriger les jenny</button>
              <button type="button" className="secondaire" onClick={() => setMode('livre')}>Corriger le Book (ajouter / retirer une carte)</button>
              <button type="button" className="secondaire" onClick={() => setMode('carteGm')}>Donner une carte de Maître du jeu</button>
              <button type="button" className="secondaire" onClick={() => setMode('codeSecours')}>Nouveau code de secours (code perdu)</button>
              <button type="button" className="secondaire danger" onClick={() => setMode('disqualifier')}>Disqualifier</button>
            </>
          )}
        </div>
      )}

      {mode === 'avertir' && (
        <Action
          titre="Avertissement"
          bouton={`Avertir ${j.pseudo}`}
          avecMotif
          onFini={fiche}
          envoyer={async (motif) => {
            await api.post(`${base}/sanctions/avertissement`, { joueurId: j.id, motif });
            return `${j.pseudo} a reçu l’avertissement.`;
          }}
        />
      )}

      {mode === 'geler' && (
        <Action
          titre="Gel de 5 min"
          bouton={`Geler ${j.pseudo} 5 min`}
          avecMotif
          onFini={fiche}
          envoyer={async (motif) => {
            await api.post(`${base}/sanctions/gel`, { joueurId: j.id, motif });
            return `${j.pseudo} est gelé 5 min : plus de scan, de sort, d’échange ni d’achat.`;
          }}
        >
          <p className="info">Le joueur verra le motif sur son téléphone.</p>
        </Action>
      )}

      {mode === 'annuler' && <AnnulerGains base={base} joueur={j} baliseId={cible.baliseId} onFini={fiche} />}

      {mode === 'expertise' &&
        (licenceFraiche ? (
          <Expertise base={base} joueur={j} licence={licenceFraiche} onFini={fiche} />
        ) : (
          <div className="carte">
            <h2>Expertise d’Antokiba</h2>
            <p className="info">Payée par le joueur : scanne sa licence (elle change toutes les 30 s).</p>
            {rescan ? scanner : <button type="button" onClick={() => setRescan(true)}>Scanner la licence de {j.pseudo}</button>}
            <button type="button" className="lien" onClick={fiche}>Annuler</button>
          </div>
        ))}

      {(mode === 'jenny' || mode === 'livre' || mode === 'carteGm' || mode === 'codeSecours') && <Corrections eq={eq} joueur={j} mode={mode} onFini={fiche} />}

      {mode === 'disqualifier' && (
        <Action
          titre="Disqualification"
          bouton={`Disqualifier ${j.pseudo} définitivement`}
          avecMotif
          onFini={fiche}
          envoyer={async (motif) => {
            await api.post(`${base}/sanctions/disqualification`, { joueurId: j.id, motif });
            return `${j.pseudo} est disqualifié ; ses cartes retournent au stock.`;
          }}
        >
          <p className="erreur">Le joueur perd tout son Book et ne peut plus jouer. Impossible à annuler.</p>
        </Action>
      )}
    </section>
  );
}

interface BaliseVue {
  id: string;
  libelle: string;
  etat: string;
}

function AnnulerGains({ base, joueur, baliseId, onFini }: { base: string; joueur: JoueurVue; baliseId?: string | undefined; onFini: () => void }) {
  const [balises, setBalises] = useState<BaliseVue[]>([]);
  const [choix, setChoix] = useState(baliseId ?? '');
  useEffect(() => {
    void api.get<{ balises: BaliseVue[] }>(`${base}/balises`).then((r) => setBalises(r.balises), () => {});
  }, [base]);
  return (
    <Action
      titre="Photo de balise"
      bouton={`Annuler les gains de ${joueur.pseudo} et geler 5 min`}
      avecMotif
      pret={!!choix}
      onFini={onFini}
      envoyer={async (motif) => {
        const r = await api.post<{ retirees: number }>(`${base}/sanctions/annulation-gains`, { joueurId: joueur.id, baliseId: choix, motif });
        return `${r.retirees} carte${r.retirees > 1 ? 's' : ''} retirée${r.retirees > 1 ? 's' : ''} ; ${joueur.pseudo} est gelé 5 min.`;
      }}
    >
      <p className="info">Les cartes que le joueur a gagnées sur cette balise lui sont retirées, puis il est gelé 5 min.</p>
      <label>
        Balise
        <select value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="">Choisir…</option>
          {balises.map((b) => (
            <option key={b.id} value={b.id}>
              {b.libelle}
            </option>
          ))}
        </select>
      </label>
    </Action>
  );
}

function Expertise({ base, joueur, licence, onFini }: { base: string; joueur: JoueurVue; licence: string; onFini: () => void }) {
  const [portee, setPortee] = useState<'page' | 'livre'>('page');
  const [page, setPage] = useState(1);
  return (
    <Action
      titre="Expertise d’Antokiba"
      bouton={portee === 'page' ? `Expertiser la page ${page} (10 J)` : 'Expertiser tout le Book (25 J)'}
      pret={portee === 'livre' || page >= 1}
      onFini={onFini}
      envoyer={async () => {
        const r = await api.post<{ cout: number; trouvees: number }>(`${base}/expertise`, { licence, ...(portee === 'page' ? { page } : {}) });
        const n = r.trouvees;
        return `${joueur.pseudo} paie ${r.cout} J : ${n === 0 ? 'aucune contrefaçon' : `${n} contrefaçon${n > 1 ? 's' : ''} révélée${n > 1 ? 's' : ''}`} (résultat envoyé sur son téléphone).`;
      }}
    >
      <p className="info">Le joueur paie ; il voit le résultat dans son Book.</p>
      <div className="segments">
        <button type="button" className={`secondaire ${portee === 'page' ? 'choisi' : ''}`} onClick={() => setPortee('page')}>Une page</button>
        <button type="button" className={`secondaire ${portee === 'livre' ? 'choisi' : ''}`} onClick={() => setPortee('livre')}>Tout le Book</button>
      </div>
      {portee === 'page' && (
        <label>
          Page
          <input type="number" min={1} value={page} onChange={(e) => setPage(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        </label>
      )}
    </Action>
  );
}
