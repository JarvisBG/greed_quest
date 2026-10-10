// RG-5.2 : licence QR renouvelée toutes les 30 s, montrée à un PNJ ou au GM (checkpoint, enchère, arène, Clear).
// Calculée sur le téléphone : elle reste valable sans réseau.
// À chaque ouverture (décision de Sivraj, 2026-10-10 ; prototype docs/prototype/licence-presentation.html) :
// la nuit tombe, la carte monte de dos et se retourne en frappant, l'aura du type de Nen jaillit du bord,
// un reflet passe, puis le QR s'imprime sous une ligne de lumière. Toucher pour passer.
// Toutes les 30 s, le nouveau code s'imprime de la même façon.
import type { NenType } from '@gq/shared';
import { Concentration, EmblemeHunter } from '@gq/ui';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../../lib/client';
import { NENS } from '../../lib/format';
import { calculerLicence, decalage, PERIODE_MS } from '../../lib/licence';
import { IconeRetour } from '../Icones';
import { QrCode } from '../QrCode';
import { creerAura, type Aura } from './aura';

const IMPRESSION_MS = 450;
const EASE = 'cubic-bezier(.16,1,.3,1)';

export function Licence({
  partieId,
  joueurId,
  pseudo,
  nen,
  secret,
  onRetour,
}: {
  partieId: string;
  joueurId: string;
  pseudo: string;
  nen: NenType | null;
  secret: string;
  onRetour: () => void;
}) {
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [licence, setLicence] = useState<{ qr: string; expireA: number } | null>(null);
  const [ecart, setEcart] = useState(0);
  const [maintenant, setMaintenant] = useState(Date.now());
  /** Cinématique en cours (nuit, carte au premier plan). */
  const [joue, setJoue] = useState(!calme);
  /** La carte porte l'aura (filet de la couleur du Nen). */
  const [allumee, setAllumee] = useState(calme);
  /** Le QR peut être montré (fin de la cinématique ou cinématique passée). */
  const [presente, setPresente] = useState(calme);
  const [qrAffiche, setQrAffiche] = useState<string | null>(null);
  const [qrNeuf, setQrNeuf] = useState<string | null>(null);

  const r = {
    pres: useRef<HTMLDivElement>(null),
    scene: useRef<HTMLDivElement>(null),
    vol: useRef<HTMLDivElement>(null),
    reflet: useRef<HTMLElement>(null),
    toile: useRef<HTMLCanvasElement>(null),
    neuf: useRef<HTMLDivElement>(null),
    balayage: useRef<HTMLElement>(null),
    jauge: useRef<HTMLElement>(null),
  };
  const arreterCinematique = useRef<() => void>(() => undefined);

  // Recale l'horloge sur celle du serveur quand le réseau est là (sinon heure du téléphone).
  useEffect(() => {
    api.get<{ qr: string; expireA: number }>(`/parties/${partieId}/licence`).then(
      (l) => setEcart(decalage(l.expireA, Date.now())),
      () => undefined,
    );
  }, [partieId]);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const heure = maintenant + ecart;
  const fenetre = Math.floor(heure / PERIODE_MS);
  useEffect(() => {
    let actif = true;
    void calculerLicence(joueurId, secret, fenetre * PERIODE_MS).then((l) => actif && setLicence(l));
    return () => {
      actif = false;
    };
  }, [joueurId, secret, fenetre]);

  // Un nouveau code (ou le premier, une fois la carte présentée) part à l'impression.
  useEffect(() => {
    if (!licence || !presente || licence.qr === qrAffiche) return;
    if (calme) setQrAffiche(licence.qr);
    else setQrNeuf(licence.qr);
  }, [licence, presente, qrAffiche, calme]);

  // Impression : le code apparaît de haut en bas sous une ligne de lumière de l'aura.
  useLayoutEffect(() => {
    const neuf = r.neuf.current;
    const ligne = r.balayage.current;
    if (!qrNeuf || !neuf || !ligne) return;
    const o: KeyframeAnimationOptions = { duration: IMPRESSION_MS, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' };
    const a = neuf.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], o);
    const b = ligne.animate([{ top: '0%', opacity: 1 }, { top: '100%', opacity: 1, offset: 0.92 }, { top: '100%', opacity: 0 }], o);
    navigator.vibrate?.(8);
    a.onfinish = () => {
      setQrAffiche(qrNeuf);
      setQrNeuf(null);
    };
    return () => {
      a.cancel();
      b.cancel();
    };
  }, [qrNeuf]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jauge des 30 s (transform, pas de transition de largeur) ; elle se remplit à la première présentation.
  const remplie = useRef(false);
  const expireA = licence?.expireA ?? 0;
  useEffect(() => {
    const j = r.jauge.current;
    if (!j || !presente || !expireA) return;
    const reste = Math.max(0, Math.min(PERIODE_MS, expireA - (Date.now() + ecart)));
    const part = reste / PERIODE_MS;
    const remplir = remplie.current || calme ? 0 : IMPRESSION_MS;
    remplie.current = true;
    const k: Keyframe[] = remplir
      ? [{ transform: 'scaleX(0)', easing: EASE }, { transform: `scaleX(${part})`, offset: remplir / (remplir + reste), easing: 'linear' }, { transform: 'scaleX(0)' }]
      : [{ transform: `scaleX(${part})` }, { transform: 'scaleX(0)' }];
    const a = j.animate(k, { duration: remplir + reste, easing: 'linear', fill: 'forwards' });
    return () => a.cancel();
  }, [presente, expireA, ecart, calme]); // eslint-disable-line react-hooks/exhaustive-deps

  // La cinématique, une fois par ouverture.
  useEffect(() => {
    if (calme) return;
    const pres = r.pres.current!;
    const scene = r.scene.current!;
    const vol = r.vol.current!;
    const couleur = nen ? getComputedStyle(document.documentElement).getPropertyValue(`--nen-${nen}`).trim() || '#c3c8cf' : '#c3c8cf';
    const aura: Aura = creerAura(r.toile.current!, couleur, () => vol.getBoundingClientRect());
    const anims: Animation[] = [];
    const minuteurs: number[] = [];
    const A = (el: Element, k: Keyframe[], o: KeyframeAnimationOptions) => {
      const a = el.animate(k, { fill: 'forwards', easing: EASE, ...o });
      anims.push(a);
      return a;
    };
    const plus = (ms: number, f: () => void) => minuteurs.push(window.setTimeout(f, ms));
    const $ = (s: string) => pres.querySelector(s)!;
    const nettoyer = () => {
      minuteurs.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      aura.arreter();
    };
    let fini = false;
    const finir = () => {
      if (fini) return;
      fini = true;
      nettoyer();
      setAllumee(true);
      setPresente(true);
      setJoue(false);
    };
    arreterCinematique.current = finir;

    // 1. La nuit tombe, lignes de vitesse.
    A($('.nuit'), [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    A($('.gi-concentration'), [
      { opacity: 0, transform: 'scale(1.35)', easing: EASE },
      { opacity: 0.8, transform: 'scale(1)', offset: 0.35, easing: 'ease-in' },
      { opacity: 0, transform: 'scale(.96)' },
    ], { duration: 1000, easing: 'linear' });

    // 2. La carte monte, de dos, et se retourne.
    A(vol, [
      { transform: 'translateY(62vh) rotateY(180deg) rotateZ(-14deg) scale(.7)', easing: 'cubic-bezier(.2,.9,.25,1)' },
      { transform: 'translateY(0) rotateY(-10deg) rotateZ(2deg) scale(1.05)', offset: 0.82, easing: 'cubic-bezier(.3,0,.2,1)' },
      { transform: 'translateY(0) rotateY(0deg) rotateZ(0deg) scale(1.05)' },
    ], { duration: 680, easing: 'linear' });

    // 3. Impact : image inversée, la carte frappe, l'aura jaillit.
    plus(680, () => {
      navigator.vibrate?.(30);
      A(pres, [{ filter: 'invert(1)' }, { filter: 'invert(1)', offset: 0.99 }, { filter: 'none' }], { duration: 90, easing: 'linear', fill: 'none' });
      A($('.flash'), [{ opacity: 0.55 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
      A(vol, [{ transform: 'scale(1.05)' }, { transform: 'scale(.985)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 380 });
      A(scene, [
        { transform: 'translate(0,0)' },
        { transform: 'translate(-5px,3px)' },
        { transform: 'translate(4px,-3px)' },
        { transform: 'translate(-2px,1px)' },
        { transform: 'translate(0,0)' },
      ], { duration: 160, easing: 'linear', fill: 'none' });
      setAllumee(true);
      aura.eclat(220);
      aura.emettre(700);
      aura.voile();
    });

    // 4. Un reflet traverse la carte ; le QR s'imprime ; la jauge se remplit.
    plus(900, () => A(r.reflet.current!, [{ transform: 'translateX(-70%)' }, { transform: 'translateX(70%)' }], { duration: 650, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'none' }));
    plus(1150, () => setPresente(true));

    // 5. L'aura retombe, la planche revient.
    plus(1500, () => {
      aura.emettre(0);
      aura.voile(500);
    });
    plus(1700, () => A($('.nuit'), [{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-in' }));
    plus(2100, finir);
    // Démontage (ou double montage du mode strict) : on arrête sans toucher à l'état.
    return nettoyer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reste = licence ? Math.max(0, Math.ceil((licence.expireA - heure) / 1000)) : 0;
  const presse = presente && licence !== null && reste <= 5;
  const passer = () => joue && arreterCinematique.current();
  const n = nen ? NENS[nen] : null;

  return (
    <div className="planche licence-page">
      <div className="tete-page">
        <button className="retour" onClick={onRetour} aria-label="Retour à l’accueil">
          <IconeRetour />
        </button>
        <h1 className="titre-ecran">Licence de Hunter</h1>
      </div>

      <section className="gi-case gi-trame licence-case" aria-label="Ta licence">
        <div ref={r.scene} className={`licence-scene${joue ? ' devant' : ''}`} onClick={passer}>
          <div ref={r.vol} className="licence-vol">
            <div className="licence face" style={allumee && nen ? ({ '--filet': `var(--nen-${nen})` } as CSSProperties) : undefined}>
              <div className="licence-tete">
                <EmblemeHunter />
                <div>
                  <strong>HUNTER</strong>
                  <span>Licence de Hunter</span>
                </div>
              </div>
              <div className="qr-plaque">
                <div className="qr-zone" style={nen ? ({ '--aura': `var(--nen-${nen})` } as CSSProperties) : undefined}>
                  <div className="qr-couche">{qrAffiche ? <QrCode texte={qrAffiche} titre={`Licence de ${pseudo}`} marge={1} /> : !joue && <p className="qr-calcul">Calcul du code…</p>}</div>
                  <div ref={r.neuf} className="qr-couche neuf" aria-hidden="true">
                    {qrNeuf && <QrCode texte={qrNeuf} titre="" marge={1} />}
                  </div>
                  <i ref={r.balayage} className="balayage" />
                </div>
                <div className={`compte${presse ? ' presse' : ''}`}>
                  <div className="jauge-30" aria-hidden="true">
                    <i ref={r.jauge} />
                  </div>
                  <b aria-live="off">{presente && licence ? `${reste} s` : ''}</b>
                </div>
              </div>
              <div className="licence-pied">
                <b>{pseudo}</b>
                {n && (
                  <span className="licence-nen" style={{ '--aura': `var(--nen-${nen})` } as CSSProperties}>
                    <span lang="ja">{n.kanji}</span>
                    {n.nom}
                  </span>
                )}
              </div>
              <i ref={r.reflet} className="reflet" aria-hidden="true" />
            </div>
            <div className="licence dos" aria-hidden="true">
              <EmblemeHunter />
            </div>
          </div>
        </div>
      </section>

      <section className="gi-case licence-consigne">
        <p>
          <b>Montre-la à un PNJ ou au GM</b> : checkpoint, enchère, arène, Clear.
        </p>
        <p className="doux">Le code change toutes les 30 secondes et marche sans réseau. Si le scan échoue, monte la luminosité.</p>
      </section>

      {!calme && (
        <>
          <div ref={r.pres} className={`licence-presentation${joue ? ' joue' : ''}`} onClick={passer} aria-hidden="true">
            <div className="nuit" />
            <Concentration graine={23} />
            <div className="flash" />
            {joue && <span className="passer">Touche pour passer</span>}
          </div>
          <canvas ref={r.toile} className="licence-aura" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
