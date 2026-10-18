// Statistiques d'une partie pour les rapports (bilan d'un festival, comparaison entre festivals) : tout est relu dans
// la base (joueurs, terrain, Journal), rien n'est gardé à part. Jamais de position (RG-10.12), même pour le GM.
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { balises, joueurs, journal, parties, zones } from '../db/schema.js';

const HEURE = 3_600_000;

/** Actions du Journal comptées comme activités des joueurs (une ligne non refusée = une fois). */
export const ACTIVITES = {
  sorts: 'sort',
  echanges: 'echange',
  achats: 'achat',
  reventes: 'revente',
  encheres: 'enchere_cloture',
  arene: 'arene_issue',
  checkpoints: 'checkpoint',
  evenements: 'evenement',
  transformations: 'transformation',
  clears: 'clear_demande',
} as const;
export type Activite = keyof typeof ACTIVITES;

export interface Statistiques {
  partie: { id: string; nom: string; etat: string; creeLe: string; demarreeA: string | null; derniereActiviteA: string | null; dureeMin: number | null; gagnant: string | null };
  joueurs: { inscrits: number; actifs: number; inactifs: number; abandons: number; disqualifies: number; tempsDeJeuMoyenMin: number; actionsParJoueur: number };
  /** Une ligne par heure réelle (début de l'heure en ms) : actions des joueurs, joueurs distincts, inscriptions. */
  parHeure: { heure: number; actions: number; joueurs: number; inscriptions: number }[];
  scans: { reussis: number; refuses: number; parZone: { nom: string; n: number }[]; balises: { libelle: string; zone: string; n: number }[] };
  activites: Record<Activite, number>;
  equipe: { gm: number; pnj: number };
  classement: { place: number; pseudo: string; cartes: number; points: number; jenny: number }[];
}

