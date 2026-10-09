import { describe, expect, it } from 'vitest';
import { checkScan, isQueuedScanFresh, loopRemaining, previousDrawsOn, type ScanContext } from './scan.js';

const NOW = 1_000_000;

type Over = Partial<Omit<ScanContext, 'player' | 'beacon'>> & {
  player?: Partial<ScanContext['player']>;
  beacon?: Partial<ScanContext['beacon']>;
};

const ctx = (o: Over = {}): ScanContext => ({
  now: NOW,
  gameState: 'en_cours',
  zonesFermees: new Set(),
  k: 3,
  ...o,
  player: {
    status: 'actif',
    geleJusqua: null,
    positionValide: true,
    historiqueTirages: [],
    dernierTirageA: null,
    livrePlein: false,
    ...o.player,
  },
  beacon: { id: 'b1', state: 'active', zoneId: 'z1', stock: 5, ...o.beacon },
});

const code = (o: Over) => {
  const r = checkScan(ctx(o));
  return r.ok ? 'ok' : r.code;
};

describe('RG-7 vérifications de scan', () => {
  it('scan valide', () => {
    expect(checkScan(ctx())).toEqual({ ok: true });
  });

  it('1. partie : refus hors en_cours / phase_finale (RG-4)', () => {
    expect(code({ gameState: 'phase_finale' })).toBe('ok');
    expect(code({ gameState: 'pause' })).toBe('partie_en_pause');
    expect(code({ gameState: 'terminee' })).toBe('partie_terminee');
    expect(code({ gameState: 'inscriptions' })).toBe('partie_non_ouverte');
    expect(code({ gameState: 'brouillon' })).toBe('partie_non_ouverte');
  });

  it('2. joueur : exclu, gelé, sans GPS (RG-7.6)', () => {
    expect(code({ player: { status: 'disqualifie' } })).toBe('joueur_exclu');
    expect(code({ player: { status: 'abandon' } })).toBe('joueur_exclu');
    expect(code({ player: { status: 'gele' } })).toBe('joueur_gele');
    expect(code({ player: { status: 'inactif' } })).toBe('ok');
    expect(code({ player: { positionValide: false } })).toBe('gps_invalide');
  });

  it('2. gel temporaire : refusé avant la fin, accepté après', () => {
    const r = checkScan(ctx({ player: { geleJusqua: NOW + 90_500 } }));
    expect(r).toEqual({ ok: false, code: 'joueur_gele', message: 'Tu es gelé encore 91 s' });
    expect(code({ player: { geleJusqua: NOW } })).toBe('ok');
  });

  it('3. balise : états RG-6 et zone fermée', () => {
    expect(checkScan(ctx({ beacon: { state: 'dormante' } }))).toMatchObject({ message: 'Cette balise dort' });
    expect(checkScan(ctx({ beacon: { state: 'epuisee' } }))).toMatchObject({ message: 'Plus rien ici, cherche ailleurs' });
    expect(checkScan(ctx({ beacon: { state: 'coupee' } }))).toMatchObject({ message: 'Scan refusé' });
    expect(code({ zonesFermees: new Set(['z1']) })).toBe('zone_fermee');
  });

  it('4. RG-7.1 boucle : message RG-7.4', () => {
    const r = checkScan(ctx({ player: { historiqueTirages: ['b1', 'b2'] } }));
    expect(r).toEqual({ ok: false, code: 'boucle', message: 'Boucle : scanne encore 2 balises différentes' });
    expect(checkScan(ctx({ player: { historiqueTirages: ['b1', 'b2', 'b3'] } }))).toMatchObject({
      message: 'Boucle : scanne encore 1 balise différente',
    });
  });

  it('5. RG-7.3 délai de 30 s entre deux tirages', () => {
    expect(checkScan(ctx({ player: { dernierTirageA: NOW - 12_000 } }))).toEqual({
      ok: false,
      code: 'delai',
      message: 'Attends encore 18 s avant de scanner',
    });
    expect(code({ player: { dernierTirageA: NOW - 30_000 } })).toBe('ok');
  });

  it('6. Livre plein (RG-8.5)', () => {
    expect(code({ player: { livrePlein: true } })).toBe('livre_plein');
  });

  it('7. stock vide', () => {
    expect(code({ beacon: { stock: 0 } })).toBe('stock_vide');
  });

  it('l’ordre est respecté : premier échec seulement', () => {
    expect(
      code({ gameState: 'pause', player: { positionValide: false, livrePlein: true }, beacon: { state: 'dormante', stock: 0 } }),
    ).toBe('partie_en_pause');
    expect(code({ player: { historiqueTirages: ['b1'], dernierTirageA: NOW, livrePlein: true }, beacon: { stock: 0 } })).toBe(
      'boucle',
    );
  });
});

describe('RG-7.1 règle de la boucle', () => {
  it('jamais tirée : rien à faire', () => {
    expect(loopRemaining(['b2', 'b3'], 'b1', 3)).toBe(0);
  });

  it('compte les balises distinctes depuis le dernier tirage sur la balise', () => {
    expect(loopRemaining(['b1'], 'b1', 3)).toBe(3);
    expect(loopRemaining(['b1', 'b2', 'b2', 'b3'], 'b1', 3)).toBe(1);
    expect(loopRemaining(['b1', 'b2', 'b3', 'b4'], 'b1', 3)).toBe(0);
    expect(loopRemaining(['b1', 'b2', 'b3', 'b4', 'b1'], 'b1', 3)).toBe(3);
  });

  it('K = 2 sous 8 balises actives', () => {
    expect(loopRemaining(['b1', 'b2', 'b3'], 'b1', 2)).toBe(0);
  });
});

describe('RG-7.2 / RG-7.5', () => {
  it('compte les tirages précédents sur une balise', () => {
    expect(previousDrawsOn(['b1', 'b2', 'b1', 'b3'], 'b1')).toBe(2);
  });

  it('un scan hors ligne de moins de 10 min est traité', () => {
    expect(isQueuedScanFresh(0, 9 * 60_000)).toBe(true);
    expect(isQueuedScanFresh(0, 10 * 60_000)).toBe(false);
  });
});
