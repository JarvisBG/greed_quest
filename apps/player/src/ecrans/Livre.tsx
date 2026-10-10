// RG-8.5 : Book en pages de 10 (emplacements fixes dans l'ordre des numéros de l'anime, puis emplacements libres) ;
// amendement 2026-10-10 : une carte désignée peut être cachée dans les emplacements libres, puis remise en place.
// RG-8.14 : provenance en clair ; RG-8.13 : emplacement perdu (« Volée par X à 14h05 ») ;
// RG-8.9 : contrefaçons telles que le joueur les connaît. Le serveur décide de tout ce qui est montré.
import type { Rank } from '@gq/shared';
import { useState } from 'react';
import { api } from '../lib/client';
import { numeroCarte as num, SORTS } from '../lib/format';
import { titreDePage, type Emplacement } from '../lib/livre';
import { useLivre } from '../lib/useLivre';

const LIBRES = 15; // RG-8.5

export function Livre({ partieId, version, apresAction }: { partieId: string; version: number; apresAction: () => void }) {
  const { livre, erreur } = useLivre(partieId, version);
  const [page, setPage] = useState(0);
  const [refus, setRefus] = useState<string | null>(null);

  if (!livre) return <p className="info">{erreur ?? 'Chargement du Book…'}</p>;
  // RG-8.5 amendé : cacher ou remettre en place ; le serveur vérifie la place libre, le gel et les échanges.
  const deplacer = async (itemId: string, cacher: boolean) => {
    setRefus(null);
    try {
      await api.post(`/parties/${partieId}/book/deplacer`, { itemId, cacher });
      apresAction();
    } catch (e) {
      setRefus(e instanceof Error ? e.message : String(e));
    }
  };
  const p = Math.min(page, livre.pages.length - 1);
  return (
    <div className="livre">
      <div className="carte">
        <h1>Book</h1>
        <p>
          <strong>
            {livre.cartesDesignees}/{livre.total}
          </strong>{' '}
          cartes en place · emplacements libres {livre.libresUtilises}/{LIBRES}
        </p>
        {livre.libresUtilises >= LIBRES && <p className="erreur">Book plein : libère un emplacement pour scanner à nouveau.</p>}
        {livre.gele && <p className="erreur">Book gelé en attendant la décision de l’équipe.</p>}
        {erreur && <p className="info">Hors ligne : dernier état connu.</p>}
        {refus && <p className="erreur">{refus}</p>}
      </div>
      <nav className="pages" aria-label="Pages du Book">
        <button className="secondaire" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Page précédente">
          ‹
        </button>
        <span>
          {titreDePage(livre, p)} <span className="info">({p + 1}/{livre.pages.length})</span>
        </span>
        <button className="secondaire" disabled={p >= livre.pages.length - 1} onClick={() => setPage(p + 1)} aria-label="Page suivante">
          ›
        </button>
      </nav>
      <ul className="emplacements">
        {livre.pages[p]?.map((e, i) => (
          <li key={e.etat === 'plein' ? e.itemId : `${p}-${i}`} className={`emplacement ${e.etat}`}>
            <Contenu e={e} gele={livre.gele} onDeplacer={(itemId, cacher) => void deplacer(itemId, cacher)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rang({ rang }: { rang: Rank | null }) {
  return rang ? <span className={`rang r${rang}`}>{rang}</span> : null;
}

function Contenu({ e, gele, onDeplacer }: { e: Emplacement; gele: boolean; onDeplacer: (itemId: string, cacher: boolean) => void }) {
  if (e.etat === 'vide') {
    if (!e.designe) return <span className="info">Emplacement libre</span>;
    return (
      <>
        <span className="numero">{num(e.carte.numero)}</span> <span className="manquante">{e.carte.nom}</span> <Rang rang={e.carte.rang} />
      </>
    );
  }
  if (e.etat === 'perdu') {
    return (
      <>
        <span className="numero">{num(e.carte.numero)}</span> <span className="manquante">{e.carte.nom}</span> <Rang rang={e.carte.rang} />
        <div className="detail erreur">{e.message}</div>
      </>
    );
  }
  if (e.kind === 'sort') {
    const s = SORTS[e.sort];
    return (
      <>
        <strong>Sort {s.nom}</strong>
        <div className="detail info">{s.effet}</div>
      </>
    );
  }
  return (
    <>
      <span className="numero">{num(e.numero)}</span> <strong className={e.apparence === 'grisee' ? 'manquante' : ''}>{e.apparence === 'grisee' ? `Contrefaçon de ${e.nom}` : e.nom}</strong>{' '}
      <Rang rang={e.rang} />
      {e.badge === 'contrefacon' && <span className="badge">Contrefaçon</span>}
      {e.badge === 'maudite' && <span className="badge ko">Maudite</span>}
      {e.engagee && <span className="badge">Dans un échange</span>}
      {e.cachee && <span className="badge">Cachée</span>}
      <div className="detail info">
        {e.provenance} · {e.obtenue}
        {e.cachee && ' · ne compte pas tant qu’elle n’est pas remise en place'}
      </div>
      {!gele && !e.engagee && e.apparence === 'normale' && (e.designe || e.cachee) && (
        <button className="lien" onClick={() => onDeplacer(e.itemId, !e.cachee)}>
          {e.cachee ? 'Remettre en place' : 'Cacher dans les emplacements libres'}
        </button>
      )}
    </>
  );
}
