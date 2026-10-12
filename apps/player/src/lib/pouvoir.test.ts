import { describe, expect, it } from 'vitest';
import { apparencesTexture, cartesAlchimie, cartesBandit, casePouvoir, etatPouvoir, parRang, phraseAlchimie, phraseBandit, phraseTexture, remplissage, type CarteCatalogue } from './pouvoir';

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

const R = { pouvoir: 30 * MIN, transformation: 20 * MIN, reserve: 40 * MIN, specialisation: 40 * MIN, zetsu: 10 * MIN };
const cat = (id: string, rang: CarteCatalogue['rang'], numero = Number(id)) => ({ id, numero, nom: `Carte ${id}`, rang });
const CAT: CarteCatalogue[] = [cat('0', 'SS'), cat('1', 'S'), cat('2', 'S'), cat('7', 'A'), cat('3', 'B'), cat('10', 'B'), cat('14', 'C'), cat('25', 'D')];

describe('RG-5.4 page ⑩ : la case du Nen', () => {
  it('RG-5.4 : la jauge de Renforcement monte pendant la recharge (durée complète reçue de /moi, RG-14)', () => {
    const c = casePouvoir({ ...base, recharges: R, nen: 'renforcement', delais: { ...base.delais, pouvoir: 15 * MIN } }, 0)!;
    expect(c).toMatchObject({ cle: 'renforcement', etat: 'recharge', totalMs: 30 * MIN, secret: false });
    expect(remplissage(c)).toBeCloseTo(0.5);
  });

  it('RG-5.4 : Texture Surprise se décompte sur sa propre recharge', () => {
    const c = casePouvoir({ ...base, recharges: R, nen: 'transformation', delais: { ...base.delais, transformation: 5 * MIN } }, 0)!;
    expect(c).toMatchObject({ cle: 'transformation', nom: 'Texture Surprise', totalMs: 20 * MIN });
    expect(remplissage(c)).toBeCloseTo(0.75);
  });

  it('RG-5.4 Spécialisation : pouvoir secret ; pendant Zetsu, la jauge se vide sur sa durée', () => {
    const z = casePouvoir({ ...base, recharges: R, nen: 'specialisation', pouvoirSpe: 'zetsu', specialisation: { zetsu: 8 * MIN, fortuneArmee: false }, delais: { ...base.delais, specialisation: 38 * MIN } }, 0)!;
    expect(z).toMatchObject({ cle: 'zetsu', secret: true, etat: 'actif', totalMs: 10 * MIN });
    expect(remplissage(z)).toBeCloseTo(0.8);
    const b = casePouvoir({ ...base, recharges: R, nen: 'specialisation', pouvoirSpe: 'bandit', delais: { ...base.delais, specialisation: 0 } }, 0)!;
    expect(b).toMatchObject({ cle: 'bandit', nom: 'L’épée du vol', etat: 'pret' });
    expect(remplissage(b)).toBe(1);
  });
});

describe('RG-5.4 page ⑩ : cartes proposées par les pouvoirs', () => {
  it('RG-5.4 Texture Surprise : même rang ; un doublon S peut aussi imiter la SS (amendement 2026-10-09)', () => {
    expect(apparencesTexture({ carteId: '3', rang: 'B' }, CAT).map((c) => c.id)).toEqual(['10']);
    expect(apparencesTexture({ carteId: '1', rang: 'S' }, CAT).map((c) => c.id)).toEqual(['0', '2']);
  });

  it('RG-5.4 Alchimie : même rang ou rang au-dessus, jamais la SS (amendement 2026-10-10)', () => {
    expect(cartesAlchimie({ carteId: '14', rang: 'C' }, CAT).map((c) => c.id)).toEqual(['3', '10']);
    expect(cartesAlchimie({ carteId: '7', rang: 'A' }, CAT).map((c) => c.id)).toEqual(['1', '2']);
    expect(cartesAlchimie({ carteId: '1', rang: 'S' }, CAT).map((c) => c.id)).toEqual(['2']);
  });

  it('RG-5.4 Bandit : tout le catalogue sauf la SS, rangé par rang', () => {
    const g = parRang(cartesBandit(CAT));
    expect(g.map((x) => x.rang)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(g.find((x) => x.rang === 'B')!.cartes.map((c) => c.id)).toEqual(['3', '10']);
  });
});

describe('RG-5.4 page ⑩ : phrases des pouvoirs', () => {
  it('RG-5.4 Bandit : carte visée prise, ou carte au hasard si la cible ne l’avait pas', () => {
    const visee = { id: '7', nom: 'La pierre de grossesse' };
    expect(phraseBandit({ resultat: 'reussi', recu: { itemId: 'i', carteId: '7', nom: 'La pierre de grossesse' } }, 'Kirua', visee)).toBe('Tu as pris la pierre de grossesse à Kirua.');
    expect(phraseBandit({ resultat: 'reussi', recu: { itemId: 'i', carteId: '30', nom: 'Coussin connexion' } }, 'Kirua', visee)).toBe(
      'Kirua n’avait pas la pierre de grossesse à prendre : ton épée a pris une carte au hasard, Coussin connexion.',
    );
    expect(phraseBandit({ resultat: 'bloque', protection: 'barriere' }, 'Kirua', visee)).toContain('Mur défensif');
    expect(phraseBandit({ resultat: 'sans_effet' }, 'Kirua', null)).toContain('aucune carte à prendre');
  });

  it('RG-5.4 Alchimie : la contrefaçon fait échouer l’alchimie', () => {
    expect(phraseAlchimie('reussi', 'Le dé du risque', 'Le vase de la fontaine')).toBe('Ton doublon le dé du risque est devenu le vase de la fontaine. Elle part dans ton Book.');
    expect(phraseAlchimie('contrefacon', 'Le dé du risque', null)).toContain('contrefaçon');
  });

  it('RG-5.4 Texture Surprise : la phrase rappelle la Pénétration', () => {
    expect(phraseTexture('Le dé du risque', 'La balance d’or')).toContain('la balance d’or');
  });

  it('RG-5.4 décision 2026-10-12 : Texture Surprise sur une contrefaçon ignorée échoue, la carte reste démasquée', () => {
    const p = phraseTexture('Le dé du risque', 'La balance d’or', 'contrefacon');
    expect(p).toContain('contrefaçon');
    expect(p).toContain('démasquée');
  });
});
