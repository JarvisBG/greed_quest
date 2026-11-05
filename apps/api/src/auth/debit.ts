// Sécurité S4 : limite contre les envois en rafale (script, bouton bloqué), par fenêtre d'une minute.
// Avec session : compté par joueur ou membre de l'équipe. Sans session (inscription, écran géant) : par adresse IP,
// avec une limite large, car tous les joueurs d'un même opérateur peuvent partager la même IP (CGNAT).
// Un joueur normal envoie quelques requêtes par minute ; ces plafonds ne gênent que les abus.
import type { FastifyInstance } from 'fastify';
import { Refus } from '../errors.js';
import { ipDe } from './essais.js';

export const DEBIT = { parSessionMin: 180, parIpMin: 900 };

export function limiterDebit(app: FastifyInstance, now: () => number, debit = DEBIT): void {
  const fenetres = new Map<string, { debut: number; n: number }>();
  app.addHook('onRequest', async (req) => {
    if (req.url === '/sante') return;
    const t = now();
    const s = req.session;
    const cle = s ? `s:${s.partieId}:${s.sub}` : `ip:${ipDe(req)}`;
    const max = s ? debit.parSessionMin : debit.parIpMin;
    let f = fenetres.get(cle);
    if (!f || t - f.debut >= 60_000) {
      if (fenetres.size > 20_000) for (const [k, v] of fenetres) if (t - v.debut >= 60_000) fenetres.delete(k);
      f = { debut: t, n: 0 };
      fenetres.set(cle, f);
    }
    if (++f.n > max) throw new Refus('trop_de_requetes', 'Trop de demandes d’un coup : patiente quelques secondes', 429);
  });
}
