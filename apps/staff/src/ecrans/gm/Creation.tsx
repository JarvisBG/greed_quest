// Création d'une partie par l'organisateur (code organisateur), avec son premier GM, puis connexion directe
// de ce GM. Préréglages système RG-14.5 ; données de démonstration en option (catalogue, zones, balises).
// « Rejouer » une partie terminée : même nom, même GM, et son terrain repris (mêmes QR imprimés) avec le même code GM.
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/client';

const PREREGLAGES = [
  { id: 'petit_groupe', nom: 'Petit groupe', aide: 'Moins de 15 joueurs, petit lieu' },
  { id: 'standard', nom: 'Standard', aide: 'Réglages par défaut' },
  { id: 'grande_foule', nom: 'Grande foule', aide: 'Plus de 50 joueurs' },
];

/** Partie terminée que l'on rejoue. */
export interface Depuis {
  id: string;
  nom: string;
  gm: string;
}

export function Creation({
  depuis,
  connecter,
  retour,
}: {
  depuis?: Depuis | undefined;
  connecter: (partieId: string, code: string) => Promise<void>;
  retour: () => void;
}) {
  const [codeOrga, setCodeOrga] = useState('');
  const [nom, setNom] = useState(depuis?.nom ?? '');
  const [prereglage, setPrereglage] = useState('standard');
  const [demo, setDemo] = useState(false);
  const [attendus, setAttendus] = useState(30);
  const [gmNom, setGmNom] = useState(depuis?.gm ?? '');
  /** Partie créée mais terrain non repris : on peut l'ouvrir quand même. */
  const [creee, setCreee] = useState<string | null>(null);
  const [gmCode, setGmCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const pret = codeOrga && nom.trim() && gmNom.trim() && gmCode.length >= 6;

  async function creer() {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.postAvec<{ partieId: string; token: string }>(
        '/admin/parties',
        { nom: nom.trim(), prereglage, demo: !depuis && demo, joueursAttendus: attendus, gm: { nom: gmNom.trim(), code: gmCode } },
        { 'x-code-admin': codeOrga },
      );
      if (depuis) {
        try {
          await api.postAvec(`/parties/${r.partieId}/terrain/reprendre`, { depuis: depuis.id, codeGm: gmCode }, { authorization: `Bearer ${r.token}` });
        } catch (e) {
          setCreee(r.partieId);
          setErreur(
            `Partie créée (code ${r.partieId}), mais le terrain n’a pas été repris : ${e instanceof ApiError ? e.message : 'erreur'}. Tu pourras le reprendre dans Préparation.`,
          );
          setEnvoi(false);
          return;
        }
      }
      await connecter(r.partieId, gmCode);
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Création impossible');
      setEnvoi(false);
    }
  }

  return (
    <form
      className="modal-box large"
      style={{ display: 'grid', gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (pret) void creer();
      }}
    >
      <div className="modal-box__head">
        <h3>
          <i className={`fa-solid ${depuis ? 'fa-rotate-right' : 'fa-plus'}`} aria-hidden="true" /> {depuis ? 'Rejouer la partie' : 'Nouvelle partie'}
        </h3>
      </div>
      {depuis && (
        <p className="info">
          Nouvelle partie sur le terrain de « {depuis.nom} » : mêmes zones et mêmes balises (les QR déjà imprimés resservent), nouveau catalogue tiré au hasard.
          Les joueurs repartent de zéro et s’inscrivent avec le nouveau code de partie.
        </p>
      )}
      <label>
        Code organisateur
        <input type="password" value={codeOrga} onChange={(e) => setCodeOrga(e.target.value)} autoComplete="off" />
      </label>
      <label>
        Nom de la partie
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} placeholder="Ex. Les plaines de Yorknew" />
      </label>
      <div className="segments">
        {PREREGLAGES.map((p) => (
          <button key={p.id} type="button" className={`modal-btn modal-btn--ghost${prereglage === p.id ? ' choisi' : ''}`} onClick={() => setPrereglage(p.id)} title={p.aide}>
            {p.nom}
          </button>
        ))}
      </div>
      <p className="vide">{PREREGLAGES.find((p) => p.id === prereglage)?.aide} · modifiable ensuite dans Paramètres.</p>
      <label>
        Joueurs attendus (pour le nombre de cartes du Book, tirées au hasard)
        <input type="number" min={1} value={attendus} onChange={(e) => setAttendus(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
      </label>
      {!depuis && (
        <button type="button" className={`modal-btn modal-btn--ghost${demo ? ' choisi' : ''}`} onClick={() => setDemo((d) => !d)}>
          <i className={`fa-${demo ? 'solid fa-square-check' : 'regular fa-square'}`} aria-hidden="true" /> Remplir avec une partie de démonstration (catalogue,
          zones, balises)
        </button>
      )}
      <label>
        Ton nom (Game Master)
        <input value={gmNom} onChange={(e) => setGmNom(e.target.value)} maxLength={40} placeholder="Ex. Sivraj" />
      </label>
      <label>
        {depuis ? `Ton code GM de « ${depuis.nom} » (il reste ton code pour la nouvelle partie)` : 'Ton code de connexion (6 caractères ou plus)'}
        <input type="password" value={gmCode} onChange={(e) => setGmCode(e.target.value)} autoComplete="new-password" />
      </label>
      {erreur && <p className="erreur">{erreur}</p>}
      {creee ? (
        <button type="button" className="modal-btn modal-btn--primary" onClick={() => void connecter(creee, gmCode)}>
          Ouvrir la nouvelle partie
        </button>
      ) : (
        <div className="segments">
          <button type="button" className="modal-btn modal-btn--ghost" onClick={retour}>
            Retour
          </button>
          <button type="submit" className="modal-btn modal-btn--primary" disabled={envoi || !pret}>
            {envoi ? 'Création…' : depuis ? 'Lancer la revanche' : 'Créer la partie'}
          </button>
        </div>
      )}
    </form>
  );
}
