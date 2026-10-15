// Cinématiques des grands moments (nuit de Greed Island), reprises telles quelles du prototype validé :
// tirage S/SS, Jarvis, Sceau d'Ange, alarme et fin du raid, Clear, gong et podium. Une à la fois, en file.
// L'évènement qui commence est une case qui claque sur la planche, dans la même file.
import { NOMS_CARTES_GM } from '@gq/shared';
import { Carte, CarteNoire } from '@gq/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { A, attendre, secouer } from '../lib/anim';
import { bruiter, calme, dire } from '../lib/son';
import { etiquette, phraseEvenement, trier } from '../lib/textes';
import type { Cine } from '../lib/useEcran';
import type { LigneClassement, ZoneEcran } from '../lib/types';

interface Ctx {
  cine: HTMLDivElement;
  signal: AbortSignal;
  fond: (css: string) => void;
}
type Scenario = (c: Ctx) => Promise<void>;

/** Joue un scénario au montage ; la nuit apparaît, puis s'efface à la fin. */
function useScenario(ref: React.RefObject<HTMLDivElement | null>, s: Scenario, onFin: () => void, nuit = true) {
  useEffect(() => {
    const cine = ref.current;
    if (!cine) return;
    const ctl = new AbortController();
    (async () => {
      if (nuit) cine.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calme ? 1 : 260, fill: 'forwards' });
      await s({ cine, signal: ctl.signal, fond: (css) => (cine.style.background = css) });
      if (ctl.signal.aborted) return;
      if (nuit) await cine.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calme ? 1 : 420, fill: 'forwards' }).finished.catch(() => undefined);
      if (!ctl.signal.aborted) onFin();
    })();
    return () => ctl.abort();
    // Le scénario se joue une fois, au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Nuit({ children, s, onFin }: { children: ReactNode; s: Scenario; onFin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useScenario(ref, s, onFin);
  return (
    <div className="cine on" ref={ref} aria-live="assertive">
      {children}
    </div>
  );
}

const $ = (r: Element, s: string) => r.querySelector(s);
const $$ = (r: Element, s: string) => [...r.querySelectorAll(s)];

