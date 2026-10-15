import { describe, expect, it } from 'vitest';
import { basculer, colonnesGloire, libelleLot, texteDefinitif, texteRefus, texteValider } from './clear';

describe('RG-13.3 choix des 3 lots, page ⑰', () => {
  it('toucher ajoute la carte tant qu’il reste une place, la retire si elle est choisie', () => {
    expect(basculer([], 'a')).toEqual(['a']);
    expect(basculer(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(basculer(['a', 'b', 'c'], 'd')).toEqual(['a', 'b', 'c']);
    expect(basculer(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('le bouton dit ce qu’il reste à choisir, puis valide', () => {
    expect(texteValider(0)).toBe('Choisis encore 3 cartes');
    expect(texteValider(2)).toBe('Choisis encore 1 carte');
    expect(texteValider(3)).toBe('Valider mes 3 lots');
  });

  it('lot réel, ou l’organisateur décidera', () => {
    expect(libelleLot({ lotReel: 'Tasse Greed Island' })).toBe('Tasse Greed Island');
    expect(libelleLot({ lotReel: null })).toBe('Lot à voir avec l’organisateur');
  });

  it('la confirmation nomme les trois cartes', () => {
    expect(texteDefinitif(['Le bonheur du détenteur', 'La grotte des esprits', 'Toraemon'])).toBe('C’est définitif : le bonheur du détenteur, la grotte des esprits et Toraemon deviennent tes lots.');
  });
});

describe('RG-13 refus du GM', () => {
  it('le motif du GM, puis le Book dégelé, sans double ponctuation', () => {
    expect(texteRefus('Présente-toi en personne')).toBe('Présente-toi en personne. Ton Book est dégelé : tu peux de nouveau jouer.');
    expect(texteRefus('Triche constatée !')).toBe('Triche constatée ! Ton Book est dégelé : tu peux de nouveau jouer.');
    expect(texteRefus('  ')).toBe('Ton Book est dégelé : tu peux de nouveau jouer.');
  });
});

describe('cinématique du Book en gloire', () => {
  it('les pochettes restent lisibles quand le catalogue grandit', () => {
    expect(colonnesGloire(14)).toBe(3);
    expect(colonnesGloire(20)).toBe(4);
    expect(colonnesGloire(30)).toBe(5);
  });
});
