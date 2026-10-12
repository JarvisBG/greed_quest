// Page ⑩ (prototype validé par Sivraj le 2026-10-12 : docs/prototype/pouvoirs-nen.html) : la fiche en deux temps des
// pouvoirs qui demandent un choix. Texture Surprise et Alchimie : ① ton doublon, ② la carte voulue (RG-5.4) ;
// L'épée du vol : ① la cible, ② la carte visée, sans voir le Book de la cible (décision de Sivraj du 2026-10-12) ;
// Échange forcé : ① la carte à donner, ② la cible. La requête part au toucher du bouton (P1), la cinématique attend
// sa réponse. Une carte qui a atteint sa limite est refusée par le serveur, sans consommer le pouvoir.
import type { NenType, PositionInput } from '@gq/shared';
import { Carte } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/client';
import type { EmplacementCarte, LivreRecu } from '../../lib/livre';
import {
  apparencesTexture,
  avecLimites,
  CASES,
  cartesAlchimie,
  cartesBandit,
  parRang,
  phraseAlchimie,
  phraseBandit,
  phraseTexture,
  type CarteCatalogue,
} from '../../lib/pouvoir';
import { cartesUtilisables, corpsSort, doublons, resumeSort, type ReponseSort } from '../../lib/sorts';
import { HexaNen } from './CaseNen';
import type { CarteVue } from './Lancer';
import type { DemandePouvoir, IssuePouvoir } from './Pouvoir';

