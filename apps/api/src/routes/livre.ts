// Livre du joueur (RG-8.5) : pages de 10, provenance (RG-8.14), emplacements perdus (RG-8.13),
// contrefaçons vues selon ce que le joueur sait (RG-8.9). Un joueur ne voit que son propre Livre (RG-3).
import { PLACES_OBJETS, describeLoss, layoutBook, objetsDe, viewCard, type Origine, type Slot } from '@gq/engine';
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
          case 'arene':
            return 'Arène de Soufrabi';
          case 'materialisation':
            return 'Matérialisation';
          case 'duplication':
            return 'Duplication';
          case 'kit':
            return 'Kit de départ';
          case 'correction_gm':
            return o.par === 'evenement' ? 'Événement' : 'Game Master';
        }
      };
      // `designe` : emplacement réservé à une carte du catalogue (RG-8.5) ; vide, il montre quelle carte manque.
      const slot = (x: Slot, designe: string | null) => {
        if (x.etat === 'vide') return designe ? { etat: 'vide' as const, designe: true, carte: carte(designe) } : { etat: 'vide' as const, designe: false };
        if (x.etat === 'perdu') {
          return { etat: 'perdu' as const, designe: true, carte: carte(x.perte.cardId), message: describeLoss(x.perte, nom, (a) => heureAffichee(a, c.now, c.realNow)) };
        }
        const i = x.item;
        if (i.kind === 'sort') return { etat: 'plein' as const, designe: false, kind: 'sort' as const, itemId: i.id, sort: i.spell };
        if (i.kind === 'objet') return { etat: 'vide' as const, designe: false }; // jamais : les objets ont leur section
        const v = viewCard(i, true);
        return {
          etat: 'plein' as const,
          designe: designe !== null,
          kind: 'carte' as const,
          itemId: i.id,
          carteId: v.cardId,
          ...carte(v.cardId),
          apparence: v.apparence,
          badge: v.badge ?? null,
          provenance: provenance(i.origine),
          obtenue: heureAffichee(i.obtenuA, c.now, c.realNow),
          engagee: engagees.has(i.id),
          // Coffre scellé (objet) : heure de fin de la protection.
          coffreJusqua: i.coffreJusqua !== undefined && i.coffreJusqua > c.now ? heureAffichee(i.coffreJusqua, c.now, c.realNow) : null,
        };
      };
      const layout = layoutBook(book, cat.designees);
      // Les pages commencent par les emplacements désignés, dans l'ordre du catalogue (layoutBook).
      let k = 0;
      const page = (p: Slot[]) => p.map((x) => slot(x, layout.designes[k++]?.cardId ?? null));
      return {
        ok: true as const,
        gele: await isLivreGele(c.tx, s.sub),
        cartesDesignees: layout.designes.filter((d) => d.slot.etat === 'plein').length,
        total: cat.designees.length,
        libresUtilises: layout.libresUtilises,
        pages: layout.pages.map(page),
        // Amendement 2026-10-10 : section des objets, à part.
        objets: objetsDe(book)
          .sort((a, b) => a.obtenuA - b.obtenuA)
          .map((o) => ({ itemId: o.id, objet: o.objet, obtenu: heureAffichee(o.obtenuA, c.now, c.realNow), engage: engagees.has(o.id) })),
        placesObjets: PLACES_OBJETS,
      };
    });
  });
}
