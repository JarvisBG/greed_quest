// RG-5.4 : révélation du type de Nen par la divination de l'eau, en plein écran (prototype validé le 2026-10-10).
// Le type vient du serveur ; cette scène ne fait que le montrer. Séquence : Ren → effet dans le verre →
// carton en kanji → Wing → (Spécialiste : question secrète de Wing, amendement 2026-10-10) → hexagone → pouvoir.
import type { NenType, PouvoirSpe } from '@gq/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../../lib/client';
import { NENS, POUVOIRS_SPE } from '../../lib/format';
import type { Question } from '../../lib/quiz';
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

/** Wing tape une lettre toutes les 26 ms ; on laisse ensuite 1,8 s pour finir de lire avant la question secrète. */
const LETTRE_S = 0.026;
const LECTURE_S = 1.8;
const ORDRE: readonly Etape[] = ['attente', 'ren', 'carton', 'wing', 'question', 'hexagone', 'fin'];
type Etape = 'attente' | 'ren' | 'carton' | 'wing' | 'question' | 'hexagone' | 'fin';

export function Divination({
  partieId,
  nen,
  pouvoirSpe: pouvoirRecu,
  question,
  reprise = false,
  onFini,
}: {
  partieId: string;
  nen: NenType;
  pouvoirSpe: PouvoirSpe | null;
  /** Question secrète de Wing, posée au Spécialiste qui n'a pas encore de pouvoir. */
  question: Question;
  /** Le Spécialiste revient (page rechargée) : on reprend à la question secrète. */
  reprise?: boolean;
  onFini: () => void;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const [etape, setEtape] = useState<Etape>(reprise ? 'question' : 'attente');
  const [pouvoirSpe, setPouvoirSpe] = useState(pouvoirRecu);
  const [replique, setReplique] = useState('');
  const [lance, setLance] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const calme = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const n = NENS[nen];
  const spe = pouvoirSpe ? POUVOIRS_SPE[pouvoirSpe] : null;
  const questionSecrete = nen === 'specialisation' && pouvoirRecu === null;
  const phrase = `${SIGNE[nen]} Tu es du type ${n.nom}.${questionSecrete ? ' Ton aura est rare : une dernière question, rien que pour toi.' : ''}`;

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

  // Les étapes partent toutes du Ren (ne pas dépendre de `etape`, sinon chaque étape annulerait les suivantes).
  useEffect(() => {
    if (!lance) return;
    const plus = (s: number, e: Etape) => setTimeout(() => setEtape(e), calme ? 0 : s * 1000);
    const suite = questionSecrete ? [plus(TEMPS.wing + phrase.length * LETTRE_S + LECTURE_S, 'question')] : [plus(TEMPS.hexagone, 'hexagone'), plus(TEMPS.fin, 'fin')];
    const minuteurs = calme ? [plus(0, questionSecrete ? 'question' : 'fin')] : [plus(TEMPS.carton, 'carton'), plus(TEMPS.wing, 'wing'), ...suite];
    return () => minuteurs.forEach(clearTimeout);
  }, [lance, calme, questionSecrete, phrase]);

  // Après la question secrète : l'hexagone, puis le pouvoir.
  const revele = etape === 'hexagone' && questionSecrete;
  useEffect(() => {
    if (!revele) return;
    const t = setTimeout(() => setEtape('fin'), calme ? 0 : 1800);
    return () => clearTimeout(t);
  }, [revele, calme]);

  // Wing parle lettre par lettre, comme une boîte de dialogue de console.
  const parle = etape === 'wing';
  useEffect(() => {
    if (!parle) return;
    if (calme) return setReplique(phrase);
    let i = 0;
    const t = setInterval(() => {
      setReplique(phrase.slice(0, ++i));
      if (i >= phrase.length) clearInterval(t);
    }, LETTRE_S * 1000);
    return () => clearInterval(t);
  }, [parle, phrase, calme]);

  const apres = (e: Etape) => ORDRE.indexOf(etape) >= ORDRE.indexOf(e);

  const repondre = async (reponse: number) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ pouvoirSpe: PouvoirSpe }>(`/parties/${partieId}/nen/secret`, { reponse });
      setPouvoirSpe(r.pouvoirSpe);
      setEtape('hexagone');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="divination" role="dialog" aria-modal="true" aria-label="Divination par l’eau" style={{ '--type': `var(--nen-${nen})` } as CSSProperties}>
      <section className={`scene${etape === 'question' ? ' flou' : ''}${apres('hexagone') ? ' hexa' : ''}${etape === 'fin' ? ' fin' : ''}`}>
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
        <div className={`wing${apres('wing') && etape !== 'question' ? ' vu' : ''}`} role="status">
          <span className="qui">Wing</span>
          <p>
            <span aria-hidden="true">{replique}</span>
            <span className="sr">{apres('wing') ? phrase : ''}</span>
          </p>
        </div>
        {etape === 'question' && (
          <div className="secrete">
            <div className="gi-dialogue">
              <span className="a-qui">Wing</span>
              <h2 className="a-texte">{question.texte}</h2>
            </div>
            <div className="choix">
              {question.choix.map((c, i) => (
                <button key={i} disabled={envoi} onClick={() => void repondre(i)}>
                  {c}
                </button>
              ))}
            </div>
            {erreur && (
              <p className="erreur-scene" role="alert">
                {erreur}
              </p>
            )}
          </div>
        )}
        {apres('hexagone') && <HexagoneNen type={nen} />}
        <div className={`pouvoir${spe ? ' secret' : ''}`}>
          <h2>{spe ? `Ton pouvoir secret : ${spe.nom}` : `Pouvoir de ${n.nom}`}</h2>
          <p>{spe ? `${spe.effet}. Les autres joueurs ne savent pas lequel tu as.` : n.passif}</p>
        </div>
        {etape === 'attente' && (
          <button
            className="btn-ren"
            onClick={() => {
              scene.current?.lancer();
              setEtape('ren');
              setLance(true);
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
