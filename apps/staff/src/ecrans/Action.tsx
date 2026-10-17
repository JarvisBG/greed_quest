// Gabarit d'une action de l'équipe : champs, motif (obligatoire pour une sanction, RG-3.1), confirmation en deux
// temps quand il y a un motif (§ 4.1 : premier appui = récapitulatif, second = envoi), puis résultat ou refus en clair.
import { useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api';

/** Motifs proposés (RG-15, tableau des sanctions) ; le PNJ peut en écrire un autre. */
export const MOTIFS = ['Sortie de zone', 'Photo de balise', 'Comportement antisportif', 'Balise déplacée ou abîmée', 'Faux GPS'];

export function Action({
  titre,
  bouton,
  avecMotif = false,
  pret = true,
  envoyer,
  children,
  onFini,
}: {
  titre: string;
  /** Libellé du bouton de confirmation, ex. « Geler Gon 5 min ». */
  bouton: string;
  avecMotif?: boolean;
  pret?: boolean;
  /** Renvoie le message de réussite. */
  envoyer: (motif: string) => Promise<string>;
  children?: ReactNode;
  onFini?: () => void;
}) {
  const [motif, setMotif] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [issue, setIssue] = useState<{ ok: boolean; texte: string } | null>(null);
  /** Deux temps : le premier appui demande confirmation (sanctions, corrections). */
  const [aConfirmer, setAConfirmer] = useState(false);
  const motifOk = !avecMotif || motif.trim().length >= 3;

  if (issue?.ok) {
    return (
      <div className="carte">
        <h2>{titre}</h2>
        <p className="ok">{issue.texte}</p>
        {onFini && (
          <button type="button" className="secondaire" onClick={onFini}>
            Retour
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="carte"
      onSubmit={async (e) => {
        e.preventDefault();
        if (avecMotif && !aConfirmer) {
          setAConfirmer(true);
          return;
        }
        setEnvoi(true);
        try {
          setIssue({ ok: true, texte: await envoyer(motif.trim()) });
        } catch (err) {
          setIssue({ ok: false, texte: err instanceof ApiError ? err.message : 'Action impossible' });
          setAConfirmer(false);
        } finally {
          setEnvoi(false);
        }
      }}
    >
      <h2>{titre}</h2>
      {children}
      {avecMotif && (
        <label>
          Motif (vu par le joueur)
          <input value={motif} onChange={(e) => (setMotif(e.target.value), setAConfirmer(false))} list="motifs" placeholder="Ex. Sortie de zone" maxLength={200} readOnly={aConfirmer} />
          <datalist id="motifs">
            {MOTIFS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
      )}
      {issue && <p className="erreur">{issue.texte}</p>}
      {aConfirmer && <p className="info">Confirmer ? L’action est enregistrée dans le journal avec ce motif.</p>}
      <button type="submit" disabled={envoi || !pret || !motifOk}>
        {envoi ? 'Envoi…' : aConfirmer ? `Confirmer : ${bouton.charAt(0).toLowerCase()}${bouton.slice(1)}` : bouton}
      </button>
      {aConfirmer && (
        <button type="button" className="secondaire" onClick={() => setAConfirmer(false)}>
          Revenir
        </button>
      )}
      {onFini && (
        <button type="button" className="lien" onClick={onFini}>
          Annuler
        </button>
      )}
    </form>
  );
}
