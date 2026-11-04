// Jetons de session signés (HMAC-SHA256) : `payload.signature`, en base64url.
import { createHash, createHmac, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export type Role = 'joueur' | 'pnj' | 'gm';

export interface Session {
  role: Role;
  /** Id du joueur ou du membre de l'équipe. */
  sub: string;
  partieId: string;
  /** Joueur : version de session (RG-5.1 amendé), absente des jetons d'avant = 0. */
  v?: number;
  /** Expiration (horloge réelle, ms) : sécurité S2, un téléphone perdu ou volé ne garde pas la partie ouverte. */
  exp?: number;
}

/** Sécurité S2 : durée d'une session. Joueur : l'app en reprend une seule par son téléphone (/reconnexion). */
export const DUREE_SESSION_MS: Record<Role, number> = { joueur: 7 * 24 * 3600_000, pnj: 3 * 24 * 3600_000, gm: 3 * 24 * 3600_000 };

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export class Tokens {
  constructor(
    private secret: string,
    private now: () => number = Date.now,
  ) {}

  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }

  issue(s: Session): string {
    const payload = b64(JSON.stringify({ ...s, exp: s.exp ?? this.now() + DUREE_SESSION_MS[s.role] }));
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string): Session | null {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const attendu = Buffer.from(this.sign(payload));
    const recu = Buffer.from(sig);
    if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null;
    try {
      const s = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Session;
      // Jeton sans expiration (d'avant le 2026-11-04) ou expiré : refusé, l'app se reconnecte.
      if (typeof s.exp !== 'number' || s.exp <= this.now()) return null;
      return s.role && s.sub && s.partieId ? s : null;
    } catch {
      return null;
    }
  }

  /** Signature HMAC d'une chaîne (licence QR tournante, RG-5.2). */
  hmac(data: string): string {
    return this.sign(data);
  }
}

/** Empreinte d'un code d'accès de l'équipe (scrypt salé). */
export function hashCode(code: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('base64url')}:${scryptSync(code, salt, 32).toString('base64url')}`;
}

export function checkCode(code: string, hash: string): boolean {
  const [salt, h] = hash.split(':');
  if (!salt || !h) return false;
  const calc = scryptSync(code, Buffer.from(salt, 'base64url'), 32);
  const attendu = Buffer.from(h, 'base64url');
  return calc.length === attendu.length && timingSafeEqual(calc, attendu);
}

/** Deux codes égaux, comparés à temps constant (empreintes de même longueur). */
export function memeCode(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}
