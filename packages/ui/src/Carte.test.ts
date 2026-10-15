import { describe, expect, it } from 'vitest';
import { BANQUE_CARTES } from '@gq/shared';
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

  it('sorts et objets : image par numéro de l’anime', () => {
    expect(imageCarte('sort', '1007', 'Vol')).toMatch(/1007.*\.webp/);
    expect(imageCarte('objet', '1032', 'Loterie')).toMatch(/1032.*\.webp/);
  });

  it('créations sans numéro (Gel, Boussole, Second souffle, Pépite) : image empruntée, par le nom', () => {
    expect(imageCarte('sort', '—', 'Gel')).toMatch(/gel.*\.webp/);
    expect(imageCarte('objet', null, 'Pépite d’or')).toMatch(/pepite.*\.webp/);
    expect(imageCarte('objet', '—', "Pépite d'or")).toMatch(/pepite/);
    expect(imageCarte('objet', '—', 'Boussole du chercheur')).toMatch(/boussole/);
    expect(imageCarte('objet', '—', 'Second souffle')).toMatch(/souffle/);
    expect(imageCarte('objet', '—', 'Objet inconnu')).toBeNull();
  });

  it('toutes les cartes de la banque ont leur image (037 comprise)', () => {
    expect(imageCarte('designee', 37, "L'œuf du sportif de niveau extra-super")).toMatch(/037.*\.webp/);
    for (const b of BANQUE_CARTES) expect(imageCarte('designee', b.numero, b.nom), b.nom).not.toBeNull();
  });
});
