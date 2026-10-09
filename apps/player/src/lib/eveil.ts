// Option « garder l'écran allumé » (Screen Wake Lock) : le GPS et le temps réel restent actifs
// tant que l'écran ne se verrouille pas. Facultative (batterie). Le navigateur relâche le verrou
// quand l'app passe en arrière-plan : on le redemande au retour.

const CLE = 'gq.ecranAllume';

interface Verrou {
  release(): Promise<void>;
}
interface WakeLockApi {
  request(type: 'screen'): Promise<Verrou>;
}

export function eveilDisponible(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function preferenceEveil(storage: Pick<Storage, 'getItem'> = localStorage): boolean {
  try {
    return storage.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

export function creerEveil(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  let verrou: Verrou | null = null;
  let voulu = preferenceEveil(storage);
  const wl = (): WakeLockApi | undefined => (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;

  const prendre = async () => {
    if (!voulu || verrou || document.visibilityState !== 'visible') return;
    try {
      verrou = (await wl()?.request('screen')) ?? null;
    } catch {
      verrou = null; // refusé (batterie faible, navigateur) : sans gravité
    }
  };
  const auRetour = () => {
    verrou = null; // relâché par le navigateur en arrière-plan
    void prendre();
  };

  return {
    demarrer() {
      document.addEventListener('visibilitychange', auRetour);
      void prendre();
    },
    arreter() {
      document.removeEventListener('visibilitychange', auRetour);
      void verrou?.release();
      verrou = null;
    },
    async regler(oui: boolean) {
      voulu = oui;
      try {
        storage.setItem(CLE, oui ? '1' : '0');
      } catch {
        // stockage indisponible : réglage gardé pour la session
      }
      if (oui) await prendre();
      else {
        await verrou?.release();
        verrou = null;
      }
    },
  };
}
