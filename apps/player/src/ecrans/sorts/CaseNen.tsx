// Page ⑩ (prototype validé par Sivraj le 2026-10-12 : docs/prototype/pouvoirs-nen.html) : la case du Nen, en tête
// de la page Sorts. L'hexagone (même ordre que la divination) allume ton type à la couleur de ton aura ; la jauge se
// remplit pendant la recharge (durée complète reçue de /moi, RG-14) et se vide pendant Zetsu ; un seul éclat d'aura
// quand le pouvoir revient. Renforcement et Matérialisation agissent seuls (tampons PASSIF, AUTO).
import type { NenType } from '@gq/shared';
import { useEffect, useRef, useState } from 'react';
import { NENS } from '../../lib/format';
import { CASES, casePouvoir, POUVOIRS_OFFENSIFS, remplissage, type ClePouvoir } from '../../lib/pouvoir';
import type { Moi } from '../../lib/useJeu';
import { minSec } from './FicheSort';
import { ORDRE_NEN } from '../divination/HexagoneNen';

/** Petit hexagone du Nen : ton type allumé, les autres imprimés ; `eteint` pendant Zetsu. */
export function HexaNen({ type, eteint = false }: { type: NenType; eteint?: boolean }) {
  const R = 36;
  const pts = ORDRE_NEN.map((_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [Math.round(Math.cos(a) * R * 10) / 10, Math.round(Math.sin(a) * R * 10) / 10] as const;
  });
  const moi = ORDRE_NEN.indexOf(type);
  const court = NENS[type].court;
  return (
    <svg className="nen-hexa" viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <pattern id="nen-hexa-trame" width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r=".6" fill="#111" opacity=".35" />
        </pattern>
      </defs>
      <path d={`M${pts.map((p) => p.join(' ')).join('L')}Z`} fill="url(#nen-hexa-trame)" stroke="#111" strokeWidth="2.4" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="#111" strokeWidth=".9" opacity=".5" />
      ))}
      {pts.map(([x, y], i) => (i === moi ? null : <circle key={i} cx={x} cy={y} r="6.5" fill="#fbfbf7" stroke="#111" strokeWidth="1.6" />))}
      <circle cx={pts[moi]![0]} cy={pts[moi]![1]} r="13" fill={eteint ? '#c9cac4' : `var(--nen-${type})`} stroke="#111" strokeWidth="2.8" />
      <circle r="15" fill="#fbfbf7" stroke="#111" strokeWidth="1.6" />
      <text y={court.length > 2 ? 4 : 5.5} textAnchor="middle" className="nen-hexa-k" fontSize={court.length > 2 ? 8.5 : 12}>
        {court}
      </text>
    </svg>
  );
}

const ICONE_AGIR = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

interface Props {
  moi: Moi;
  /** Délai restant avant le prochain sort offensif (RG-10.3) : il retient Émission, Échange forcé et L'épée du vol. */
  offensifDans: number;
  /** Émission chargée : le prochain sort offensif touché part hors de portée. */
  emission: boolean;
  onUtiliser: (cle: ClePouvoir) => void;
  onAnnulerEmission: () => void;
}

