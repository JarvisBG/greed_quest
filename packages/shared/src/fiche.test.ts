import { describe, expect, it } from 'vitest';
import { FicheHunter, telephoneCamerounais } from './fiche.js';

const base = { age: '18-24', genre: 'fille', occupation: 'etudiant', ville: 'douala', quartier: 'Akwa', reseaux: ['tiktok', 'whatsapp'], source: 'ami' };

describe('RG-5.3 Fiche Hunter', () => {
  it('RG-5.3 : numéro camerounais normalisé, toutes écritures', () => {
    expect(telephoneCamerounais('6 77 12 34 56')).toBe('+237677123456');
    expect(telephoneCamerounais('+237 677-12-34-56')).toBe('+237677123456');
    expect(telephoneCamerounais('00237677123456')).toBe('+237677123456');
    expect(telephoneCamerounais('237677123456')).toBe('+237677123456');
    expect(telephoneCamerounais('222 12 34 56')).toBe('+237222123456');
    expect(telephoneCamerounais('77123456')).toBeNull();
    expect(telephoneCamerounais('+33 6 12 34 56 78')).toBeNull();
  });

  it('RG-5.3 : toutes les réponses obligatoires, téléphone compris', () => {
    expect(FicheHunter.safeParse({ ...base, telephone: '677123456' }).success).toBe(true);
    expect(FicheHunter.safeParse(base).success).toBe(false);
    expect(FicheHunter.safeParse({ ...base, telephone: '677123456', reseaux: [] }).success).toBe(false);
    expect(FicheHunter.safeParse({ ...base, telephone: '677123456', quartier: ' ' }).success).toBe(false);
    expect(FicheHunter.safeParse({ ...base, telephone: '677123456', genre: 'autre' }).success).toBe(false);
  });

  it('RG-5.3 : pas de téléphone demandé aux moins de 15 ans ; accord de recontact non coché par défaut', () => {
    const r = FicheHunter.parse({ ...base, age: 'moins15' });
    expect(r.accordRecontact).toBe(false);
  });
});