export type PouvoirAvecFiche = 'transformation' | 'alchimie' | 'bandit' | 'manipulation';
interface Cible {
  id: string;
  pseudo: string;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const vueEmplacement = (c: EmplacementCarte): CarteVue => ({ genre: 'designee', numero: c.numero, nom: c.nom, rang: c.rang, limite: c.limite ?? null, texte: c.texte ?? null });
const vueCatalogue = (c: CarteCatalogue): CarteVue => ({ genre: 'designee', numero: c.numero, nom: c.nom, rang: c.rang, limite: c.limite ?? null, texte: c.texte ?? null });
const refus = (e: unknown): IssuePouvoir => ({ refus: message(e), phrase: '' });

interface Props {
  partieId: string;
  nen: NenType;
  cle: PouvoirAvecFiche;
  livre: LivreRecu;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  onFermer: () => void;
  onLancer: (d: DemandePouvoir) => void;
}

export function FichePouvoir({ partieId, nen, cle, livre, positionAction, onFermer, onLancer }: Props) {
  // `un` et `deux` : itemId d'une carte du Book, id d'une carte du catalogue, id d'un joueur, ou « hasard ».
  const [un, setUn] = useState<string | null>(null);
  const [deux, setDeux] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<CarteCatalogue[] | null>(null);
  const [cibles, setCibles] = useState<Cible[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const retour = useRef<HTMLButtonElement>(null);
  const etape2 = useRef<HTMLElement>(null);
  const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const texte = CASES[cle];
  const avecCible = cle === 'bandit' || cle === 'manipulation';

  useEffect(() => {
    retour.current?.focus({ preventScroll: true });
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.pouvoir')) onFermer();
    };
    addEventListener('keydown', clavier);
    return () => removeEventListener('keydown', clavier);
  }, [onFermer]);
  useEffect(() => {
    if (cle === 'manipulation') return;
    api.get<{ cartes: CarteCatalogue[] }>(`/parties/${partieId}/cartes`).then(
      (r) => setCatalogue(avecLimites(r.cartes, livre)),
      (e: unknown) => setErreur(message(e)),
    );
  }, [partieId, cle]);
  // Liste des cibles : la position part d'abord, pour que le serveur calcule la portée à jour (RG-10.1).
  const chargerCibles = async () => {
    setErreur(null);
    setCibles(null);
    try {
      await positionAction(true);
      setCibles((await api.get<{ joueurs: Cible[] }>(`/parties/${partieId}/a-portee`)).joueurs);
    } catch (e) {
      setErreur(message(e));
    }
  };
  useEffect(() => {
    if (avecCible) void chargerCibles();
  }, []);

  const mesDoublons = doublons(livre);
  const aDonner = cartesUtilisables(livre);
  const doublon = mesDoublons.find((c) => c.itemId === un) ?? null;
  const possibles = !catalogue ? null : cle === 'bandit' ? cartesBandit(catalogue) : doublon ? (cle === 'transformation' ? apparencesTexture(doublon, catalogue) : cartesAlchimie(doublon, catalogue)) : [];
  const nomCible = (id: string | null) => cibles?.find((c) => c.id === id)?.pseudo ?? 'ce joueur';
  const choisirUn = (v: string) => {
    if (v !== un) setDeux(null);
    setUn(v);
    if (v !== un) requestAnimationFrame(() => etape2.current?.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' }));
  };

  let action: string;
  if (cle === 'transformation' || cle === 'alchimie') action = !un ? 'Choisis un doublon' : !deux ? (cle === 'transformation' ? 'Choisis son nouvel aspect' : 'Choisis la carte voulue') : `${cle === 'transformation' ? 'Déguiser en' : 'Transmuter en'} ${catalogue?.find((c) => c.id === deux)?.nom ?? ''}`;
  else if (cle === 'bandit') action = !un ? 'Choisis une cible' : !deux ? 'Choisis la carte visée' : `Frapper ${nomCible(un)}`;
  else action = !un ? 'Choisis la carte à donner' : !deux ? 'Choisis une cible' : `Échanger avec ${nomCible(deux)}`;

  const lancer = () => {
    if (!un || !deux) return;
    const base = `/parties/${partieId}`;
    let demande: DemandePouvoir;
    if (cle === 'transformation' || cle === 'alchimie') {
      const d = doublon!;
      const voulue = catalogue!.find((c) => c.id === deux)!;
      const reponse: Promise<IssuePouvoir> =
        cle === 'transformation'
          ? api.post<{ resultat: 'reussi' | 'contrefacon' }>(`${base}/transformation`, { itemId: d.itemId, cibleCarteId: voulue.id }).then(
              (r) =>
                r.resultat === 'contrefacon'
                  ? { echec: true, phrase: phraseTexture(d.nom, voulue.nom, 'contrefacon') }
                  : { phrase: phraseTexture(d.nom, voulue.nom), tag: 'Pour les autres : une vraie carte' },
              refus,
            )
          : api.post<{ resultat: 'reussi' | 'contrefacon' }>(`${base}/specialisation`, { pouvoir: 'alchimie', doublonItemId: d.itemId, carteVoulueId: voulue.id }).then(
              (r) =>
                r.resultat === 'contrefacon'
                  ? { echec: true, phrase: phraseAlchimie('contrefacon', d.nom, null) }
                  : { obtenue: vueCatalogue(voulue), phrase: phraseAlchimie('reussi', d.nom, voulue.nom), tag: 'Provenance : Alchimie' },
              refus,
            );
      demande = cle === 'transformation' ? { nen, scene: { cle, doublon: vueEmplacement(d), apparence: vueCatalogue(voulue) }, reponse } : { nen, scene: { cle, doublon: vueEmplacement(d) }, reponse };
    } else if (cle === 'bandit') {
      const cible = nomCible(un);
      const visee = deux === 'hasard' ? null : catalogue!.find((c) => c.id === deux)!;
      const reponse = (async (): Promise<IssuePouvoir> => {
        try {
          const position = await positionAction();
          const r = await api.post<ReponseSort>(`${base}/sort`, { sort: 'vol', source: { type: 'pouvoir' }, cibleId: un, ...(visee ? { carteVoulueId: visee.id } : {}), position });
          const phrase = phraseBandit(r, cible, visee);
          if (r.resultat === 'bloque') return { bloque: true, phrase };
          if (r.resultat !== 'reussi' || !r.recu) return { vide: true, phrase };
          return { obtenue: { genre: 'designee', numero: r.recu.numero ?? null, nom: r.recu.nom ?? 'Carte', rang: r.recu.rang ?? null, limite: r.recu.limite ?? null, texte: r.recu.texte ?? null }, phrase, tag: `Prise à ${cible}` };
        } catch (e) {
          return refus(e);
        }
      })();
      demande = { nen, scene: { cle, cible }, reponse };
    } else {
      const donnee = aDonner.find((c) => c.itemId === un)!;
      const cible = nomCible(deux);
      const reponse = (async (): Promise<IssuePouvoir> => {
        try {
          const r = await api.post<ReponseSort>(`${base}/sort`, corpsSort({ sort: 'echange_force', itemId: null, cibleId: deux, carteItemId: un }, await positionAction()));
          const phrase = resumeSort(r, cible, () => 'une carte', donnee.nom);
          if (r.resultat === 'bloque') return { bloque: true, phrase };
          if (r.resultat !== 'reussi' || !r.recu) return { vide: true, phrase };
          return { obtenue: { genre: 'designee', numero: r.recu.numero ?? null, nom: r.recu.nom ?? 'Carte', rang: r.recu.rang ?? null, limite: r.recu.limite ?? null, texte: r.recu.texte ?? null }, phrase, tag: `Reçue de ${cible}` };
        } catch (e) {
          return refus(e);
        }
      })();
      demande = { nen, scene: { cle, donnee: vueEmplacement(donnee), cible }, reponse };
    }
    onLancer(demande);
  };

  const grilleBook = (cartes: EmplacementCarte[], choisi: string | null, choisir: (v: string) => void) =>
    cartes.length === 0 ? (
      <p>{cle === 'manipulation' ? 'Aucune carte à donner dans ton Book.' : 'Aucun doublon dans ton Book : il faut une carte rangée hors de son emplacement fixe.'}</p>
    ) : (
      <ul className="sorts-mes-cartes">
        {cartes.map((c) => (
          <li key={c.itemId}>
            <button aria-pressed={choisi === c.itemId} onClick={() => choisir(c.itemId)}>
              <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} limite={c.limite ?? null} />
              <span>{c.nom}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  const grilleCatalogue = (cartes: CarteCatalogue[], hasard: boolean) => (
    <ul className="sorts-mes-cartes">
      {hasard && (
        <li>
          <button aria-pressed={deux === 'hasard'} onClick={() => setDeux('hasard')}>
            <span className="pouvoir-hasard" aria-hidden="true">
              ?
            </span>
            <span>Au hasard</span>
          </button>
        </li>
      )}
      {parRang(cartes).map((g) => [
        <li key={g.rang} className="pouvoir-rang">
          Rang {g.rang}
        </li>,
        ...g.cartes.map((c) => (
          <li key={c.id}>
            <button aria-pressed={deux === c.id} onClick={() => setDeux(c.id)}>
              <Carte genre="designee" numero={c.numero} nom={c.nom} rang={c.rang} limite={c.limite ?? null} />
              <span>{c.nom}</span>
            </button>
          </li>
        )),
      ])}
    </ul>
  );
  const listeCibles = (choisi: string | null, choisir: (v: string) => void) =>
    erreur ? (
      <p className="sorts-erreur">{erreur}</p>
    ) : !cibles ? (
      <p>Recherche des joueurs…</p>
    ) : cibles.length === 0 ? (
      <p>Personne à portée (30 m environ). Rapproche-toi d’un joueur.</p>
    ) : (
      <ul className="sorts-liste">
        {cibles.map((c) => (
          <li key={c.id}>
            <button aria-pressed={choisi === c.id} onClick={() => choisir(c.id)}>
              {c.pseudo}
              <Coche />
            </button>
          </li>
        ))}
      </ul>
    );
  const titreCible = (n: number) => (
    <div className="sorts-case-tete">
      <h2>
        <span className="pouvoir-n">{n}</span>Cible
      </h2>
      <button className="gi-lien" onClick={() => void chargerCibles()}>
        Actualiser
      </button>
    </div>
  );

  let premier: React.ReactNode;
  let second: React.ReactNode;
  if (cle === 'transformation' || cle === 'alchimie') {
    premier = (
      <>
        <h2>
          <span className="pouvoir-n">1</span>Ton doublon
        </h2>
        <p className="aide">Une carte rangée hors de son emplacement fixe.{cle === 'alchimie' ? ' Il sort du jeu.' : ''}</p>
        {grilleBook(mesDoublons, un, choisirUn)}
      </>
    );
    second = (
      <>
        <h2>
          <span className="pouvoir-n">2</span>
          {cle === 'transformation' ? 'Son nouvel aspect' : 'La carte voulue'}
        </h2>
        {doublon && (
          <>
            <p className="aide">
              {cle === 'transformation'
                ? `Une carte de rang ${doublon.rang}${doublon.rang === 'S' ? ', ou la SS pour bluffer' : ''}. Elle comptera comme une contrefaçon.`
                : 'Du même rang ou du rang juste au-dessus, jamais la SS. Si la carte a atteint sa limite, ton pouvoir n’est pas utilisé.'}
            </p>
            {!possibles ? <p>{erreur ?? 'Chargement du catalogue…'}</p> : possibles.length === 0 ? <p>Aucune carte possible pour ce doublon.</p> : grilleCatalogue(possibles, false)}
          </>
        )}
      </>
    );
  } else if (cle === 'bandit') {
    premier = (
      <>
        {titreCible(1)}
        <p className="aide">Joueurs à portée, 30 m environ</p>
        {listeCibles(un, choisirUn)}
      </>
    );
    second = (
      <>
        <h2>
          <span className="pouvoir-n">2</span>La carte visée
        </h2>
        {un && (
          <>
            <p className="aide">Si {nomCible(un)} en a un exemplaire prenable, l’épée le prend ; sinon, une carte au hasard dans ses emplacements fixes. Tu ne vois pas son Book. Jamais la SS.</p>
            {!possibles ? <p>{erreur ?? 'Chargement du catalogue…'}</p> : grilleCatalogue(possibles, true)}
          </>
        )}
      </>
    );
  } else {
    premier = (
      <>
        <h2>
          <span className="pouvoir-n">1</span>Carte à donner
        </h2>
        <p className="aide">Le joueur visé la reçoit, et tu lui prends une carte au hasard.</p>
        {grilleBook(aDonner, un, choisirUn)}
      </>
    );
    second = (
      <>
        {titreCible(2)}
        {un && (
          <>
            <p className="aide">Joueurs à portée, 30 m environ</p>
            {listeCibles(deux, setDeux)}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="sorts-fiche pouvoir-fiche" role="dialog" aria-modal="true" aria-labelledby="pouvoir-fiche-titre" style={{ ['--aura' as string]: `var(--nen-${nen})` }}>
        <div className="sorts-fiche-corps">
          <button ref={retour} className="sorts-fermer" onClick={onFermer}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
            Sorts
          </button>
          <div className="pouvoir-fiche-tete">
            <HexaNen type={nen} />
            <h1 id="pouvoir-fiche-titre">{texte.nom}</h1>
            <p>{texte.effet}</p>
          </div>
          <section className="sorts-case">{premier}</section>
          <section ref={etape2} className={`sorts-case${un ? '' : ' attend'}`}>
            {second}
          </section>
        </div>
      </div>
      <div className="sorts-pied">
        <button className="gi-btn-encre sorts-agir" disabled={!un || !deux} onClick={lancer}>
          {action}
        </button>
      </div>
    </>
  );
}

function Coche() {
  return (
    <svg className="coche" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
