// RG-5.1 : pseudo unique, un téléphone = un joueur, position obligatoire. RG-5.5 / 5.6 : kit reçu.
import type { SpellType } from '@gq/shared';
import { useState, type ReactNode } from 'react';
import { api, session } from '../lib/client';
import { positionActuelle } from '../lib/geo';
import type { Session } from '../lib/session';
import type { Partie } from '../lib/useJeu';

export interface Kit {
  jenny: number;
  rattrapage: number;
  sort: SpellType;
  /** RG-5.1 amendé : code de secours, montré en grand avec le kit. */
  codeSecours?: string;
}

export function Inscription({
  partie,
  onInscrit,
  onReprise,
  onAutrePartie,
  remplacee = false,
}: {
  partie: Partie;
  onInscrit: (s: Session, kit: Kit) => void;
  /** RG-5.1 amendé : partie reprise avec le code de secours (pas de kit, tout est déjà là). */
  onReprise: (s: Session) => void;
  onAutrePartie: () => void;
  /** Ce téléphone vient d'être remplacé par un autre. */
  remplacee?: boolean;
}) {
  const [pseudo, setPseudo] = useState('');
  const [etape, setEtape] = useState<'saisie' | 'position' | 'envoi'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);
  const [reprise, setReprise] = useState(remplacee);

  const avis = remplacee && (
    <section className="gi-case avis-remplace" role="status">
      <p className="texte-grand">Ta partie a été ouverte sur un autre téléphone.</p>
      <p className="doux">Si ce n’est pas toi, va voir le Game Master tout de suite. Pour la reprendre ici, entre ton pseudo et ton code de secours.</p>
    </section>
  );

  if (reprise) return <Reprise partie={partie} avis={avis} onReprise={onReprise} onRetour={() => setReprise(false)} />;

  if (!partie.inscriptionsOuvertes) {
    return (
      <div className="planche">
        <section className="gi-case">
          <h1 className="titre-ecran">{partie.nom}</h1>
          <p className="texte-grand">Les inscriptions sont fermées.</p>
          <p className="doux">L’organisation les ouvre avant le départ : réessaie dans un moment.</p>
          <button className="gi-btn-encre" onClick={() => setReprise(true)}>
            Je suis déjà inscrit
          </button>
          <button className="gi-lien" onClick={onAutrePartie}>
            Rejoindre une autre partie
          </button>
        </section>
      </div>
    );
  }

  const envoyer = async () => {
    setErreur(null);
    try {
      setEtape('position');
      const position = await positionActuelle();
      setEtape('envoi');
      const r = await api.post<{ joueurId: string; token: string; kit: Kit; codeSecours: string }>(`/parties/${partie.id}/inscription`, {
        pseudo: pseudo.trim(),
        appareilId: session.appareilId(),
        position,
      });
      onInscrit({ partieId: partie.id, joueurId: r.joueurId, token: r.token }, { ...r.kit, codeSecours: r.codeSecours });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEtape('saisie');
    }
  };

  const valide = pseudo.trim().length >= 2 && pseudo.trim().length <= 20;
  return (
    <div className="planche">
      <form
        className="gi-case"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide && etape === 'saisie') void envoyer();
        }}
      >
        <h1 className="titre-ecran">{partie.nom}</h1>
        <p className="doux">Inscris-toi : tu recevras ton kit de départ, puis tu passeras l’Examen de Hunter et ton test de Nen.</p>
        <div className="champ-groupe">
          <label htmlFor="pseudo">Ton pseudo de Hunter</label>
          <input
            id="pseudo"
            className="gi-champ"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="2 à 20 caractères"
            maxLength={20}
            autoComplete="nickname"
            aria-invalid={!!erreur}
            aria-describedby="pseudo-aide"
          />
          <p id="pseudo-aide" className="doux">
            Ta position sera demandée : sans elle, pas de partie. Personne ne la verra.
          </p>
        </div>
        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}
        <button type="submit" className="gi-btn-encre" disabled={!valide || etape !== 'saisie'}>
          {etape === 'position' ? 'Recherche de ta position…' : etape === 'envoi' ? 'Inscription…' : 'S’inscrire'}
        </button>
        <button type="button" className="gi-lien" onClick={() => setReprise(true)}>
          Je suis déjà inscrit (autre téléphone)
        </button>
        <button type="button" className="gi-lien" onClick={onAutrePartie}>
          Rejoindre une autre partie
        </button>
      </form>
    </div>
  );
}

/** RG-5.1 amendé (2026-10-20) : reprendre sa partie sur ce téléphone avec son pseudo et son code de secours. */
function Reprise({ partie, avis, onReprise, onRetour }: { partie: Partie; avis: ReactNode; onReprise: (s: Session) => void; onRetour: () => void }) {
  const [pseudo, setPseudo] = useState('');
  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const valide = pseudo.trim().length >= 2 && code.trim().length === 6;

  const envoyer = async () => {
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.post<{ joueurId: string; token: string }>(`/parties/${partie.id}/reconnexion-code`, {
        pseudo: pseudo.trim(),
        code: code.trim(),
        appareilId: session.appareilId(),
      });
      onReprise({ partieId: partie.id, joueurId: r.joueurId, token: r.token });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  return (
    <div className="planche">
      {avis}
      <form
        className="gi-case"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide && !envoi) void envoyer();
        }}
      >
        <h1 className="titre-ecran">Reprendre ma partie</h1>
        <p className="doux">Ton code de secours est sur ta licence. Ton Book, tes jenny et tes sorts reviennent sur ce téléphone ; l’autre est déconnecté.</p>
        <div className="champ-groupe">
          <label htmlFor="reprise-pseudo">Ton pseudo</label>
          <input id="reprise-pseudo" className="gi-champ" value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={20} autoComplete="nickname" />
        </div>
        <div className="champ-groupe">
          <label htmlFor="reprise-code">Ton code de secours</label>
          <input
            id="reprise-code"
            className="gi-champ code-secours-champ"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="6 caractères"
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!erreur}
          />
        </div>
        {erreur && (
          <p className="erreur" role="alert">
            {erreur}
          </p>
        )}
        <button type="submit" className="gi-btn-encre" disabled={!valide || envoi}>
          {envoi ? 'Vérification…' : 'Reprendre ma partie'}
        </button>
        <p className="doux">Code perdu ? Va voir le Game Master : il peut t’en donner un nouveau.</p>
        <button type="button" className="gi-lien" onClick={onRetour}>
          Retour
        </button>
      </form>
    </div>
  );
}
