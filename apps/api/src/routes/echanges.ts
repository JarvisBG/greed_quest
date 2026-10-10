// Échanges « à la Pokémon » (RG-11.1 amendé, 11.2, 11.3, 11.6).
import {
  answerTrade,
  cancelTrade,
  concludeTrade,
  confirmTrade,
  estInvisible,
  proposeTrade,
  setTradeOffer,
  isRepeatedUnbalanced,
  trade,
  tradeSideValue,
  unbalancedDirection,
  UNBALANCED_WINDOW_MS,
  type Book,
  type TradeParty,
  type TradeSession,
  type TradeSide,
} from '@gq/engine';
import { EchangeOffre, EchangeProposition, EchangeReponse } from '@gq/shared';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../auth/guard.js';
import { alerte } from '../core/alertes.js';
import { activeSession, lastPairTrade, saveSession, sessionOf } from '../core/echanges.js';
import { paramsOf } from '../core/params.js';
import { recordPosition } from '../core/position.js';
import type { ActionCtx } from '../core/runner.js';
import { actionPatch, isLivreGele, loadBooks, loadCatalogue, loadJoueur, saveBooks, updateJoueur, type Catalogue, type JoueurRow } from '../core/state.js';
import { echanges, journal } from '../db/schema.js';
import { introuvable } from '../errors.js';
import { refus, send } from '../http.js';
import { newId } from '../ids.js';
import { parse } from '../validation.js';
import { rangeOf } from './sorts.js';

type P = { Params: { partieId: string } };
type PS = { Params: { partieId: string; id: string } };

const party = async (c: ActionCtx, j: JoueurRow, book: Book): Promise<TradeParty> => ({
  id: j.id,
  status: j.statut,
  book,
  jenny: j.jenny,
  livreGele: await isLivreGele(c.tx, j.id),
});

/** Ce que voit un participant. RG-11.6 : les cartes de l'autre paraissent toujours vraies. */
function view(s: TradeSession, moi: string, pseudos: Record<string, string>, books: Map<string, Book>, cat: Catalogue) {
  const part = (joueurId: string, side: TradeSide) => ({
    cartes: side.itemIds.map((itemId) => {
      const item = books.get(joueurId)?.items.find((i) => i.id === itemId);
      const carteId = item?.kind === 'carte' ? item.cardId : null;
      return { itemId, carteId, nom: carteId ? cat.nomDe(carteId) : null, rang: carteId ? cat.rangDe(carteId) : null };
    }),
    jenny: side.jenny,
  });
  const jeSuisA = moi === s.a;
  const autre = jeSuisA ? s.b : s.a;
  return {
    id: s.id,
    etat: s.etat,
    avec: { id: autre, pseudo: pseudos[autre] ?? '?' },
    invite: !jeSuisA,
    maPart: part(moi, jeSuisA ? s.donneA : s.donneB),
    sonPart: part(autre, jeSuisA ? s.donneB : s.donneA),
    jeValide: jeSuisA ? s.valideA : s.valideB,
    ilValide: jeSuisA ? s.valideB : s.valideA,
  };
}

