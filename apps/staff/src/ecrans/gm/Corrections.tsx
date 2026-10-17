// Corrections du GM sur un joueur (RG-3.1 : motif obligatoire, tout est journalisé) : jenny, Book (ajouter / retirer
// une carte), don d'une carte de Maître du jeu libre (RG-8.16).
import { useEffect, useState } from 'react';
import { api } from '../../lib/client';
import { chercherCartes, numeroCarte, type JoueurVue } from '../../lib/format';
import type { Equipe } from '../../lib/useEquipe';
import { Action } from '../Action';

export type ModeCorrection = 'jenny' | 'livre' | 'carteGm';

interface CaseLivre {
  etat: string;
  kind?: string;
  itemId?: string;
  numero?: number;
  nom?: string;
  rang?: string;
  sort?: string;
  verite?: { contrefacon: string | null };
}
interface Livre {
  pages: CaseLivre[][];
  cartesGm: { itemId: string; gm: string }[];
}

export function Corrections({ eq, joueur, mode, onFini }: { eq: Equipe; joueur: JoueurVue; mode: ModeCorrection; onFini: () => void }) {
  const base = `/parties/${eq.session!.partieId}`;
  if (mode === 'jenny') return <Jenny base={base} joueur={joueur} onFini={onFini} />;
  if (mode === 'carteGm') return <DonGm base={base} joueur={joueur} onFini={onFini} />;
  return <Book eq={eq} base={base} joueur={joueur} onFini={onFini} />;
}

function Jenny({ base, joueur, onFini }: { base: string; joueur: JoueurVue; onFini: () => void }) {
  const [delta, setDelta] = useState(0);
  return (
    <Action
      titre={`Jenny de ${joueur.pseudo}${joueur.jenny !== undefined ? ` (${joueur.jenny} J)` : ''}`}
      bouton={delta >= 0 ? `Ajouter ${delta} J à ${joueur.pseudo}` : `Retirer ${-delta} J à ${joueur.pseudo}`}
      avecMotif
      pret={delta !== 0}
      onFini={onFini}
      envoyer={async (motif) => {
        await api.post(`${base}/corrections/jenny`, { joueurId: joueur.id, delta, motif });
        return `Jenny de ${joueur.pseudo} corrigés (${delta > 0 ? '+' : ''}${delta} J).`;
      }}
    >
      <label>
        Montant (négatif pour retirer)
        <input type="number" value={delta} onChange={(e) => setDelta(Math.trunc(Number(e.target.value) || 0))} />
      </label>
    </Action>
  );
}

function DonGm({ base, joueur, onFini }: { base: string; joueur: JoueurVue; onFini: () => void }) {
  const [gm, setGm] = useState<'jarvis' | 'ange'>('jarvis');
  return (
    <Action
      titre={`Donner une carte de Maître du jeu à ${joueur.pseudo}`}
      bouton={`Donner ${gm === 'jarvis' ? 'Jarvis tout-puissant' : 'Le Sceau d’Ange'} à ${joueur.pseudo}`}
      avecMotif
      onFini={onFini}
      envoyer={async (motif) => {
        await api.post(`${base}/cartes-gm/donner`, { gm, joueurId: joueur.id, motif: motif.slice(0, 120) });
        return `Carte donnée à ${joueur.pseudo} : elle apparaît dans son Book.`;
      }}
    >
      <div className="segments">
        <button type="button" className={`secondaire ${gm === 'jarvis' ? 'choisi' : ''}`} onClick={() => setGm('jarvis')}>
          Jarvis tout-puissant
        </button>
        <button type="button" className={`secondaire ${gm === 'ange' ? 'choisi' : ''}`} onClick={() => setGm('ange')}>
          Le Sceau d’Ange
        </button>
      </div>
      <p className="info">Possible seulement si la carte n’est dans le Book de personne.</p>
    </Action>
  );
}

function Book({ eq, base, joueur, onFini }: { eq: Equipe; base: string; joueur: JoueurVue; onFini: () => void }) {
  const [livre, setLivre] = useState<Livre | null>(null);
  const [sens, setSens] = useState<'retirer' | 'ajouter'>('retirer');
  const [itemId, setItemId] = useState('');
  const [carteId, setCarteId] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    void api.get<Livre>(`${base}/joueurs/${joueur.id}/livre`).then(setLivre, () => {});
  }, [base, joueur.id]);

  const cartes = (livre?.pages.flat() ?? []).filter((c) => c.etat === 'plein' && c.itemId);
  const choisie = cartes.find((c) => c.itemId === itemId);
  const ajout = eq.catalogue.find((c) => c.id === carteId);

  return (
    <Action
      titre={`Book de ${joueur.pseudo}`}
      bouton={sens === 'retirer' ? `Retirer ${choisie?.nom ?? choisie?.sort ?? 'la carte'} du Book` : `Ajouter ${ajout?.nom ?? 'la carte'} au Book`}
      avecMotif
      pret={sens === 'retirer' ? !!itemId : !!carteId}
      onFini={onFini}
      envoyer={async (motif) => {
        await api.post(`${base}/corrections/livre`, { joueurId: joueur.id, motif, ...(sens === 'retirer' ? { retirerItemId: itemId } : { ajouterCarteId: carteId }) });
        return sens === 'retirer' ? 'Carte retirée du Book.' : 'Carte ajoutée au Book.';
      }}
    >
      <div className="segments">
        <button type="button" className={`secondaire ${sens === 'retirer' ? 'choisi' : ''}`} onClick={() => setSens('retirer')}>
          Retirer une carte
        </button>
        <button type="button" className={`secondaire ${sens === 'ajouter' ? 'choisi' : ''}`} onClick={() => setSens('ajouter')}>
          Ajouter une carte
        </button>
      </div>
      {sens === 'retirer' ? (
        !livre ? (
          <p className="info">Chargement du Book…</p>
        ) : (
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Choisir la carte à retirer…</option>
            {cartes.map((c) => (
              <option key={c.itemId} value={c.itemId}>
                {c.kind === 'sort' ? `Sort : ${c.sort}` : `${numeroCarte(c.numero ?? 0)} ${c.nom} (${c.rang})${c.verite?.contrefacon ? ' · CONTREFAÇON' : ''}`}
              </option>
            ))}
          </select>
        )
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : numéro ou nom" autoCapitalize="off" />
          <select value={carteId} onChange={(e) => setCarteId(e.target.value)}>
            <option value="">Choisir la carte à ajouter…</option>
            {chercherCartes(eq.catalogue, q)
              .slice(0, 40)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {numeroCarte(c.numero)} {c.nom} ({c.rang})
                </option>
              ))}
          </select>
        </>
      )}
    </Action>
  );
}
