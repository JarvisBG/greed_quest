// RG-8.5 : Livre en pages de 10 (cartes désignées 001 → N, puis emplacements libres).
// RG-8.14 : provenance en clair ; RG-8.13 : emplacement perdu (« Volée par X à 14h05 ») ;
// RG-8.9 : contrefaçons telles que le joueur les connaît. Le serveur décide de tout ce qui est montré.
import type { Rank } from '@gq/shared';
import { useState } from 'react';
import { numeroCarte as num, SORTS, titrePage } from '../lib/format';
import type { Emplacement } from '../lib/livre';
import { useLivre } from '../lib/useLivre';

const LIBRES = 15; // RG-8.5

export function Livre({ partieId, version }: { partieId: string; version: number }) {
  const { livre, erreur } = useLivre(partieId, version);
  const [page, setPage] = useState(0);

  if (!livre) return <p className="info">{erreur ?? 'Chargement du Livre…'}</p>;
  const p = Math.min(page, livre.pages.length - 1);
  return (
    <div className="livre">
      <div className="carte">
        <h1>Livre</h1>
        <p>
          <strong>
            {livre.cartesDesignees}/{livre.total}
          </strong>{' '}
          cartes désignées · emplacements libres {livre.libresUtilises}/{LIBRES}
        </p>
        {livre.libresUtilises >= LIBRES && <p className="erreur">Livre plein : libère un emplacement pour scanner à nouveau.</p>}
        {livre.gele && <p className="erreur">Livre gelé en attendant la décision de l’équipe.</p>}
        {erreur && <p className="info">Hors ligne : dernier état connu.</p>}
      </div>
      <nav className="pages" aria-label="Pages du Livre">
        <button className="secondaire" disabled={p === 0} onClick={() => setPage(p - 1)} aria-label="Page précédente">
          ‹
        </button>
        <span>
          {titrePage(p, livre.total)} <span className="info">({p + 1}/{livre.pages.length})</span>
        </span>
        <button className="secondaire" disabled={p >= livre.pages.length - 1} onClick={() => setPage(p + 1)} aria-label="Page suivante">
          ›
        </button>
      </nav>
      <ul className="emplacements">
        {livre.pages[p]?.map((e, i) => (
          <li key={e.etat === 'plein' ? e.itemId : `${p}-${i}`} className={`emplacement ${e.etat}`}>
            <Contenu e={e} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rang({ rang }: { rang: Rank | null }) {
  return rang ? <span className={`rang r${rang}`}>{rang}</span> : null;
}

function Contenu({ e }: { e: Emplacement }) {
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
      <div className="detail info">
        {e.provenance} · {e.obtenue}
      </div>
    </>
  );
}
