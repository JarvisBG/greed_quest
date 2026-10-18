// Rapports d'une ou de plusieurs parties : libellés, CSV (séparateur « ; » et BOM, pour Excel en français) et
// document Word (HTML ouvert par Word), comme les exports d'Otaku Quest.
import { GENRES, OCCUPATIONS, RESEAUX, SOURCES, TRANCHES_AGE, VILLES, type ChoixFiche } from '@gq/shared';

export interface Statistiques {
  partie: { id: string; nom: string; etat: string; creeLe: string; demarreeA: string | null; derniereActiviteA: string | null; dureeMin: number | null; gagnant: string | null };
  joueurs: { inscrits: number; actifs: number; inactifs: number; abandons: number; disqualifies: number; tempsDeJeuMoyenMin: number; actionsParJoueur: number };
  parHeure: { heure: number; actions: number; joueurs: number; inscriptions: number }[];
  scans: { reussis: number; refuses: number; parZone: { nom: string; n: number }[]; balises: { libelle: string; zone: string; n: number }[] };
  activites: Record<string, number>;
  equipe: { gm: number; pnj: number };
  classement: { place: number; pseudo: string; cartes: number; points: number; jenny: number }[];
  public: Public;
}

export interface Compte {
  id: string;
  n: number;
}
/** RG-5.3 : qui est venu (Fiche Hunter). */
export interface Public {
  fiches: number;
  age: Compte[];
  genre: Compte[];
  occupation: Compte[];
  ville: Compte[];
  quartiers: Compte[];
  reseaux: Compte[];
  source: Compte[];
  numeros: number;
  consentis: number;
  revenus: number;
}

/** Rubriques de la Fiche Hunter, avec les libellés des choix. */
export const RUBRIQUES_PUBLIC: { cle: 'age' | 'genre' | 'occupation' | 'ville' | 'reseaux' | 'source' | 'quartiers'; titre: string; choix?: readonly ChoixFiche[] }[] = [
  { cle: 'age', titre: 'Âge', choix: TRANCHES_AGE },
  { cle: 'genre', titre: 'Genre', choix: GENRES },
  { cle: 'occupation', titre: 'Ils sont…', choix: OCCUPATIONS },
  { cle: 'ville', titre: 'Villes', choix: VILLES },
  { cle: 'quartiers', titre: 'Quartiers les plus cités' },
  { cle: 'reseaux', titre: 'Réseaux où ils sont actifs', choix: RESEAUX },
  { cle: 'source', titre: 'Comment ils ont connu l’événement', choix: SOURCES },
];
/** Libellé d'un choix ; texte libre (quartier, regroupé en minuscules) : une majuscule à chaque mot. */
export const libelleChoix = (choix: readonly ChoixFiche[] | undefined, id: string) =>
  choix?.find((c) => c.id === id)?.libelle ?? id.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

/** Additionne les comptes de plusieurs parties (rapport « toutes les parties »). */
export function cumulerPublic(ps: Public[]): Public {
  const somme = (l: Compte[][]) => {
    const m = new Map<string, number>();
    for (const c of l.flat()) m.set(c.id, (m.get(c.id) ?? 0) + c.n);
    return [...m].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  };
  const n = (f: (p: Public) => number) => ps.reduce((t, p) => t + f(p), 0);
  return {
    fiches: n((p) => p.fiches),
    age: somme(ps.map((p) => p.age)),
    genre: somme(ps.map((p) => p.genre)),
    occupation: somme(ps.map((p) => p.occupation)),
    ville: somme(ps.map((p) => p.ville)),
    quartiers: somme(ps.map((p) => p.quartiers)).slice(0, 10),
    reseaux: somme(ps.map((p) => p.reseaux)),
    source: somme(ps.map((p) => p.source)),
    numeros: n((p) => p.numeros),
    consentis: n((p) => p.consentis),
    revenus: n((p) => p.revenus),
  };
}

export interface Contact {
  telephone: string;
  pseudo: string;
  age: string;
  genre: string;
  ville: string;
  quartier: string;
  derniere: string;
  parties: number;
}
/** RG-5.3 : contacts qui acceptent d'être recontactés. */
export function csvContacts(cs: Contact[]): string {
  return csv([
    ['Téléphone (WhatsApp)', 'Pseudo', 'Âge', 'Genre', 'Ville', 'Quartier', 'Dernière partie', 'Parties jouées'],
    ...cs.map((c) => [c.telephone, c.pseudo, libelleChoix(TRANCHES_AGE, c.age), libelleChoix(GENRES, c.genre), libelleChoix(VILLES, c.ville), c.quartier, c.derniere, c.parties]),
  ]);
}

