import { describe, expect, it } from 'vitest';
import { DUREE_SESSION_MS, Tokens } from './tokens.js';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('Sessions qui expirent (sécurité S2)', () => {
  it('une session joueur dure 7 jours, une session de l’équipe 3 jours', () => {
    const t = { v: 0 };
    const tokens = new Tokens('secret', () => t.v);
    const joueur = tokens.issue({ role: 'joueur', sub: 'j1', partieId: 'P' });
    const gm = tokens.issue({ role: 'gm', sub: 'g1', partieId: 'P' });
    t.v = DUREE_SESSION_MS.gm - 1;
    expect(tokens.verify(gm)).toMatchObject({ role: 'gm' });
    t.v = DUREE_SESSION_MS.gm;
    expect(tokens.verify(gm)).toBeNull();
    expect(tokens.verify(joueur)).toMatchObject({ role: 'joueur' });
    t.v = DUREE_SESSION_MS.joueur;
    expect(tokens.verify(joueur)).toBeNull();
  });

  it('un jeton sans expiration (d’avant) est refusé, même bien signé', () => {
    const tokens = new Tokens('secret', () => 0);
    const payload = b64({ role: 'gm', sub: 'g1', partieId: 'P' });
    expect(tokens.verify(`${payload}.${tokens.hmac(payload)}`)).toBeNull();
  });

  it('l’expiration ne se rallonge pas en modifiant le jeton', () => {
    const tokens = new Tokens('secret', () => 0);
    const [, sig] = tokens.issue({ role: 'gm', sub: 'g1', partieId: 'P' }).split('.');
    expect(tokens.verify(`${b64({ role: 'gm', sub: 'g1', partieId: 'P', exp: 9e15 })}.${sig}`)).toBeNull();
  });
});
