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

export function Inscription({ partie, onInscrit }: { partie: Partie; onInscrit: (s: Session, kit: Kit) => void }) {
  const [pseudo, setPseudo] = useState('');
  const [etape, setEtape] = useState<'saisie' | 'position' | 'envoi'>('saisie');
  const [erreur, setErreur] = useState<string | null>(null);

  if (!partie.inscriptionsOuvertes) {
    return (
      <div className="carte">
        <h1>{partie.nom}</h1>
        <p className="info">Les inscriptions sont fermées.</p>
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
    <form
      className="carte"
      onSubmit={(e) => {
        e.preventDefault();
        if (valide && etape === 'saisie') void envoyer();
      }}
    >
      <h1>{partie.nom}</h1>
      <p className="info">Choisis ton pseudo de Hunter. Ta position est demandée : sans elle, pas de partie.</p>
      <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder="Pseudo (2 à 20 caractères)" maxLength={20} autoComplete="nickname" />
      {erreur && <p className="erreur">{erreur}</p>}
      <button type="submit" disabled={!valide || etape !== 'saisie'}>
        {etape === 'position' ? 'Recherche de ta position…' : etape === 'envoi' ? 'Inscription…' : 'S’inscrire'}
      </button>
    </form>
  );
}
