import { describe, expect, it } from 'vitest';
import { createSessionStore, type SessionEquipe } from './session';
import { memoire } from './test-utils';

const s = (partieId: string, role: 'gm' | 'pnj' = 'gm'): SessionEquipe => ({ partieId, id: `m-${partieId}`, nom: 'Sivraj', role, token: `t-${partieId}` });

describe('Mes parties : sessions retenues sur l’appareil', () => {
  it('retient chaque partie ouverte, la plus récente en tête', () => {
    const st = createSessionStore(memoire());
    st.set(s('AAAAAA'));
    st.set(s('BBBBBB'));
    st.set(s('AAAAAA'));
    expect(st.get()?.partieId).toBe('AAAAAA');
    expect(st.liste().map((x) => x.partieId)).toEqual(['AAAAAA', 'BBBBBB']);
  });

  it('fermer la partie la garde dans la liste ; l’oublier la retire', () => {
    const st = createSessionStore(memoire());
    st.set(s('AAAAAA'));
    st.set(s('BBBBBB'));
    st.clear();
    expect(st.get()).toBeNull();
    expect(st.liste()).toHaveLength(2);
    st.set(s('AAAAAA'));
    st.oublier('AAAAAA');
    expect(st.get()).toBeNull();
    expect(st.liste().map((x) => x.partieId)).toEqual(['BBBBBB']);
  });

  it('reprend la session d’avant la liste (console déjà connectée)', () => {
    const m = memoire();
    m.setItem('gq.equipe', JSON.stringify(s('CCCCCC')));
    expect(createSessionStore(m).liste().map((x) => x.partieId)).toEqual(['CCCCCC']);
  });

  it('ignore une liste abîmée', () => {
    const m = memoire();
    m.setItem('gq.equipe.parties', '{pas du json');
    expect(createSessionStore(m).liste()).toEqual([]);
  });
});
