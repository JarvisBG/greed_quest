// Livre du joueur (RG-8.5) : pages de 10, provenance (RG-8.14), emplacements perdus (RG-8.13),
// contrefaçons vues selon ce que le joueur sait (RG-8.9). Un joueur ne voit que son propre Livre (RG-3).
import { describeLoss, layoutBook, viewCard, type Origine, type Slot } from '@gq/engine';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { engagedItems } from '../core/echanges.js';
import { isLivreGele, loadBook, loadCatalogue, loadJoueurs } from '../core/state.js';

type P = { Params: { partieId: string } };

/** Heure réelle approximative d'un instant de jeu (les pauses intermédiaires sont ignorées), heure de Paris. */
export function heureAffichee(a: number, gameNow: number, realNow: number): string {
  const d = new Date(realNow - (gameNow - a));
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(d).replace(':', 'h');
}

export async function livreRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.get<P>('/parties/:partieId/livre', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const [book, cat, joueurs] = await Promise.all([loadBook(c.tx, s.sub), loadCatalogue(c.tx, partieId), loadJoueurs(c.tx, partieId)]);
      const pseudo = new Map(joueurs.map((j) => [j.id, j.pseudo]));
      const nom = (id: string) => pseudo.get(id) ?? '?';
      const engagees = await engagedItems(c.tx, partieId, s.sub, c.now);
      const carte = (cardId: string) => {
        const x = cat.cartes.find((k) => k.id === cardId);
        return { numero: x?.numero ?? null, nom: x?.nom ?? '?', rang: x?.rang ?? null };
      };
      // RG-8.14 : provenance en clair (le donneur est nommé, RG-8.8).
      const provenance = (o: Origine): string => {
        switch (o.type) {
          case 'balise':
            return 'Balise';
          case 'pnj':
            return 'Checkpoint';
          case 'echange':
            return `Échange avec ${nom(o.avec)}`;
          case 'vol':
            return `Volée à ${nom(o.sur)}`;
          case 'enchere':
            return 'Enchère';
          case 'duplication':
            return 'Duplication';
          case 'kit':
            return 'Kit de départ';
          case 'correction_gm':
            return o.par === 'evenement' ? 'Événement' : 'Game Master';
        }
      };
      const slot = (x: Slot) => {
        if (x.etat === 'vide') return { etat: 'vide' as const };
        if (x.etat === 'perdu') {
          return { etat: 'perdu' as const, carte: carte(x.perte.cardId), message: describeLoss(x.perte, nom, (a) => heureAffichee(a, c.now, c.realNow)) };
        }
        const i = x.item;
        if (i.kind === 'sort') return { etat: 'plein' as const, kind: 'sort' as const, itemId: i.id, sort: i.spell };
        const v = viewCard(i, true);
        return {
          etat: 'plein' as const,
          kind: 'carte' as const,
          itemId: i.id,
          carteId: v.cardId,
          ...carte(v.cardId),
          apparence: v.apparence,
          badge: v.badge ?? null,
          provenance: provenance(i.origine),
          obtenue: heureAffichee(i.obtenuA, c.now, c.realNow),
          engagee: engagees.has(i.id),
        };
      };
      const layout = layoutBook(book, cat.designees);
      return {
        ok: true as const,
        gele: await isLivreGele(c.tx, s.sub),
        cartesDesignees: layout.designes.filter((d) => d.slot.etat === 'plein').length,
        total: cat.designees.length,
        libresUtilises: layout.libresUtilises,
        pages: layout.pages.map((p) => p.map(slot)),
      };
    });
  });
}
