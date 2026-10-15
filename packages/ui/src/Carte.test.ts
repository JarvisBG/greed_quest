import { describe, expect, it } from 'vitest';
import { imageCarte } from './Carte';

describe('imageCarte (illustrations des cartes officielles, 2026-10-15)', () => {
  it('RG-8.1 : une carte désignée de la banque a son image, par son numéro de l’anime', () => {
    expect(imageCarte('designee', 17, 'Le souffle du grand ange')).toMatch(/017.*\.webp/);
    expect(imageCarte('designee', 0, 'Le bonheur du détenteur')).toMatch(/000.*\.webp/);
  });

  it('RG-8.1 : une carte numérotée à la main (nom différent de la banque) garde le filigrane', () => {
    expect(imageCarte('designee', 17, 'La lampe de Gon')).toBeNull();
  });

  it('RG-8.9 : une contrefaçon démasquée garde l’image de la carte imitée', () => {
    expect(imageCarte('designee', 17, 'Contrefaçon de Le souffle du grand ange')).toMatch(/017/);
  });

  it('sorts et objets : image par numéro de l’anime, rien sans numéro', () => {
    expect(imageCarte('sort', '1007', 'Vol')).toMatch(/1007.*\.webp/);
    expect(imageCarte('objet', '1032', 'Loterie')).toMatch(/1032.*\.webp/);
    expect(imageCarte('sort', '—', 'Gel')).toBeNull();
    expect(imageCarte('objet', null, 'Pépite d’or')).toBeNull();
  });

  it('carte 037 (pas de scan officiel) : filigrane', () => {
    expect(imageCarte('designee', 37, 'Le jeune athlète')).toBeNull();
  });
});
