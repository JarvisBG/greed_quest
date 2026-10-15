import { describe, expect, it } from 'vitest';
import { etatsGmRestants, texteGmObtenue, texteGmRecue, texteGmRendue, texteJarvis, texteJarvisAutres } from './cartesGm';
import { genreDePage, nombreDePages, type LivreRecu } from './livre';

const carte = { carteId: 'c', numero: 17, nom: 'Le souffle du grand ange', rang: 'S' as const, texte: null, limite: 2 };

describe('cartes de Maître du jeu (RG-8.15 à 8.21)', () => {
  it('RG-8.19 : la boîte du lanceur dit la carte, les joueurs figés et l’intouchabilité', () => {
    expect(texteJarvis({ gm: 'jarvis', carte, reprisA: 'Kirua', figes: ['Kirua', 'Leolio'], intouchableMs: 600_000 })).toBe(
      'Jarvis a parlé. Le souffle du grand ange apparaît dans ton Book, reprise à Kirua. Kirua et Leolio sont figés 3 min. Tu es intouchable 10 min.',
    );
    expect(texteJarvis({ gm: 'jarvis', carte, reprisA: null, figes: [], intouchableMs: 600_000 })).toBe(
      'Jarvis a parlé. Le souffle du grand ange apparaît dans ton Book. Personne n’était à portée. Tu es intouchable 10 min.',
    );
  });

  it('RG-8.19 : les autres apprennent qui a joué, et s’ils sont figés ou dépouillés', () => {
    const e = { gm: 'jarvis' as const, lanceur: 'Gon', carte: 'Blue planet', figes: ['Kirua'], reprisA: 'Biscuit' };
    expect(texteJarvisAutres(e, 'Leolio')).toBe('Gon a joué Jarvis tout-puissant.');
    expect(texteJarvisAutres(e, 'Kirua')).toMatch(/Tu es figé 3 min/);
    expect(texteJarvisAutres(e, 'Biscuit')).toBe('Gon a joué Jarvis tout-puissant. Le Décret te reprend Blue planet.');
  });

  it('RG-8.20 : la cible du Sceau est prévenue en clair', () => {
    expect(texteGmRecue({ gm: 'ange', lanceur: 'Kirua', scelleMs: 300_000 })).toBe('Kirua a joué Le Sceau d’Ange : ton Book est scellé 5 min, ni scan, ni sort, ni échange, ni rangement.');
  });

  it('RG-8.16, RG-8.17 : obtention et retour au Maître du jeu', () => {
    expect(texteGmObtenue('jarvis', 'raid')).toMatch(/Jarvis tout-puissant.*meilleur chasseur/);
    expect(texteGmRendue(['jarvis', 'ange'])).toBe('Jarvis tout-puissant et Le Sceau d\'Ange reviennent au Maître du jeu.');
  });

  it('RG-8.19 : les bandeaux décomptent depuis la lecture de /moi', () => {
    expect(etatsGmRestants({ etatsGm: { fige: 180_000, scelle: 0, intouchable: 600_000 }, recuA: 1000 }, 61_000)).toEqual({ fige: 120_000, scelle: 0, intouchable: 540_000 });
  });

  it('RG-8.15 : la page « Maître du jeu » n’existe que si le joueur détient une carte', () => {
    const l = { pages: [[], []], objets: [], placesObjets: 8 } as unknown as LivreRecu;
    expect(nombreDePages(l)).toBe(3);
    expect(nombreDePages({ ...l, cartesGm: [{ itemId: 'g', gm: 'ange', obtenu: '', engage: false }] })).toBe(4);
    expect(genreDePage({ ...l, cartesGm: [{ itemId: 'g', gm: 'ange', obtenu: '', engage: false }] }, 3)).toBe('gm');
    expect(genreDePage(l, 2)).toBe('objets');
  });
});

describe('RG-8.16 : carte de Maître du jeu tombée au scan', () => {
  it('RG-8.16 : le tirage la montre en carte noire, avec sa phrase', async () => {
    const { etapeDuGain, phraseGain, tamponDe } = await import('./tirage');
    const e = etapeDuGain({ kind: 'gm', gm: 'jarvis' });
    expect(e).toMatchObject({ type: 'carte', carte: { genre: 'gm', gm: 'jarvis', nom: 'Jarvis tout-puissant' } });
    if (e.type !== 'carte') throw new Error();
    expect(tamponDe(e.carte)).toBe('GM');
    expect(phraseGain(e.carte)).toBe('Tu obtiens Jarvis tout-puissant, une carte de Maître du jeu ! Unique dans la partie.');
  });
});
