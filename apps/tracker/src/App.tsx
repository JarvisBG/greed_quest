// Écran géant (Phase 5, apps/tracker) : lecture seule, public, sans interaction une fois lancé.
// Adresse : /?partie=<id>. Un clic à l'ouverture autorise le son (les navigateurs le coupent sinon).
import { useEffect, useRef, useState } from 'react';
import { Cinematique } from './ecran/Cinematiques';
import { Accueil, Bas, FinFigee, Haut, Pause } from './ecran/Habillage';
import { Plateau } from './ecran/Plans';
import { activerSon, dire } from './lib/son';
import { enMarche, useEcran } from './lib/useEcran';

const lu = new URLSearchParams(location.search).get('partie')?.trim() ?? '';
// Code court tapé en minuscules : même code (les anciens identifiants longs restent tels quels).
const partieId = /^[a-z0-9]{6}$/i.test(lu) ? lu.toUpperCase() : lu || null;

/** L'écran garde ses 1920 × 1080, centré et mis à l'échelle de la fenêtre. */
function useEchelle(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const echelle = () => {
      const k = Math.min(innerWidth / 1920, innerHeight / 1080);
      if (ref.current) ref.current.style.transform = `translate(${(innerWidth - 1920 * k) / 2}px, ${(innerHeight - 1080 * k) / 2}px) scale(${k})`;
    };
    echelle();
    addEventListener('resize', echelle);
    return () => removeEventListener('resize', echelle);
  });
}

function Lancer({ onChoix }: { onChoix: (son: boolean) => void }) {
  return (
    <div className="lancer">
      <div>
        <b>Écran géant</b>
        <p>Le son se lance une seule fois, à l'ouverture : les navigateurs le coupent tant que personne n'a touché la page.</p>
        <button type="button" onClick={() => onChoix(true)}>
          Lancer avec le son
        </button>
        <button type="button" className="discret" onClick={() => onChoix(false)}>
          Sans le son
        </button>
      </div>
    </div>
  );
}

export function App() {
  const ecran = useRef<HTMLDivElement>(null);
  const [lance, setLance] = useState(false);
  const { vue: v, erreur, cine, finCine, evenementPose, raidMontre, raidFini, entreeFinie } = useEcran(partieId);
  const [, setSeconde] = useState(0);
  useEchelle(ecran);
  // Le chrono et les décomptes avancent chaque seconde.
  useEffect(() => {
    const t = setInterval(() => setSeconde((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const lancer = (son: boolean) => {
    void activerSon(son).then(() => son && dire('Bienvenue dans Greed Island !'));
    setLance(true);
  };

  if (!partieId || (!v && erreur)) {
    return (
      <div className="message">
        <b>Écran géant</b>
        <p>{!partieId ? "Ajoute l'identifiant de la partie à l'adresse : ?partie=…" : `Impossible d'afficher la partie : ${erreur}.`}</p>
      </div>
    );
  }
  if (!v) return <div className="message">Chargement…</div>;

  const etat = v.partie.etat;
  const accueil = etat === 'inscriptions' || etat === 'brouillon';
  const fin = etat === 'terminee';
  const onFin = () => {
    if (!cine) return;
    if (cine.k === 'claque') evenementPose(cine.ev);
    if (cine.k === 'alarme') raidMontre();
    if (cine.k === 'raid_fin') raidFini();
    finCine();
  };

  return (
    <>
      <div className="ecran" ref={ecran}>
        <Haut v={v} />
        <Plateau v={v} arrete={!!cine || !enMarche(etat)} />
        <Bas v={v} />
        {accueil && <Accueil v={v} onEntree={entreeFinie} />}
        {fin && <FinFigee v={v} />}
        {etat === 'pause' && <Pause />}
        {cine && lance && <Cinematique key={cine.id} item={cine} classement={v.classement} n={v.nCartes} zones={v.partie.zones} onFin={onFin} />}
      </div>
      {!lance && <Lancer onChoix={lancer} />}
    </>
  );
}