export interface DonneesStat {
  partie: { id: string; nom: string; etat: string; creeLe: Date; demarreeA: number | null; gagnantId: string | null; classementFinal: { place: number; pseudo: string; cartes: number; points: number; jenny: number }[] | null };
  joueurs: { id: string; pseudo: string; statut: string; creeLe: Date }[];
  zones: { id: string; nom: string }[];
  balises: { id: string; libelle: string; zoneId: string }[];
  lignes: { creeLe: Date; acteurType: string; acteurId: string | null; action: string; resultat: string; details: Record<string, unknown> | null }[];
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const arrondi = (x: number) => Math.round(x * 10) / 10;

/** Calcul pur (testé sans base). */
export function calculerStatistiques(d: DonneesStat): Statistiques {
  const parStatut = (s: string) => d.joueurs.filter((j) => j.statut === s).length;
  const actionsJoueurs = d.lignes.filter((l) => l.acteurType === 'joueur' && l.acteurId);

  // Temps de jeu : de la première à la dernière action de chaque joueur.
  const bornes = new Map<string, { debut: number; fin: number; n: number }>();
  for (const l of actionsJoueurs) {
    const t = l.creeLe.getTime();
    const b = bornes.get(l.acteurId!);
    if (b) {
      b.debut = Math.min(b.debut, t);
      b.fin = Math.max(b.fin, t);
      b.n++;
    } else bornes.set(l.acteurId!, { debut: t, fin: t, n: 1 });
  }
  const b = [...bornes.values()];
  const tempsDeJeuMoyenMin = b.length ? arrondi(b.reduce((s, x) => s + (x.fin - x.debut), 0) / b.length / 60_000) : 0;

  const heures = new Map<number, { actions: number; joueurs: Set<string>; inscriptions: number }>();
  const caseHeure = (t: number) => {
    const h = Math.floor(t / HEURE) * HEURE;
    let c = heures.get(h);
    if (!c) heures.set(h, (c = { actions: 0, joueurs: new Set(), inscriptions: 0 }));
    return c;
  };
  for (const l of actionsJoueurs) {
    const c = caseHeure(l.creeLe.getTime());
    c.actions++;
    c.joueurs.add(l.acteurId!);
  }
  for (const j of d.joueurs) caseHeure(j.creeLe.getTime()).inscriptions++;

  const scans = d.lignes.filter((l) => l.action === 'scan');
  const reussis = scans.filter((l) => l.resultat === 'ok');
  const nomZone = new Map(d.zones.map((z) => [z.id, z.nom]));
  const balise = new Map(d.balises.map((x) => [x.id, x]));
  const compter = (cles: string[]) => {
    const m = new Map<string, number>();
    for (const k of cles) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const parZone = compter(reussis.map((l) => nomZone.get(String(l.details?.zoneId)) ?? 'Zone inconnue')).map(([nom, n]) => ({ nom, n }));
  const parBalise = compter(reussis.map((l) => String(l.details?.baliseId)))
    .slice(0, 10)
    .map(([id, n]) => ({ libelle: balise.get(id)?.libelle ?? id, zone: nomZone.get(balise.get(id)?.zoneId ?? '') ?? '', n }));

  const activites = Object.fromEntries(
    (Object.entries(ACTIVITES) as [Activite, string][]).map(([k, action]) => [k, d.lignes.filter((l) => l.action === action && l.resultat !== 'refus').length]),
  ) as Record<Activite, number>;

  const demarree = d.partie.demarreeA;
  const derniere = d.lignes.length ? Math.max(...d.lignes.map((l) => l.creeLe.getTime())) : null;
  return {
    partie: {
      id: d.partie.id,
      nom: d.partie.nom,
      etat: d.partie.etat,
      creeLe: d.partie.creeLe.toISOString(),
      demarreeA: iso(demarree),
      derniereActiviteA: iso(derniere),
      dureeMin: demarree !== null && derniere !== null ? Math.max(0, Math.round((derniere - demarree) / 60_000)) : null,
      gagnant: d.joueurs.find((j) => j.id === d.partie.gagnantId)?.pseudo ?? null,
    },
    joueurs: {
      inscrits: d.joueurs.length,
      actifs: parStatut('actif') + parStatut('gele'),
      inactifs: parStatut('inactif'),
      abandons: parStatut('abandon'),
      disqualifies: parStatut('disqualifie'),
      tempsDeJeuMoyenMin,
      actionsParJoueur: b.length ? arrondi(actionsJoueurs.length / b.length) : 0,
    },
    parHeure: [...heures].sort((a, b) => a[0] - b[0]).map(([heure, c]) => ({ heure, actions: c.actions, joueurs: c.joueurs.size, inscriptions: c.inscriptions })),
    scans: { reussis: reussis.length, refuses: scans.length - reussis.length, parZone, balises: parBalise },
    activites,
    equipe: { gm: d.lignes.filter((l) => l.acteurType === 'gm').length, pnj: d.lignes.filter((l) => l.acteurType === 'pnj').length },
    classement: (d.partie.classementFinal ?? []).slice(0, 10).map(({ place, pseudo, cartes, points, jenny }) => ({ place, pseudo, cartes, points, jenny })),
  };
}

/** Lecture en base puis calcul ; null si la partie n'existe pas. */
export async function statistiquesDe(db: Db, partieId: string): Promise<Statistiques | null> {
  const [p] = await db.select().from(parties).where(eq(parties.id, partieId));
  if (!p) return null;
  const [js, zs, bs, ls] = await Promise.all([
    db.select({ id: joueurs.id, pseudo: joueurs.pseudo, statut: joueurs.statut, creeLe: joueurs.creeLe }).from(joueurs).where(eq(joueurs.partieId, partieId)),
    db.select({ id: zones.id, nom: zones.nom }).from(zones).where(eq(zones.partieId, partieId)),
    db.select({ id: balises.id, libelle: balises.libelle, zoneId: balises.zoneId }).from(balises).where(eq(balises.partieId, partieId)),
    db
      .select({ creeLe: journal.creeLe, acteurType: journal.acteurType, acteurId: journal.acteurId, action: journal.action, resultat: journal.resultat, details: journal.details })
      .from(journal)
      .where(eq(journal.partieId, partieId))
      .orderBy(asc(journal.id)),
  ]);
  return calculerStatistiques({
    partie: { id: p.id, nom: p.nom, etat: p.etat, creeLe: p.creeLe, demarreeA: p.demarreeA ?? null, gagnantId: p.gagnantId, classementFinal: p.classementFinal ?? null },
    joueurs: js,
    zones: zs,
    balises: bs,
    lignes: ls,
  });
}

/** Journal complet pour l'export (CSV) : détails sans aucune position (RG-10.12). */
export async function journalExport(db: Db, partieId: string) {
  const ls = await db.select().from(journal).where(eq(journal.partieId, partieId)).orderBy(asc(journal.id));
  const pseudos = new Map((await db.select({ id: joueurs.id, pseudo: joueurs.pseudo }).from(joueurs).where(eq(joueurs.partieId, partieId))).map((j) => [j.id, j.pseudo]));
  return ls.map((l) => {
    const { position: _p, positions: _ps, ...details } = (l.details ?? {}) as Record<string, unknown>;
    return {
      date: l.creeLe.toISOString(),
      heureJeuMin: Math.round(l.heureJeu / 6000) / 10,
      acteur: l.acteurType,
      joueur: l.acteurType === 'joueur' && l.acteurId ? (pseudos.get(l.acteurId) ?? '') : '',
      action: l.action,
      resultat: l.resultat,
      motif: l.motif ?? '',
      details: JSON.stringify(details),
    };
  });
}
