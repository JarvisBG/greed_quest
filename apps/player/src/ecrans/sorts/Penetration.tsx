// Page ⑨ : Pénétration (prototype validé par Sivraj le 2026-10-12 : docs/prototype/sorts-information.html). Ta page du
// Book s'ouvre dans la nuit ; une lumière bleue la balaie de haut en bas. Au passage, chaque contrefaçon se fend puis
// se retourne (RG-8.9) : un doublon déguisé montre sa vraie carte, une copie devient « Contrefaçon de… », grisée et
// tamponnée « FAUX ». Démasquée dans un emplacement fixe, elle le quitte pour les emplacements libres ; son numéro
// réapparaît en creux. La légende dit ce que c'était et d'où elle venait (RG-8.8).
import { Carte, numeroCarte } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { bilanPenetration, type PochePenetration } from '../../lib/penetration';

interface Props {
  titre: string;
  numeroPage: number;
  poches: PochePenetration[];
  /** Étincelles du lancer, au point (x, y) de l'écran. */
  etincelles: (x: number, y: number) => void;
  onFermer: () => void;
}

const FELURES = ['M31 42 24 30 27 17 20 3', 'M31 42 41 35 50 38 61 28', 'M31 42 36 56 31 70 38 86', 'M31 42 19 50 6 47'];

