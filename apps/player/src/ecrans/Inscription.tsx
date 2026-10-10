// RG-5.1 : pseudo unique, un téléphone = un joueur, position obligatoire. RG-5.5 / 5.6 : kit reçu.
import type { SpellType } from '@gq/shared';
import { useState } from 'react';
import { api, session } from '../lib/client';
import { positionActuelle } from '../lib/geo';
import type { Session } from '../lib/session';
import type { Partie } from '../lib/useJeu';

export interface Kit {
  jenny: number;
  rattrapage: number;
  sort: SpellType;
}

export function Inscription({ partie, onInscrit, onAutrePartie }: { partie: Partie; onInscrit: (s: Session, kit: Kit) => void; onAutrePartie: () => void }) {
  const [pseudo, setPseudo] = useState('');
  const [etape, setEtape] = useState<'saisie' | 'position' | 'envoi'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);

  if (!partie.inscriptionsOuvertes) {
    return (
      <div className="planche">
        <section className="gi-case">
          <h1 className="titre-ecran">{partie.nom}</h1>
          <p className="texte-grand">Les inscriptions sont fermées.</p>
          <p className="doux">L’organisation les ouvre avant le départ : réessaie dans un moment.</p>
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
      const r = await api.post<{ joueurId: string; token: string; kit: Kit }>(`/parties/${partie.id}/inscription`, {
        pseudo: pseudo.trim(),
        appareilId: session.appareilId(),
        position,
      });
      onInscrit({ partieId: partie.id, joueurId: r.joueurId, token: r.token }, r.kit);
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
        <button type="button" className="gi-lien" onClick={onAutrePartie}>
          Rejoindre une autre partie
        </button>
      </form>
    </div>
  );
}
