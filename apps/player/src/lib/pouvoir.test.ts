import { describe, expect, it } from 'vitest';
import { etatPouvoir } from './pouvoir';

const base = {
  nen: null,
  pouvoirSpe: null,
  delais: { offensif: 0, transformation: 0, gel: 0, pouvoir: null, reserve: null, specialisation: null },
  specialisation: { zetsu: 0, fortuneArmee: false },
} as const;
const MIN = 60_000;

describe('RG-5.4 : état du pouvoir de Nen sur l’accueil', () => {
  it('RG-5.4 : sans type de Nen, rien à montrer', () => {
    expect(etatPouvoir(base, 0)).toBeNull();
  });

  it('RG-5.4 : Renforcement prêt, puis en recharge, décompté depuis la réception', () => {
    expect(etatPouvoir({ ...base, nen: 'renforcement', delais: { ...base.delais, pouvoir: 0 } }, 0)).toMatchObject({ etat: 'pret' });
    const r = etatPouvoir({ ...base, nen: 'renforcement', delais: { ...base.delais, pouvoir: 10 * MIN } }, 4 * MIN);
    expect(r).toMatchObject({ etat: 'recharge', resteMs: 6 * MIN });
    expect(etatPouvoir({ ...base, nen: 'renforcement', delais: { ...base.delais, pouvoir: 10 * MIN } }, 11 * MIN)).toMatchObject({ etat: 'pret' });
  });

  it('RG-5.4 : Transformation suit le délai de Texture Surprise', () => {
    expect(etatPouvoir({ ...base, nen: 'transformation', delais: { ...base.delais, transformation: 5 * MIN } }, 0)).toMatchObject({ etat: 'recharge', resteMs: 5 * MIN });
  });

  it('RG-5.4 : Matérialisation, le tirage bonus arrive tout seul', () => {
    expect(etatPouvoir({ ...base, nen: 'materialisation', delais: { ...base.delais, reserve: 20 * MIN } }, MIN)).toMatchObject({ etat: 'auto', resteMs: 19 * MIN });
  });

  it('RG-5.4 : Spécialisation, Zetsu actif puis recharge ; Fortune armée', () => {
    const zetsu = { ...base, nen: 'specialisation', pouvoirSpe: 'zetsu', specialisation: { zetsu: 8 * MIN, fortuneArmee: false }, delais: { ...base.delais, specialisation: 40 * MIN } } as const;
    expect(etatPouvoir(zetsu, 0)).toMatchObject({ nom: 'Zetsu', etat: 'actif', resteMs: 8 * MIN });
    expect(etatPouvoir(zetsu, 9 * MIN)).toMatchObject({ etat: 'recharge', resteMs: 31 * MIN });
    const fortune = { ...base, nen: 'specialisation', pouvoirSpe: 'fortune', specialisation: { zetsu: 0, fortuneArmee: true } } as const;
    expect(etatPouvoir(fortune, 0)).toMatchObject({ nom: 'Fortune', etat: 'actif' });
  });
});
