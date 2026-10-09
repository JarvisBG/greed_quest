import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calculerLicence, decalage, PERIODE_MS } from './licence';

// Référence : la signature de l'API (apps/api/src/core/licence.ts).
const serveur = (joueurId: string, secret: string, t: number) => {
  const f = Math.floor(t / PERIODE_MS);
  return `GQL1.${joueurId}.${f}.${createHmac('sha256', secret).update(`${joueurId}.${f}`).digest('base64url').slice(0, 22)}`;
};

describe('licence (RG-5.2)', () => {
  it('RG-5.2 : la licence calculée sur le téléphone est celle que l’API attend', async () => {
    for (const t of [0, 29_999, 30_000, 1_791_569_280_967]) {
      const l = await calculerLicence('joueur-1', 'secret-Ab_9-xyz', t);
      expect(l.qr).toBe(serveur('joueur-1', 'secret-Ab_9-xyz', t));
      expect(l.expireA).toBe((Math.floor(t / PERIODE_MS) + 1) * PERIODE_MS);
    }
  });

  it('RG-5.2 : renouvelée toutes les 30 s', async () => {
    const a = await calculerLicence('j', 's', 60_000);
    const b = await calculerLicence('j', 's', 89_999);
    const c = await calculerLicence('j', 's', 90_000);
    expect(a.qr).toBe(b.qr);
    expect(c.qr).not.toBe(a.qr);
  });

  it('décalage d’horloge estimé à la fenêtre près', () => {
    expect(decalage(120_000, 95_000)).toBe(0);
    expect(decalage(180_000, 95_000)).toBe(60_000); // téléphone en retard de 2 fenêtres
    expect(decalage(60_000, 95_000)).toBe(-60_000);
  });
});