export function Penetration({ titre, numeroPage, poches, etincelles, onFermer }: Props) {
  const page = useRef<HTMLDivElement>(null);
  const fermer = useRef<HTMLButtonElement>(null);
  const [fini, setFini] = useState(false);
  const bilan = bilanPenetration(poches);
  const restes = 12 - poches.length;
  const span = restes % 3 || 3;
  const nums = poches.flatMap((p) => (p.type === 'absente' ? [p.numero] : p.type === 'carte' ? [p.carte.numero] : [])).filter((n): n is number => n !== null);

  useEffect(() => {
    const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = page.current!;
    const minuteries: number[] = [];
    const plus = (f: () => void, ms: number) => minuteries.push(window.setTimeout(f, calme ? 0 : ms));
    const anims: Animation[] = [];
    const A = (e: Element, k: Keyframe[], o: KeyframeAnimationOptions & { duration: number }) => {
      const a = e.animate(k, { fill: 'forwards', ...o, duration: calme ? 1 : o.duration, delay: calme ? 0 : (o.delay ?? 0) });
      anims.push(a);
      return a;
    };
    const DEBUT = 450;
    const DUREE = 1700;
    const balai = el.querySelector<HTMLElement>('.penetration-balai')!;
    plus(() => {
      balai.style.opacity = '1';
      A(balai, [{ transform: 'translateY(0)' }, { transform: `translateY(${el.getBoundingClientRect().height}px)` }], { duration: DUREE, easing: 'linear' });
    }, DEBUT);
    const pr = el.getBoundingClientRect();
    let fin = DEBUT + DUREE + 200;
    el.querySelectorAll<HTMLElement>('.poche[data-k]').forEach((poche) => {
      const p = poches[Number(poche.dataset.k)];
      if (p?.type !== 'carte') return;
      const pb = poche.getBoundingClientRect();
      const t = DEBUT + ((pb.top + pb.height / 2 - pr.top) / pr.height) * DUREE;
      if (!p.demasquee) {
        plus(() => A(poche, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.3)' }, { filter: 'brightness(1)' }], { duration: 420, easing: 'ease-out', fill: 'none' }), t);
        return;
      }
      fin = Math.max(fin, t + (p.designe ? 2600 : 1400));
      // La lumière la touche : elle se fend, tremble, puis se retourne.
      plus(() => {
        poche.querySelectorAll('.penetration-feles path').forEach((f, i) => A(f, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 220, delay: i * 30, easing: 'ease-out' }));
        A(poche, [{ transform: 'none' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 260, fill: 'none' });
        const b = poche.getBoundingClientRect();
        if (!calme) {
          etincelles(b.left + b.width / 2, b.top + b.height / 2);
          navigator.vibrate?.([20, 30, 20]);
        }
      }, t);
      const ret = poche.querySelector('.penetration-retourne')!;
      plus(() => {
        A(poche.querySelector('.penetration-feles')!, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
        A(ret, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(180deg)' }], { duration: 560, easing: 'cubic-bezier(.3,0,.2,1)' });
      }, t + 440);
      // Démasquée dans un emplacement fixe : elle part vers les emplacements libres.
      if (p.designe)
        plus(() => A(ret, [{ transform: 'rotateY(180deg)', opacity: 1 }, { transform: 'rotateY(180deg) translateY(40%) scale(.55)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.5,0,.75,0)' }), t + 1900);
    });
    plus(() => {
      A(balai, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      setFini(true);
      fermer.current?.focus({ preventScroll: true });
    }, fin);
    return () => {
      minuteries.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
    };
    // une Pénétration = une séquence
  }, []);

  return (
    <div className="lancer-vision penetration" role="dialog" aria-label={titre} onPointerDown={(e) => e.stopPropagation()}>
      <p className="lancer-vision-titre">{titre}</p>
      <div ref={page} className="page lancer-vision-page p-designee penetration-page">
        <div className="page-tete">
          <span>Ta page {numeroPage}</span>
          <span>{nums.length ? `${numeroCarte(nums[0])} – ${numeroCarte(nums.at(-1))}` : 'Libres'}</span>
        </div>
        <div className="poches">
          {poches.map((p, k) => {
            if (p.type === 'vide') return <span key={k} className="poche" aria-hidden="true" />;
            const creux = (n: number | null, rang: string | null) => (
              <span className="poche-num">
                {numeroCarte(n)}
                <em>{rang}</em>
              </span>
            );
            if (p.type === 'absente')
              return (
                <span key={k} className="poche" aria-label={`${numeroCarte(p.numero)}, emplacement vide`}>
                  {creux(p.numero, p.rang)}
                </span>
              );
            const d = p.demasquee;
            const etiquette = d && fini ? (d.nature === 'deguise' && d.vraie ? `c’était ${d.vraie.nom}` : 'contrefaçon') : p.carte.nom;
            return (
              <span key={k} className="poche" data-k={k} aria-label={`${numeroCarte(p.carte.numero)}, ${etiquette}`}>
                {p.designe && d && creux(p.carte.numero, p.carte.rang)}
                <span className="penetration-retourne">
                  <span className="penetration-face">
                    <Carte genre="designee" numero={p.carte.numero} nom={p.carte.nom} rang={p.carte.rang} />
                  </span>
                  {d && (
                    <span className="penetration-verite">
                      {d.nature === 'deguise' && d.vraie ? (
                        <Carte genre="designee" numero={d.vraie.numero} nom={d.vraie.nom} rang={d.vraie.rang} />
                      ) : (
                        <>
                          <Carte genre="designee" numero={p.carte.numero} nom={p.carte.nom} rang={p.carte.rang} grisee />
                          <span className="penetration-faux">FAUX</span>
                        </>
                      )}
                    </span>
                  )}
                </span>
                {d && (
                  <svg className="penetration-feles" viewBox="0 0 63 88" preserveAspectRatio="none" aria-hidden="true">
                    {FELURES.map((f) => (
                      <path key={f} pathLength={1} d={f} />
                    ))}
                  </svg>
                )}
              </span>
            );
          })}
          {restes > 0 && (
            <span className="page-folio" style={{ gridColumn: `span ${span}` }} aria-hidden="true">
              {numeroPage}
            </span>
          )}
          {Array.from({ length: Math.max(0, restes - span) }, (_, k) => (
            <span key={`c${k}`} className="case-vide" aria-hidden="true" />
          ))}
        </div>
        <span className="penetration-cadre" aria-hidden="true">
          <span className="penetration-balai" />
        </span>
      </div>
      <p className="lancer-vision-legende penetration-legende" aria-live="polite">
        {fini ? (
          <>
            {bilan.lignes.length ? <b>{bilan.titre}</b> : bilan.titre}
            {bilan.lignes.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </>
        ) : (
          'La lumière examine chaque carte…'
        )}
      </p>
      <div className="lancer-vision-bas">
        <button ref={fermer} className="fermer" onClick={onFermer}>
          Fermer
        </button>
      </div>
    </div>
  );
}