export async function echangesRoutes(app: FastifyInstance) {
  const { runner } = app.gq;

  /** Charge la session demandée (expirée au besoin), les deux joueurs et leurs Livres. */
  async function load(c: ActionCtx, sessionId: string) {
    const [row] = await c.tx.select().from(echanges).where(and(eq(echanges.id, sessionId), eq(echanges.partieId, c.partie.id)));
    if (!row) throw introuvable('Échange');
    const s = sessionOf(row);
    const [a, b] = await Promise.all([loadJoueur(c.tx, s.a), loadJoueur(c.tx, s.b)]);
    const books = await loadBooks(c.tx, [s.a, s.b]);
    const cat = await loadCatalogue(c.tx, c.partie.id);
    return { s, a: a!, b: b!, books, cat, pseudos: { [a!.id]: a!.pseudo, [b!.id]: b!.pseudo } };
  }

  /** Enregistre la session et la diffuse aux deux participants. */
  async function publish(c: ActionCtx, s: TradeSession, ctx: Awaited<ReturnType<typeof load>>, concluA: number | null = null) {
    await saveSession(c.tx, c.partie.id, s, concluA);
    for (const id of [s.a, s.b]) c.emit({ type: 'joueur', id }, 'echange', view(s, id, ctx.pseudos, ctx.books, ctx.cat));
  }

  // A propose à B, choisi dans la liste des joueurs à portée.
  app.post<P>('/parties/:partieId/echanges', async (req, reply) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    const input = parse(EchangeProposition, req.body);
    const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const a = await loadJoueur(c.tx, s.sub);
      const b = await loadJoueur(c.tx, input.cibleId);
      if (!a) throw introuvable('Joueur');
      await recordPosition(c, a, input.position);
      const deny = async (code: string, message: string) => {
        await c.log({ action: 'echange_proposition', resultat: 'refus', details: { code, avec: input.cibleId } });
        return refus(code, message);
      };
      if (!b || b.partieId !== partieId) return deny('cible_invalide', 'Joueur introuvable');
      if (estInvisible(b, c.now)) return deny('hors_portee', 'Ce joueur est hors de portée'); // Zetsu
      // Une seule session active par joueur.
      if (await activeSession(c.tx, partieId, a.id, c.now)) return deny('session_en_cours', 'Termine d’abord ton échange en cours');
      if (await activeSession(c.tx, partieId, b.id, c.now)) return deny('session_en_cours', 'Ce joueur est déjà en train d’échanger');
      const books = await loadBooks(c.tx, [a.id, b.id]);
      const res = proposeTrade({
        id: newId(),
        now: c.now,
        gameState: c.partie.etat,
        a: { ...(await party(c, a, books.get(a.id)!)), position: a.position },
        b: { ...(await party(c, b, books.get(b.id)!)), position: b.position },
        portee: rangeOf(await paramsOf(c.tx, c.partie)),
        dernierEchangePaireA: await lastPairTrade(c.tx, partieId, a.id, b.id),
      });
      if (!res.ok) return deny(res.code, res.message);
      // Zetsu : se montrer pour échanger rompt l'invisibilité.
      await updateJoueur(c.tx, a.id, { ...actionPatch(a, c.now), ...(estInvisible(a, c.now) ? { zetsuJusqua: null } : {}) });
      await c.log({ action: 'echange_proposition', resultat: 'ok', details: { sessionId: res.session.id, avec: b.id } });
      const cat = await loadCatalogue(c.tx, partieId);
      await publish(c, res.session, { s: res.session, a, b, books, cat, pseudos: { [a.id]: a.pseudo, [b.id]: b.pseudo } });
      return { ok: true as const, sessionId: res.session.id };
    });
    return send(reply, r);
  });

  // Session en cours du joueur (reprise après rechargement de l'app).
  app.get<P>('/parties/:partieId/echanges/courant', async (req) => {
    const { partieId } = req.params;
    const s = requireRole(req, partieId, 'joueur');
    return runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
      const cur = await activeSession(c.tx, partieId, s.sub, c.now);
      if (!cur) return { ok: true as const, echange: null };
      const ctx = await load(c, cur.id);
      return { ok: true as const, echange: view(cur, s.sub, ctx.pseudos, ctx.books, ctx.cat) };
    });
  });

  /** Gabarit des actions sur une session : refus journalisé, sinon session enregistrée et diffusée. */
  function sessionAction(
    url: string,
    action: string,
    apply: (
      c: ActionCtx,
      ctx: Awaited<ReturnType<typeof load>>,
      joueurId: string,
      body: unknown,
    ) => Promise<{ ok: true; session: TradeSession; concluA?: number; extra?: Record<string, unknown> } | { ok: false; code: string; message: string }>,
  ) {
    app.post<PS>(`/parties/:partieId/echanges/:id/${url}`, async (req, reply) => {
      const { partieId, id } = req.params;
      const s = requireRole(req, partieId, 'joueur');
      const r = await runner.run(partieId, { type: 'joueur', id: s.sub }, async (c) => {
        const ctx = await load(c, id);
        const res = await apply(c, ctx, s.sub, req.body);
        if (!res.ok) {
          await c.log({ action, resultat: 'refus', details: { sessionId: id, code: res.code } });
          return refus(res.code, res.message);
        }
        await publish(c, res.session, ctx, res.concluA ?? null);
        if (!res.extra) await c.log({ action, resultat: res.session.etat, details: { sessionId: id } });
        return { ok: true as const, echange: view(res.session, s.sub, ctx.pseudos, ctx.books, ctx.cat), ...res.extra };
      });
      return send(reply, r);
    });
  }

  sessionAction('reponse', 'echange_reponse', async (c, ctx, joueurId, body) => {
    const { accepte } = parse(EchangeReponse, body);
    return answerTrade(ctx.s, joueurId, accepte, c.now);
  });

  sessionAction('offre', 'echange_offre', async (c, ctx, joueurId, body) => {
    const side = parse(EchangeOffre, body);
    const book = ctx.books.get(joueurId)!;
    // On ne propose que ses propres cartes (pas de sorts, RG-11) et des jenny qu'on possède.
    const ok = side.itemIds.every((itemId) => book.items.some((i) => i.id === itemId && i.kind === 'carte'));
    if (!ok || new Set(side.itemIds).size !== side.itemIds.length) return refus('element_invalide', 'Choisis des cartes de ton Livre');
    const jenny = joueurId === ctx.a.id ? ctx.a.jenny : ctx.b.jenny;
    if (side.jenny > jenny) return refus('jenny_insuffisants', 'Jenny insuffisants');
    return setTradeOffer(ctx.s, joueurId, side, c.now);
  });

  sessionAction('annuler', 'echange_annulation', async (c, ctx, joueurId) => cancelTrade(ctx.s, joueurId, c.now));

  // Double validation : l'échange s'exécute quand les deux ont validé, tout est revérifié (RG-11.2, 11.3).
  sessionAction('valider', 'echange', async (c, ctx, joueurId) => {
    const v = confirmTrade(ctx.s, joueurId, c.now);
    if (!v.ok) return v;
    if (!v.pret) return { ok: true, session: v.session };
    const { s, a, b, books } = ctx;
    const res = trade(
      {
        now: c.now,
        gameState: c.partie.etat,
        a: await party(c, a, books.get(a.id)!),
        b: await party(c, b, books.get(b.id)!),
        donneA: s.donneA,
        donneB: s.donneB,
        dernierEchangePaireA: await lastPairTrade(c.tx, c.partie.id, a.id, b.id),
      },
      ctx.cat.rangDe,
    );
    if (!res.ok) {
      // Les deux validations tombent ; la session reste ouverte pour corriger les parts.
      await saveSession(c.tx, c.partie.id, { ...v.session, valideA: false, valideB: false });
      return res;
    }
    await saveBooks(c.tx, c.partie.id, c.now, [
      { joueurId: a.id, before: books.get(a.id)!, after: res.a.book },
      { joueurId: b.id, before: books.get(b.id)!, after: res.b.book },
    ]);
    await updateJoueur(c.tx, a.id, { ...actionPatch(a, c.now), jenny: res.a.jenny });
    await updateJoueur(c.tx, b.id, { ...actionPatch(b, c.now), jenny: res.b.jenny });
    const conclu = concludeTrade(v.session);
    const resume = (items: typeof res.recuParA) => items.map((i) => (i.kind === 'carte' ? ctx.cat.nomDe(i.cardId) : i.kind === 'sort' ? i.spell : i.objet));
    // RG-15 : valeur de chaque part, pour repérer les échanges répétés déséquilibrés.
    const rangs = (items: typeof res.recuParA) => items.flatMap((i) => (i.kind === 'carte' ? [ctx.cat.rangDe(i.cardId)] : []));
    const valeurA = tradeSideValue({ rangs: rangs(res.recuParB), jenny: s.donneA.jenny });
    const valeurB = tradeSideValue({ rangs: rangs(res.recuParA), jenny: s.donneB.jenny });
    const sens = unbalancedDirection(valeurA, valeurB);
    const donneurDesequilibre = sens === 'a' ? a.id : sens === 'b' ? b.id : null;
    await c.log({
      action: 'echange',
      resultat: 'ok',
      details: { sessionId: s.id, a: a.id, b: b.id, donneA: s.donneA, donneB: s.donneB, recuParA: resume(res.recuParA), recuParB: resume(res.recuParB), valeurA, valeurB, donneurDesequilibre },
    });
    if (donneurDesequilibre) {
      const paire = await c.tx
        .select({ a: journal.heureJeu, details: journal.details })
        .from(journal)
        .where(
          and(
            eq(journal.partieId, c.partie.id),
            eq(journal.action, 'echange'),
            eq(journal.resultat, 'ok'),
            gte(journal.heureJeu, c.now - UNBALANCED_WINDOW_MS),
            sql`((${journal.details}->>'a' = ${a.id} and ${journal.details}->>'b' = ${b.id}) or (${journal.details}->>'a' = ${b.id} and ${journal.details}->>'b' = ${a.id}))`,
          ),
        );
      const historique = paire.map((r) => ({ a: r.a, donneurDesequilibre: (r.details?.donneurDesequilibre as string | null) ?? null }));
      if (isRepeatedUnbalanced(historique, c.now)) {
        await alerte(c, 'echanges_desequilibres', { joueurs: [a.id, b.id], pseudos: [a.pseudo, b.pseudo], donneur: donneurDesequilibre, echanges: historique.length });
      }
    }
    // Diffusion : les deux joueurs (via la session) ; écran géant si une carte S ou SS a changé de main.
    if (res.publicSurEcran) c.emit({ type: 'tracker' }, 'fil', { type: 'echange', joueurs: [a.pseudo, b.pseudo], heureJeu: c.now });
    return { ok: true, session: conclu, concluA: c.now, extra: { conclu: true } };
  });
}
