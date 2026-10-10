// Livre du joueur (RG-8.5) : pages de 10, provenance (RG-8.14), emplacements perdus (RG-8.13),
// contrefaçons vues selon ce que le joueur sait (RG-8.9). Un joueur ne voit que son propre Livre (RG-3) ;
// le GM voit tout Livre, avec la vérité sur chaque carte (corrections RG-3.1, vérification d'un Clear RG-13.2).
import { PLACES_OBJETS, deplacerCarte, describeLoss, layoutBook, objetsDe, viewCard, type Origine, type Slot } from '@gq/engine';
import { DeplacementIntent } from '@gq/shared';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import type { ActionCtx } from '../core/runner.js';
import { engagedItems } from '../core/echanges.js';
import { ENGAGEE } from '../core/echanges.js';
import { actionPatch, isLivreGele, loadBook, loadCatalogue, loadJoueur, loadJoueurs, saveBooks, updateJoueur } from '../core/state.js';
import { refus, send } from '../http.js';
import { parse } from '../validation.js';
import { introuvable } from '../errors.js';

type P = { Params: { partieId: string } };
type PJ = { Params: { partieId: string; joueurId: string } };

/** Heure réelle approximative d'un instant de jeu (les pauses intermédiaires sont ignorées), heure de Paris. */
export function heureAffichee(a: number, gameNow: number, realNow: number): string {
  const d = new Date(realNow - (gameNow - a));
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(d).replace(':', 'h');
}

/** Livre d'un joueur, vu par lui-même (`equipe` faux) ou par le GM (`equipe` vrai : vérité de chaque carte). */
export async function vueLivre(c: ActionCtx, partieId: string, joueurId: string, equipe: boolean) {
  const [book, cat, joueurs] = await Promise.all([loadBook(c.tx, joueurId), loadCatalogue(c.tx, partieId), loadJoueurs(c.tx, partieId)]);
  const pseudo = new Map(joueurs.map((j) => [j.id, j.pseudo]));
  const nom = (id: string) => pseudo.get(id) ?? '?';
  const engagees = await engagedItems(c.tx, partieId, joueurId, c.now);
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
      case 'alchimie':
        return 'Alchimie';
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
      // RG-8.5 amendé : carte désignée cachée dans les emplacements libres (ne compte pas tant qu'elle n'est pas remise).
      cachee: !!i.cachee,
      // Coffre scellé (objet) : heure de fin de la protection.
      coffreJusqua: i.coffreJusqua !== undefined && i.coffreJusqua > c.now ? heureAffichee(i.coffreJusqua, c.now, c.realNow) : null,
      // Vue du GM seulement : ce que le serveur sait (contrefaçon, vraie carte d'un doublon déguisé, malédiction).
      ...(equipe
        ? {
            verite: {
              contrefacon: i.faux?.nature ?? null,
              vraieCarte: i.faux?.nature === 'deguise' ? carte(i.faux.vraieCarteId) : null,
              marque: i.marque ?? null,
              maudite: !!i.maudite,
            },
          }
        : {}),
    };
  };
  const layout = layoutBook(book, cat.designees);
  // Les pages commencent par les emplacements désignés, dans l'ordre du catalogue (layoutBook).
  let k = 0;
  const page = (p: Slot[]) => p.map((x) => slot(x, layout.designes[k++]?.cardId ?? null));
  return {
    ok: true as const,
    gele: await isLivreGele(c.tx, joueurId),
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
}

export async function livreRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  app.get<P>('/parties/:partieId/livre', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => vueLivre(c, partieId, s.sub, false));
  });

  // RG-8.5 amendé (2026-10-10) : cacher une carte désignée dans les emplacements libres, ou la remettre en place.
  app.post<P>('/parties/:partieId/book/deplacer', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(DeplacementIntent, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const j = await loadJoueur(c.tx, s.sub);
      if (!j) throw introuvable('Joueur');
      const deny = async (code: string, message: string) => {
        await c.log({ action: 'deplacement', resultat: 'refus', details: { code, itemId: input.itemId } });
        return refus(code, message);
      };
      if (c.partie.etat === 'terminee') return deny('partie_terminee', 'La partie est terminée');
      if (j.statut === 'disqualifie' || j.statut === 'abandon') return deny('joueur_exclu', 'Tu ne joues plus');
      if (await isLivreGele(c.tx, j.id)) return deny('livre_gele', 'Ton Book est gelé : va voir le Game Master'); // RG-13.1
      if ((await engagedItems(c.tx, partieId, j.id, c.now)).has(input.itemId)) return deny(ENGAGEE.code, ENGAGEE.message);
      const [book, cat] = await Promise.all([loadBook(c.tx, j.id), loadCatalogue(c.tx, partieId)]);
      const o = deplacerCarte(book, cat.designees, input.itemId, input.cacher);
      if (!o.ok) return deny(o.code, o.message);
      await saveBooks(c.tx, partieId, c.now, [{ joueurId: j.id, before: book, after: o.book }]);
      await updateJoueur(c.tx, j.id, actionPatch(j, c.now));
      await c.log({ action: 'deplacement', resultat: input.cacher ? 'cachee' : 'remise', details: { itemId: input.itemId } });
      return { ok: true as const, cachee: input.cacher };
    });
    return send(reply, r);
  });

  // Livre d'un joueur pour le GM (correction RG-3.1, Clear RG-13.2) : lecture seule.
  app.get<PJ>('/parties/:partieId/joueurs/:joueurId/livre', async (req) => {
    const { partieId, joueurId } = req.params;
    const s = requireRole(req, partieId, 'gm');
    return runner.run(partieId, { type: 'gm', id: s.sub }, async (c) => {
      const j = (await loadJoueurs(c.tx, partieId)).find((x) => x.id === joueurId);
      if (!j) throw introuvable('Joueur');
      return { pseudo: j.pseudo, ...(await vueLivre(c, partieId, joueurId, true)) };
    });
  });
}
