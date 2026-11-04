// Limite des essais de codes (connexion PNJ / GM, code organisateur) : contre les codes devinés à la chaîne.
// Deux compteurs : par adresse IP (le relais Cloudflare la transmet dans `x-gq-ip`) et un plafond global par
// clé, car beaucoup de téléphones partagent la même IP chez l'opérateur et une IP se falsifie.
// Le plafond global bloque seulement les NOUVELLES connexions : une équipe déjà connectée continue de jouer.
import type { FastifyRequest } from 'fastify';
import { Refus } from '../errors.js';

export interface LimiteEssais {
  /** Échecs permis par IP avant blocage. */
  parIp: number;
  /** Échecs permis toutes IP confondues avant blocage de la clé. */
  global: number;
  /** Fenêtre de comptage et durée du blocage (ms). */
  dureeMs: number;
}

export const LIMITE_CONNEXION: LimiteEssais = { parIp: 8, global: 40, dureeMs: 15 * 60_000 };

interface Compteur {
  echecs: number;
  depuis: number;
  bloqueJusqua: number;
}

export function ipDe(req: FastifyRequest): string {
  const relayee = req.headers['x-gq-ip'];
  return (typeof relayee === 'string' && relayee) || req.ip;
}

export class Essais {
  private compteurs = new Map<string, Compteur>();

  constructor(
    private now: () => number,
    private limite: LimiteEssais = LIMITE_CONNEXION,
  ) {}

  private lire(k: string): Compteur {
    const t = this.now();
    let c = this.compteurs.get(k);
    if (!c || (c.bloqueJusqua <= t && t - c.depuis > this.limite.dureeMs)) {
      c = { echecs: 0, depuis: t, bloqueJusqua: 0 };
      this.compteurs.set(k, c);
    }
    return c;
  }

  /** Refus 429 si cette clé (ou cette IP pour cette clé) est bloquée. */
  verifier(cle: string, ip: string): void {
    const t = this.now();
    const bloque = Math.max(this.lire(`${cle}|${ip}`).bloqueJusqua, this.lire(cle).bloqueJusqua);
    if (bloque > t) throw new Refus('trop_d_essais', `Trop d’essais de code : réessaie dans ${Math.ceil((bloque - t) / 60_000)} min`, 429);
  }

  echec(cle: string, ip: string): void {
    const t = this.now();
    for (const [k, max] of [[`${cle}|${ip}`, this.limite.parIp], [cle, this.limite.global]] as const) {
      const c = this.lire(k);
      c.echecs++;
      if (c.echecs >= max) {
        c.bloqueJusqua = t + this.limite.dureeMs;
        c.echecs = 0;
        c.depuis = t;
      }
    }
    if (this.compteurs.size > 10_000) this.nettoyer();
  }

  reussite(cle: string, ip: string): void {
    this.compteurs.delete(`${cle}|${ip}`);
  }

  private nettoyer(): void {
    const t = this.now();
    for (const [k, c] of this.compteurs) if (c.bloqueJusqua <= t && t - c.depuis > this.limite.dureeMs) this.compteurs.delete(k);
  }
}
