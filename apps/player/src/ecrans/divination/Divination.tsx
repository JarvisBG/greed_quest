// RG-5.4 : révélation du type de Nen par la divination de l'eau, en plein écran (prototype validé le 2026-10-10).
// Le type vient du serveur ; cette scène ne fait que le montrer. Séquence : Ren → effet dans le verre →
// carton en kanji → Wing → hexagone → pouvoir.
import type { NenType, PouvoirSpe } from '@gq/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { NENS, POUVOIRS_SPE } from '../../lib/format';
import { HexagoneNen } from './HexagoneNen';
import { creerScene, TEMPS, type Scene } from './scene';

/** Ce que l'eau a fait, dit par Wing. */
const SIGNE: Record<NenType, string> = {
  renforcement: 'L’eau déborde du verre.',
  emission: 'L’eau a changé de couleur.',
  transformation: 'Goûte-la : l’eau a changé de goût.',
  materialisation: 'Des cristaux sont apparus dans l’eau.',
  manipulation: 'La feuille tourne toute seule.',
  specialisation: 'La feuille s’est flétrie, et l’eau scintille. Aucun des cinq autres signes.',
};

type Etape = 'attente' | 'ren' | 'carton' | 'wing' | 'hexagone' | 'fin';

export function Divination({ nen, pouvoirSpe, onFini }: { nen: NenType; pouvoirSpe: PouvoirSpe | null; onFini: () => void }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const [etape, setEtape] = useState<Etape>('attente');
  const [replique, setReplique] = useState('');
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const n = NENS[nen];
  const spe = pouvoirSpe ? POUVOIRS_SPE[pouvoirSpe] : null;
  const phrase = `${SIGNE[nen]} Tu es du type ${n.nom}.`;

  useEffect(() => {
    const cv = toile.current;
    if (!cv) return;
    const couleur = getComputedStyle(cv).getPropertyValue(`--nen-${nen}`);
    scene.current = creerScene(cv, nen, couleur, calme);
    return () => scene.current?.arreter();
  }, [nen, calme]);

  // Fond de page bloqué pendant la scène (elle couvre tout l'écran).
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  // Les étapes suivantes partent toutes du Ren (ne pas dépendre de `etape`, sinon chaque étape annulerait les autres).
  const lance = etape !== 'attente';
  useEffect(() => {
    if (!lance) return;
    const plus = (s: number, e: Etape) => setTimeout(() => setEtape(e), calme ? 0 : s * 1000);
    const minuteurs = calme ? [plus(0, 'fin')] : [plus(TEMPS.carton, 'carton'), plus(TEMPS.wing, 'wing'), plus(TEMPS.hexagone, 'hexagone'), plus(TEMPS.fin, 'fin')];
    return () => minuteurs.forEach(clearTimeout);
  }, [lance, calme]);

  // Wing parle lettre par lettre, comme une boîte de dialogue de console.
  const parle = etape === 'wing';
  useEffect(() => {
    if (!parle) return;
    if (calme) return setReplique(phrase);
    let i = 0;
    const t = setInterval(() => {
      setReplique(phrase.slice(0, ++i));
      if (i >= phrase.length) clearInterval(t);
    }, 26);
    return () => clearInterval(t);
  }, [parle, phrase, calme]);

  const apres = (e: Etape) => {
    const ordre: Etape[] = ['attente', 'ren', 'carton', 'wing', 'hexagone', 'fin'];
    return ordre.indexOf(etape) >= ordre.indexOf(e);
  };

  return (
    <div className="divination" role="dialog" aria-modal="true" aria-label="Divination par l’eau" style={{ '--type': `var(--nen-${nen})` } as CSSProperties}>
      <section className={`scene${apres('hexagone') ? ' hexa' : ''}${etape === 'fin' ? ' fin' : ''}`}>
        <canvas ref={toile} aria-hidden="true" />
        {etape === 'attente' && <p className="consigne">Pose tes mains autour du verre, sans le toucher, et libère ton aura.</p>}
        {etape === 'ren' && !calme && (
          <div className="cri" aria-hidden="true">
            <b>練</b>
            <span>REN !</span>
          </div>
        )}
        {apres('carton') && (
          <div className="carton" aria-hidden={!apres('fin')}>
            <span className="kanji" lang="ja">
              {n.kanji}
            </span>
            <span className="nom">{n.nom}</span>
          </div>
        )}
        <div className={`wing${apres('wing') ? ' vu' : ''}`} role="status">
          <span className="qui">Wing</span>
          <p>
            <span aria-hidden="true">{replique}</span>
            <span className="sr">{apres('wing') ? phrase : ''}</span>
          </p>
        </div>
        {apres('hexagone') && <HexagoneNen type={nen} />}
        <div className="pouvoir">
          <h2>{spe ? `Ton pouvoir secret : ${spe.nom}` : `Pouvoir de ${n.nom}`}</h2>
          <p>{spe ? `${spe.effet}. Les autres joueurs ne savent pas lequel tu as.` : n.passif}</p>
        </div>
        {etape === 'attente' && (
          <button
            className="btn-ren"
            onClick={() => {
              scene.current?.lancer();
              setEtape('ren');
            }}
          >
            Ren !
          </button>
        )}
        <button className="continuer" onClick={onFini} disabled={etape !== 'fin'}>
          Commencer à jouer
        </button>
      </section>
    </div>
  );
}