/** Pourcentage arrondi « 42 % ». */
export const pct = (n: number, total: number) => `${total ? Math.round((n / total) * 100) : 0} %`;

export const ACTIVITES: [string, string][] = [
  ['sorts', 'Sorts lancés'],
  ['echanges', 'Échanges conclus'],
  ['achats', 'Achats à Masadora'],
  ['reventes', 'Reventes'],
  ['encheres', 'Enchères clôturées'],
  ['arene', 'Combats d’arène'],
  ['checkpoints', 'Checkpoints PNJ'],
  ['evenements', 'Évènements lancés'],
  ['transformations', 'Transformations'],
  ['clears', 'Clear déclarés'],
];

export const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
export const heureDe = (ms: number) => `${new Date(ms).getHours()}h`;
export const duree = (min: number | null) => (min === null ? '—' : min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);

/** Une cellule CSV : entre guillemets si elle contient « ; », un guillemet ou un saut de ligne. */
function cellule(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function csv(lignes: unknown[][]): string {
  return '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\r\n');
}

/** Une ligne par partie (rapport « tous les festivals »). */
export function csvParties(stats: Statistiques[]): string {
  return csv([
    ['Code', 'Partie', 'Date', 'État', 'Durée (min)', 'Joueurs inscrits', 'Abandons', 'Temps de jeu moyen (min)', 'Actions par joueur', 'Scans réussis', 'Scans refusés', ...ACTIVITES.map(([, l]) => l), 'Gagnant'],
    ...stats.map((s) => [
      s.partie.id,
      s.partie.nom,
      s.partie.demarreeA ?? s.partie.creeLe,
      s.partie.etat,
      s.partie.dureeMin ?? '',
      s.joueurs.inscrits,
      s.joueurs.abandons,
      s.joueurs.tempsDeJeuMoyenMin,
      s.joueurs.actionsParJoueur,
      s.scans.reussis,
      s.scans.refuses,
      ...ACTIVITES.map(([k]) => s.activites[k] ?? 0),
      s.partie.gagnant ?? '',
    ]),
  ]);
}

/** Les chiffres d'une partie, par rubrique. */
export function csvPartie(s: Statistiques): string {
  return csv([
    ['Rubrique', 'Libellé', 'Valeur'],
    ['Partie', 'Nom', s.partie.nom],
    ['Partie', 'Code', s.partie.id],
    ['Partie', 'Démarrée le', s.partie.demarreeA ?? ''],
    ['Partie', 'Durée (min)', s.partie.dureeMin ?? ''],
    ['Partie', 'Gagnant', s.partie.gagnant ?? ''],
    ['Joueurs', 'Inscrits', s.joueurs.inscrits],
    ['Joueurs', 'Actifs à la fin', s.joueurs.actifs],
    ['Joueurs', 'Abandons', s.joueurs.abandons],
    ['Joueurs', 'Disqualifiés', s.joueurs.disqualifies],
    ['Joueurs', 'Temps de jeu moyen (min)', s.joueurs.tempsDeJeuMoyenMin],
    ['Joueurs', 'Actions par joueur', s.joueurs.actionsParJoueur],
    ['Scans', 'Réussis', s.scans.reussis],
    ['Scans', 'Refusés', s.scans.refuses],
    ...s.scans.parZone.map((z) => ['Scans par zone', z.nom, z.n]),
    ...s.scans.balises.map((b) => ['Balises les plus scannées', `${b.libelle} · ${b.zone}`, b.n]),
    ...ACTIVITES.map(([k, l]) => ['Activités', l, s.activites[k] ?? 0]),
    ...s.parHeure.map((h) => ['Par heure', new Date(h.heure).toISOString(), `${h.actions} actions, ${h.joueurs} joueurs, ${h.inscriptions} inscriptions`]),
    ['Équipe', 'Actions du GM', s.equipe.gm],
    ['Équipe', 'Actions des PNJ', s.equipe.pnj],
    ['Public', 'Fiches remplies', s.public.fiches],
    ['Public', 'Numéros recueillis', s.public.numeros],
    ['Public', 'Acceptent d’être recontactés', s.public.consentis],
    ['Public', 'Revenus d’une partie précédente', s.public.revenus],
    ...RUBRIQUES_PUBLIC.flatMap((r) => s.public[r.cle].map((c) => [`Public · ${r.titre}`, libelleChoix(r.choix, c.id), c.n])),
    ...s.classement.map((c) => ['Classement', `${c.place}. ${c.pseudo}`, `${c.cartes} cartes, ${c.points} points, ${c.jenny} J`]),
  ]);
}

