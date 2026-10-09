import { describe, expect, it } from 'vitest';
import { AGE_MAX_MS, createFile } from './file';
import { memoire } from './test-utils';

const pos = { lat: 1, lng: 2, precisionM: 5 };

describe('file hors ligne (RG-7.5)', () => {
  it('garde les scans dans l’ordre, une seule fois par balise', () => {
    const f = createFile(memoire());
    expect(f.ajouter({ partieId: 'p', baliseId: 'b2', position: pos, scanneA: 2000 })).toBe(true);
    expect(f.ajouter({ partieId: 'p', baliseId: 'b1', position: pos, scanneA: 1000 })).toBe(true);
    expect(f.ajouter({ partieId: 'p', baliseId: 'b1', position: pos, scanneA: 3000 })).toBe(false);
    expect(f.aRejouer('p', 5000).valides.map((s) => s.baliseId)).toEqual(['b1', 'b2']);
    expect(f.aRejouer('autre', 5000).valides).toEqual([]);
  });

  it('RG-7.5 : au-delà de 10 min, le scan est périmé', () => {
    const f = createFile(memoire());
    f.ajouter({ partieId: 'p', baliseId: 'b1', position: pos, scanneA: 0 });
    f.ajouter({ partieId: 'p', baliseId: 'b2', position: pos, scanneA: 1 });
    const r = f.aRejouer('p', AGE_MAX_MS);
    expect(r.perimes.map((s) => s.baliseId)).toEqual(['b1']);
    expect(r.valides.map((s) => s.baliseId)).toEqual(['b2']);
  });

  it('retirer et stockage abîmé', () => {
    const st = memoire();
    const f = createFile(st);
    const s = { partieId: 'p', baliseId: 'b1', position: pos, scanneA: 1 };
    f.ajouter(s);
    f.retirer(s);
    expect(f.lire()).toEqual([]);
    st.setItem('gq.fileScans', '{oups');
    expect(f.lire()).toEqual([]);
  });
});