// ---------- Tirage S / SS ----------
function Tirage({ item, onFin }: { item: Extract<Cine, { k: 'tirage' }>; onFin: () => void }) {
  const e = item.e;
  const lueur = e.rang === 'SS' ? 'rgba(246,220,133,.75)' : 'rgba(225,232,240,.65)';
  return (
    <Nuit
      onFin={onFin}
      s={async ({ cine, signal }) => {
        bruiter('souffle');
        bruiter('impact', 900);
        bruiter('eclat', 950);
        dire(`Carte rare ! Un joueur a tiré une carte de rang ${e.rang === 'SS' ? 'double S' : e.rang} !`, { delai: 1000 });
        A($(cine, '.porte .gi-carte'), [{ transform: 'translateY(420px) rotateY(180deg) scale(.6)', opacity: 0 }, { transform: 'translateY(-20px) rotateY(10deg) scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 1300 });
        $$(cine, '.txt > *').forEach((el, i) => A(el, [{ transform: 'translateX(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 900 + i * 180 }));
        await attendre(6800, signal);
      }}
    >
      <div className="vitesse" />
      <div className="c-tirage">
        <div className="porte" style={{ '--lueur': lueur } as React.CSSProperties}>
          <Carte genre="designee" numero={e.numero ?? null} nom={e.carte} rang={e.rang} limite={e.limite ?? null} texte={e.texte ?? null} />
        </div>
        <div className="txt">
          <span className="ligne-jeu" style={{ textAlign: 'left' }}>
            Le jeu annonce une carte rare
          </span>
          <span className="nom-j" style={{ textAlign: 'left' }}>
            {e.pseudo}
          </span>
          <span className="ligne-jeu" style={{ textAlign: 'left' }}>
            {e.type === 'arene' ? "gagne à l'arène" : 'a tiré'} « {e.carte} »
          </span>
          <span className={`rang-gros r-${e.rang}`}>Rang {e.rang}</span>
        </div>
      </div>
    </Nuit>
  );
}

// ---------- Jarvis tout-puissant (RG-8.19) ----------
function Jarvis({ item, onFin }: { item: Extract<Cine, { k: 'jarvis' }>; onFin: () => void }) {
  const n = item.figes.length;
  return (
    <Nuit
      onFin={onFin}
      s={async ({ cine, signal, fond }) => {
        fond('radial-gradient(circle at 30% 50%, #3a2a08 0%, #0c0c0e 65%)');
        bruiter('gong', 1300);
        dire('Jarvis a parlé !', { delai: 1300, vitesse: 0.85, hauteur: 0.6 });
        dire('Un joueur reçoit une carte par Décret. Les joueurs autour de lui sont gelés.', { delai: 2600 });
        A($(cine, '.gi-carte'), [{ transform: 'translateY(500px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1200 });
        A($(cine, '.gros'), [{ transform: 'scale(2.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, delay: 1300, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        A($(cine, '.eclair'), [{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { duration: 500, delay: 1300, easing: 'ease-out' });
        setTimeout(() => !signal.aborted && secouer(cine), calme ? 0 : 1350);
        A($(cine, '.onde'), [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(12)', opacity: 0 }], { duration: 1400, delay: 1400, easing: 'ease-out' });
        A($(cine, '.onde.gel'), [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(12)', opacity: 0 }], { duration: 1600, delay: 3400, easing: 'ease-out' });
        $$(cine, '.lignes p').forEach((el, i) => A(el, [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 2300 + i * 1000 }));
        await attendre(8600, signal);
      }}
    >
      <div className="vitesse" />
      <div className="onde" />
      <div className="onde gel" />
      <div className="c-gm">
        <CarteNoire gm="jarvis" />
        <div>
          <div className="gros">
            JARVIS
            <br />A PARLÉ
          </div>
          <div className="lignes">
            <p>
              {item.lanceur} reçoit par Décret <b>« {item.carte} »</b>
              {item.reprisA ? `, reprise à ${item.reprisA}` : ''}.
            </p>
            <p>{n ? <>Jugement : <b>{n} Hunter{n > 1 ? 's' : ''} gelé{n > 1 ? 's' : ''} 3 min</b>.</> : 'Personne autour : le Jugement ne gèle personne.'}</p>
            <p>{item.lanceur} est intouchable 10 min.</p>
          </div>
        </div>
      </div>
      <div className="eclair" />
    </Nuit>
  );
}

// ---------- Le Sceau d'Ange (RG-8.20) ----------
function Ange({ item, onFin }: { item: Extract<Cine, { k: 'ange' }>; onFin: () => void }) {
  const r = 420;
  const L = Math.ceil(2 * Math.PI * r);
  return (
    <Nuit
      onFin={onFin}
      s={async ({ cine, signal, fond }) => {
        fond('radial-gradient(circle at 30% 50%, #1d2a3d 0%, #0c0c0e 65%)');
        bruiter('impact', 1200);
        dire("Le Sceau d'Ange ! Un joueur a scellé le Book d'un autre joueur.", { delai: 1200, vitesse: 0.95 });
        A($(cine, '.sc1'), [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1600, delay: 600, easing: 'cubic-bezier(.5,0,.3,1)' });
        A($(cine, '.sc2'), [{ opacity: 0, transform: 'rotate(0deg)' }, { opacity: 1, transform: 'rotate(40deg)' }], { duration: 2200, delay: 1400 });
        A($(cine, '.gi-carte'), [{ transform: 'translateY(-300px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100 });
        A($(cine, '.gros'), [{ opacity: 0, filter: 'blur(20px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 900, delay: 1200 });
        $$(cine, '.lignes p').forEach((el, i) => A(el, [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 2400 + i * 900 }));
        await attendre(7600, signal);
      }}
    >
      <svg className="sceau-cercle" viewBox="-450 -450 900 900" aria-hidden="true" style={{ left: 'calc(50% - 900px)', top: 'calc(50% - 450px)' }}>
        <circle className="sc1" r={r} fill="none" stroke="#f4f4ef" strokeWidth="6" strokeDasharray={L} strokeDashoffset={L} />
        <circle className="sc2" r={r - 30} fill="none" stroke="#d7b25a" strokeWidth="3" strokeDasharray="12 10" opacity="0" />
      </svg>
      <div className="c-gm">
        <CarteNoire gm="ange" />
        <div>
          <div className="gros" style={{ fontSize: 128 }}>
            LE SCEAU
            <br />
            D'ANGE
          </div>
          <div className="lignes">
            <p>
              <b>{item.lanceur}</b> a scellé le Book de <b>{item.cible}</b>.
            </p>
            <p>
              Ni scan, ni sort, ni échange pendant <b>5 min</b>.
            </p>
          </div>
        </div>
      </div>
    </Nuit>
  );
}

// ---------- Raid : alarme, puis issue ----------
function Alarme({ onFin }: { onFin: () => void }) {
  return (
    <Nuit
      onFin={onFin}
      s={async ({ cine, signal }) => {
        bruiter('sirene');
        bruiter('impact');
        dire('Alerte ! La Brigade attaque ! Tous les Hunters au combat !', { delai: 300, vitesse: 1.15, hauteur: 1 });
        A($(cine, '.boite'), [{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        secouer(cine);
        await attendre(3600, signal);
      }}
    >
      <div className="c-alarme">
        <div className="boite">
          <div className="ligne-jeu">ALERTE</div>
          <div className="gros">
            LA BRIGADE
            <br />
            ATTAQUE
          </div>
          <div className="ligne-jeu">Tous les Hunters sont appelés au combat</div>
        </div>
      </div>
    </Nuit>
  );
}

function RaidFin({ item, onFin }: { item: Extract<Cine, { k: 'raid_fin' }>; onFin: () => void }) {
  const { reussi, frappeurs, pv } = item;
  return (
    <Nuit
      onFin={onFin}
      s={async ({ cine, signal, fond }) => {
        if (reussi) {
          bruiter('fanfare');
          dire('La Brigade est vaincue ! Bravo les Hunters !', { delai: 300 });
          fond('radial-gradient(circle, #3a2a08 0%, #0c0c0e 70%)');
        } else {
          bruiter('impact');
          dire("La Brigade s'est enfuie.", { delai: 300, vitesse: 0.95 });
        }
        A($(cine, '.gros'), [{ transform: 'scale(2)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,1.4,.4,1)' });
        await attendre(5200, signal);
      }}
    >
      {reussi && <div className="vitesse" />}
      <div style={{ display: 'grid', justifyItems: 'center', gap: 30 }}>
        <div className="gros" style={{ color: reussi ? 'var(--or-clair)' : '#ff5048' }}>
          LA BRIGADE
          <br />
          {reussi ? 'EST VAINCUE' : "S'EST ENFUIE"}
        </div>
        <div className="ligne-jeu">
          {reussi
            ? `${frappeurs} Hunter${frappeurs > 1 ? 's' : ''} reçoi${frappeurs > 1 ? 'vent' : 't'} un paquet de 3 sorts`
            : `Il lui restait ${pv.toLocaleString('fr-FR')} PV. La prochaine fois peut-être.`}
        </div>
      </div>
    </Nuit>
  );
}

// ---------- Clear et fin ----------
function Clear({ item, n, onFin }: { item: Extract<Cine, { k: 'clear' }>; n: number; onFin: () => void }) {
  return (
    <Nuit
      onFin={onFin}
      s={async ({ cine, signal, fond }) => {
        fond('radial-gradient(circle, #4a360a 0%, #0c0c0e 70%)');
        bruiter('impact', 480);
        bruiter('fanfare', 800);
        dire('Clear ! Un joueur a réuni toutes les cartes désignées !', { delai: 700, vitesse: 1 });
        A($(cine, '.sceau-clear'), [{ transform: 'scale(3) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(-8deg)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,1.5,.4,1)' });
        setTimeout(() => !signal.aborted && secouer(cine), calme ? 0 : 480);
        $$(cine, '.c-clear > :not(.sceau-clear)').forEach((el, i) => A(el, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 900 + i * 400 }));
        await attendre(7000, signal);
      }}
    >
      <div className="vitesse" />
      <div className="c-clear">
        <div className="sceau-clear">CLEAR</div>
        <div className="nom-j" style={{ fontSize: 150, color: 'var(--or-clair)' }}>
          {item.pseudo}
        </div>
        <div className="ligne-jeu">a réuni les {n} cartes désignées</div>
      </div>
    </Nuit>
  );
}

function Fin({ classement, n, onFin }: { classement: LigneClassement[]; n: number; onFin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [a, b, c] = trier(classement);
  const marche = (j: LigneClassement | undefined, k: 1 | 2 | 3) =>
    j ? (
      <div className={`marche p${k}`}>
        <div className="nom-j">{j.pseudo}</div>
        <span>
          {j.cartes} / {n} cartes · {j.points} pts
        </span>
        <div className={`bloc m${k}`}>{k}</div>
      </div>
    ) : (
      <div className={`marche p${k}`} />
    );
  useScenario(ref, async ({ cine, signal }) => {
    const gong = $(cine, '.temps-gong') as HTMLElement;
    const podium = $(cine, '.temps-podium') as HTMLElement;
    bruiter('gong');
    dire('Fin de la partie !', { delai: 400, vitesse: 0.85, hauteur: 0.7 });
    $$(gong, '.onde').forEach((o, i) => A(o, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(14)', opacity: 0 }], { duration: 2200, delay: i * 500, easing: 'ease-out' }));
    A($(gong, '.gros'), [{ transform: 'scale(1.3)', opacity: 0, letterSpacing: '0.3em' }, { transform: 'none', opacity: 1, letterSpacing: '0.02em' }], { duration: 1400 });
    await attendre(3400, signal);
    if (signal.aborted) return;
    gong.style.display = 'none';
    podium.style.display = 'contents';
    // Le podium se révèle du troisième au premier.
    bruiter('impact', 300);
    bruiter('impact', 1600);
    bruiter('impact', 3100);
    bruiter('fanfare', 3400);
    dire('Troisième place !', { delai: 500 });
    dire('Deuxième place !', { delai: 1800 });
    dire('Et voici le vainqueur !', { delai: 3300, vitesse: 0.95 });
    ([['.p3', 0], ['.p2', 1300], ['.p1', 2800]] as const).forEach(([s, t]) => {
      const m = $(podium, s);
      if (!m) return;
      A($(m, '.bloc'), [{ transform: 'scaleY(0)', transformOrigin: 'bottom' }, { transform: 'scaleY(1)', transformOrigin: 'bottom' }], { duration: 800, delay: t });
      A($(m, '.nom-j'), [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: t + 600 });
      A($(m, 'span'), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: t + 800 });
    });
    await attendre(7600, signal);
  }, onFin);
  return (
    <div className="cine on" ref={ref} aria-live="assertive">
      <div className="temps-gong" style={{ display: 'contents' }}>
        <div className="onde" style={{ boxShadow: '0 0 0 8px #f4f4ef' }} />
        <div className="onde" style={{ boxShadow: '0 0 0 4px #f4f4ef' }} />
        <div className="gros">
          FIN DE
          <br />
          LA PARTIE
        </div>
      </div>
      <div className="temps-podium" style={{ display: 'none' }}>
        <div className="vitesse" />
        <div className="c-podium">
          {marche(b, 2)}
          {marche(a, 1)}
          {marche(c, 3)}
        </div>
      </div>
    </div>
  );
}

// ---------- Évènement qui commence : une case qui claque sur la planche ----------
function Claque({ item, zones, onFin }: { item: Extract<Cine, { k: 'claque' }>; zones: ZoneEcran[]; onFin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const e = item.ev;
  const { titre, maudite } = etiquette(e);
  const zone = e.zoneId ? zones.find((z) => z.id === e.zoneId)?.nom : null;
  useScenario(
    ref,
    async ({ cine, signal }) => {
      const boite = $(cine, '.boite');
      bruiter('impact');
      const phrase = phraseEvenement[e.type];
      if (phrase) dire(phrase, { delai: 200 });
      A(boite, [{ transform: 'rotate(-14deg) scale(2)', opacity: 0 }, { transform: 'rotate(-3deg) scale(1)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,1.5,.4,1)' });
      await attendre(3800, signal);
      if (signal.aborted) return;
      await A(boite, [{ transform: 'rotate(-3deg)', opacity: 1 }, { transform: 'rotate(-3deg) translateY(-500px) scale(.3)', opacity: 0 }], { duration: 600, easing: 'cubic-bezier(.6,0,.8,.4)' })?.finished.catch(() => undefined);
    },
    onFin,
    false,
  );
  return (
    <div className="claque on" ref={ref}>
      <div className={`boite${maudite ? ' nuit' : ''}`}>
        <b>{titre}</b>
        <span>
          {e.texte ?? (zone ? zone : '')} · {Math.max(1, Math.round(e.resteMs / 60_000))} min
        </span>
      </div>
    </div>
  );
}

export function Cinematique({ item, classement, n, zones, onFin }: { item: Cine; classement: LigneClassement[]; n: number; zones: ZoneEcran[]; onFin: () => void }) {
  switch (item.k) {
    case 'tirage':
      return <Tirage item={item} onFin={onFin} />;
    case 'jarvis':
      return <Jarvis item={item} onFin={onFin} />;
    case 'ange':
      return <Ange item={item} onFin={onFin} />;
    case 'alarme':
      return <Alarme onFin={onFin} />;
    case 'raid_fin':
      return <RaidFin item={item} onFin={onFin} />;
    case 'clear':
      return <Clear item={item} n={n} onFin={onFin} />;
    case 'fin':
      return <Fin classement={classement} n={n} onFin={onFin} />;
    case 'claque':
      return <Claque item={item} zones={zones} onFin={onFin} />;
  }
}

export const nomGm = (gm: 'jarvis' | 'ange') => NOMS_CARTES_GM[gm].nom;