const echap = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const tableau = (tete: string[], lignes: unknown[][]) =>
  `<table><tr>${tete.map((t) => `<th>${echap(t)}</th>`).join('')}</tr>${lignes.map((l) => `<tr>${l.map((c) => `<td>${echap(c)}</td>`).join('')}</tr>`).join('')}</table>`;

function sectionPublic(p: Public): string {
  if (!p.fiches) return '';
  return `<h3>Qui est venu (${p.fiches} fiches)</h3>
${tableau(['Indicateur', 'Valeur'], [
  ['Numéros recueillis', p.numeros],
  ['Acceptent d’être recontactés', p.consentis],
  ['Revenus d’une partie précédente', p.revenus],
])}
${RUBRIQUES_PUBLIC.filter((r) => p[r.cle].length)
  .map((r) => `<h4>${echap(r.titre)}</h4>${tableau(['', 'Joueurs', 'Part'], p[r.cle].map((c) => [libelleChoix(r.choix, c.id), c.n, pct(c.n, p.fiches)]))}`)
  .join('')}`;
}

function sectionPartie(s: Statistiques): string {
  return `<h2>${echap(s.partie.nom)} <small>(${echap(s.partie.id)})</small></h2>
<p>${echap(date(s.partie.demarreeA ?? s.partie.creeLe))} · durée ${echap(duree(s.partie.dureeMin))}${s.partie.gagnant ? ` · gagnant : ${echap(s.partie.gagnant)}` : ''}</p>
${tableau(['Indicateur', 'Valeur'], [
  ['Joueurs inscrits', s.joueurs.inscrits],
  ['Abandons', s.joueurs.abandons],
  ['Temps de jeu moyen', duree(Math.round(s.joueurs.tempsDeJeuMoyenMin))],
  ['Actions par joueur', s.joueurs.actionsParJoueur],
  ['Scans réussis', s.scans.reussis],
  ...ACTIVITES.filter(([k]) => s.activites[k]).map(([k, l]) => [l, s.activites[k]]),
])}
${s.parHeure.length ? `<h3>À quelle heure ils jouent</h3>${tableau(['Heure', 'Actions', 'Joueurs', 'Inscriptions'], s.parHeure.map((h) => [heureDe(h.heure), h.actions, h.joueurs, h.inscriptions]))}` : ''}
${s.scans.parZone.length ? `<h3>Zones les plus fréquentées</h3>${tableau(['Zone', 'Scans'], s.scans.parZone.map((z) => [z.nom, z.n]))}` : ''}
${sectionPublic(s.public)}
${s.classement.length ? `<h3>Classement final</h3>${tableau(['Place', 'Joueur', 'Cartes', 'Points', 'Jenny'], s.classement.map((c) => [c.place, c.pseudo, c.cartes, c.points, c.jenny]))}` : ''}`;
}

/** Document Word (HTML que Word ouvre tel quel) : synthèse puis une section par partie. */
export function documentWord(titre: string, stats: Statistiques[]): string {
  const total = (f: (s: Statistiques) => number) => stats.reduce((n, s) => n + f(s), 0);
  const synthese =
    stats.length > 1
      ? `<h2>Synthèse</h2>${tableau(['Partie', 'Date', 'Joueurs', 'Durée', 'Scans', 'Échanges'], [
          ...stats.map((s) => [s.partie.nom, date(s.partie.demarreeA ?? s.partie.creeLe), s.joueurs.inscrits, duree(s.partie.dureeMin), s.scans.reussis, s.activites.echanges ?? 0]),
          ['Total', '', total((s) => s.joueurs.inscrits), '', total((s) => s.scans.reussis), total((s) => s.activites.echanges ?? 0)],
        ])}${sectionPublic(cumulerPublic(stats.map((s) => s.public)))}`
      : '';
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${echap(titre)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#111}h1{font-size:20pt}h2{font-size:15pt;margin-top:18pt}h3{font-size:12pt}table{border-collapse:collapse;margin:6pt 0}th,td{border:1px solid #999;padding:3pt 8pt;text-align:left}th{background:#eee}small{color:#666;font-weight:normal}</style></head>
<body><h1>${echap(titre)}</h1><p>Rapport Greed Island du ${echap(date(new Date().toISOString()))}.</p>${synthese}${stats.map(sectionPartie).join('')}</body></html>`;
}

/** Fait télécharger un texte comme fichier. */
export function telecharger(nom: string, contenu: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const nomFichier = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
