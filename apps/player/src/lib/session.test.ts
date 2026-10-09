import { describe, expect, it } from 'vitest';
import { createSessionStore, partieFromUrl } from './session';

function memoire() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('session', () => {
  it('RG-5.1 : identifiant d’appareil créé une fois puis stable', () => {
    let n = 0;
    const s = createSessionStore(memoire(), () => `appareil-0000000${++n}`);
    expect(s.appareilId()).toBe('appareil-00000001');
    expect(s.appareilId()).toBe('appareil-00000001');
  });

  it('garde, relit et efface la session ; ignore un contenu abîmé', () => {
    const st = memoire();
    const s = createSessionStore(st);
    expect(s.get()).toBeNull();
    s.set({ partieId: 'p', joueurId: 'j', token: 't' });
    expect(s.get()).toEqual({ partieId: 'p', joueurId: 'j', token: 't' });
    s.clear();
    expect(s.get()).toBeNull();
    st.setItem('gq.session', '{pas du json');
    expect(s.get()).toBeNull();
  });

  it('RG-5.3 : Examen remis à plus tard, mémorisé par joueur', () => {
    const s = createSessionStore(memoire());
    expect(s.examenReporte('j1')).toBe(false);
    s.reporterExamen('j1');
    expect(s.examenReporte('j1')).toBe(true);
    expect(s.examenReporte('j2')).toBe(false);
  });

  it('lit la partie dans l’URL', () => {
    expect(partieFromUrl('?partie=abc')).toBe('abc');
    expect(partieFromUrl('?partie=')).toBeNull();
    expect(partieFromUrl('')).toBeNull();
  });
});