export function CaseNen({ moi, offensifDans, emission, onUtiliser, onAnnulerEmission }: Props) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const c = casePouvoir(moi, Math.max(0, maintenant - moi.recuA));
  const ref = useRef<HTMLElement>(null);
  const avant = useRef(c?.etat);
  // Le pouvoir revient : un éclat d'aura, une vibration (pas de clignotement en boucle).
  useEffect(() => {
    if (avant.current === 'recharge' && c?.etat === 'pret' && ref.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ref.current.classList.remove('revient');
      void ref.current.offsetWidth;
      ref.current.classList.add('revient');
      navigator.vibrate?.([20, 60, 20]);
    }
    avant.current = c?.etat;
  }, [c?.etat]);
  if (!c || !moi.nen) return null;

  const texte = CASES[c.cle];
  const zetsu = c.etat === 'actif' && c.cle === 'zetsu';
  const fortune = c.etat === 'actif' && c.cle === 'fortune';
  const rempli = `${(remplissage(c) * 100).toFixed(1)}%`;
  const retenu = POUVOIRS_OFFENSIFS.includes(c.cle) && offensifDans > 0;
  const minutesZetsu = moi.recharges.zetsu ? Math.round(moi.recharges.zetsu / 60_000) : null;
  const tampon = texte.tampon && (c.etat !== 'recharge' || texte.tampon === 'AUTO') ? texte.tampon : null;

  let ligne: React.ReactNode;
  if (zetsu)
    ligne = (
      <>
        <div className="nen-ligne">
          <span className="etat">Tu es invisible</span>
          <span className="temps">{minSec(c.resteMs)}</span>
        </div>
        <div className="nen-jauge" aria-hidden="true">
          <i style={{ width: rempli }} />
        </div>
        <p className="nen-effet">
          Un sort offensif ou une proposition d’échange le rompt.
          {moi.recharges.specialisation ? ` Il revient ${Math.round(moi.recharges.specialisation / 60_000)} min après l’avoir lancé.` : ''}
        </p>
      </>
    );
  else if (fortune)
    ligne = (
      <div className="nen-ligne">
        <PieceFortune className="nen-piece" />
        <span className="etat">Armée : ton prochain scan réussi donne un gain de plus</span>
      </div>
    );
  else if (c.etat === 'recharge' || c.etat === 'auto')
    ligne = (
      <>
        <div className="nen-ligne">
          <span className="etat">{c.etat === 'auto' ? 'Prochain tirage bonus' : 'Se recharge'}</span>
          <span className="temps">{minSec(c.resteMs)}</span>
        </div>
        <div className="nen-jauge" role="progressbar" aria-label={c.etat === 'auto' ? 'Prochain tirage bonus' : 'Recharge'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(remplissage(c) * 100)}>
          <i style={{ width: rempli }} />
        </div>
      </>
    );
  else
    ligne = (
      <>
        <div className="nen-ligne">
          <span className="pret">PRÊT</span>
          {c.cle === 'renforcement' && <span className="etat doux">il annulera le prochain sort offensif reçu</span>}
        </div>
        <div className="nen-jauge" aria-hidden="true">
          <i style={{ width: '100%' }} />
        </div>
      </>
    );

  const agir = c.etat === 'pret' && texte.agir;
  return (
    <section ref={ref} className={`nen-case ${c.etat}${zetsu ? ' eteint' : ''}`} style={{ ['--aura' as string]: `var(--nen-${moi.nen})` }} aria-labelledby="nen-titre">
      <HexaNen type={moi.nen} eteint={zetsu} />
      <p className="nen-sur">
        <span lang="ja">{NENS[moi.nen].kanji}</span>
        {c.secret ? 'Spécialisation' : texte.nom === NENS[moi.nen].nom ? 'Ton pouvoir de Nen' : NENS[moi.nen].nom}
        {c.secret && <span className="secret">Pouvoir secret</span>}
      </p>
      <h2 id="nen-titre">{texte.nom}</h2>
      <p className="nen-effet">{texte.effet}</p>
      {tampon && <span className="nen-tampon">{tampon}</span>}
      <div className="nen-charge">{ligne}</div>
      {agir && emission && (
        <>
          <p className="nen-charge-emission">Émission chargée : touche un sort offensif, tous les joueurs de la partie seront à portée.</p>
          <button className="gi-lien nen-annuler" onClick={onAnnulerEmission}>
            Annuler
          </button>
        </>
      )}
      {agir && !emission && (
        <button className="nen-agir" disabled={retenu} onClick={() => onUtiliser(c.cle)}>
          {retenu ? (
            <>
              Prochain sort offensif dans <b>{minSec(offensifDans)}</b>
            </>
          ) : (
            <>
              {c.cle === 'zetsu' && minutesZetsu ? `Disparaître ${minutesZetsu} min` : texte.agir}
              {ICONE_AGIR}
            </>
          )}
        </button>
      )}
    </section>
  );
}

/** Fortune : une pièce de jenny (« J ») ; `plus` : frappée d'un « +1 ». */
export function PieceFortune({ className, plus = false }: { className?: string; plus?: boolean }) {
  if (plus)
    return (
      <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
        <circle r="46" fill="#e2bd4f" stroke="#111" strokeWidth="7" />
        <text y="15" textAnchor="middle" className="piece-plus">
          +1
        </text>
      </svg>
    );
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="piece-or" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7a6" />
          <stop offset=".45" stopColor="#e2bd4f" />
          <stop offset="1" stopColor="#b38b22" />
        </linearGradient>
      </defs>
      <circle r="47" fill="#a8841f" stroke="#111" strokeWidth="4" />
      <circle r="40" fill="url(#piece-or)" stroke="#111" strokeWidth="2" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a) * 42} y1={Math.sin(a) * 42} x2={Math.cos(a) * 46} y2={Math.sin(a) * 46} stroke="#111" strokeWidth="1.4" />;
      })}
      <text y="15" textAnchor="middle" className="piece-k">
        J
      </text>
    </svg>
  );
}
