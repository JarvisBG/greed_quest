import { describe, expect, it } from 'vitest';
import { Refus } from '../errors.js';
import { Essais } from './essais.js';
import { memeCode } from './tokens.js';

const limite = { parIp: 3, global: 5, dureeMs: 60_000 };
const bloque = (e: Essais, cle: string, ip: string) => {
  try {
    e.verifier(cle, ip);
    return false;
  } catch (err) {
    return err instanceof Refus && err.status === 429;
  }
};

describe('Limite des essais de codes (sécurité S1)', () => {
  it('bloque une IP après trop d’échecs, puis la libère après la durée', () => {
    const t = { v: 0 };
    const e = new Essais(() => t.v, limite);
    for (let i = 0; i < 3; i++) e.echec('staff:P', '1.1.1.1');
    expect(bloque(e, 'staff:P', '1.1.1.1')).toBe(true);
    expect(bloque(e, 'staff:P', '2.2.2.2')).toBe(false);
    expect(bloque(e, 'staff:Q', '1.1.1.1')).toBe(false);
    t.v = 60_001;
    expect(bloque(e, 'staff:P', '1.1.1.1')).toBe(false);
  });

  it('plafond global : des IP différentes (ou falsifiées) ne contournent pas la limite', () => {
    const e = new Essais(() => 0, limite);
    for (let i = 0; i < 5; i++) e.echec('orga', `10.0.0.${i}`);
    expect(bloque(e, 'orga', '10.0.0.99')).toBe(true);
  });

  it('une réussite remet le compteur de l’IP à zéro', () => {
    const e = new Essais(() => 0, limite);
    e.echec('staff:P', 'ip');
    e.echec('staff:P', 'ip');
    e.reussite('staff:P', 'ip');
    e.echec('staff:P', 'ip');
    expect(bloque(e, 'staff:P', 'ip')).toBe(false);
  });

  it('codes comparés sans fuite de longueur', () => {
    expect(memeCode('orga', 'orga')).toBe(true);
    expect(memeCode('org', 'orga')).toBe(false);
    expect(memeCode('', 'orga')).toBe(false);
  });
});
