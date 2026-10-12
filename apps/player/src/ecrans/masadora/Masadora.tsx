// Page ⑬ : Masadora, la ville des cartes de sort (prototype validé le 2026-10-12 : docs/prototype/masadora.html).
// RG-9 : le QR du lieu est scanné sur place (RG-9.2) puis gardé le temps de la visite ; paquet de 3 sorts (stock par
// vague de 20 min, max par joueur, RG-9.3) ; revente de toute carte sauf SS (RG-9.4), des objets (amendement
// 2026-10-10) ; Masadora révèle les contrefaçons (RG-8.9). Krach : −50 % (RG-12). Avec le sort Retour, visite à
// distance sans QR. Prix et refus : serveur (P1) ; la requête part au toucher, un refus ne dépense rien.
import type { ObjetType, PositionInput, SpellType } from '@gq/shared';
import { Carte, type CarteProps } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { boutonAchat, estDemasquee, minSec, nbPieces, prixRachat, texteFiche, type EtatBoutique } from '../../lib/boutique';
import { api } from '../../lib/client';
import { numeroCarte, OBJETS } from '../../lib/format';
import { contenu, type EmplacementCarte } from '../../lib/livre';
import { lireQrLieu } from '../../lib/qr';
import { useLivre } from '../../lib/useLivre';
import { CameraQr } from '../CameraQr';
import { Ouverture } from './Ouverture';
import { FiltreEncre, Paquet, Tampon } from './Paquet';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
const delai = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const centre = (el: Element): [number, number] => {
  const b = el.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
};

/** Une pièce revendable : carte du Book ou objet. */
interface Piece {
  itemId: string;
  vue: CarteProps;
  prix: number | null;
  ou: string;
  faux: boolean;
}

/** « −50 J » / « +20 J » sous la jenny de la barre. */
function flotte(texte: string, genre: 'gain' | 'perte') {
  const j = document.querySelector('.barre .jenny');
  if (!j) return;
  const f = document.createElement('span');
  f.className = `mas-flotte ${genre}`;
  f.textContent = texte;
  j.append(f);
  f.animate([{ opacity: 0, translate: '0 -6px' }, { opacity: 1, translate: '0 4px', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0, translate: '0 10px' }], { duration: 1700, easing: 'ease-out' }).finished.finally(() => f.remove());
}

export function Masadora({
  partieId,
  jenny,
  version,
  positionAction,
  apresAction,
  majJenny,
  annoncer,
  onRetour,
  retour,
}: {
  partieId: string;
  jenny: number;
  version: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  apresAction: () => void;
  majJenny: (jenny: number) => void;
  annoncer: (texte: string, qui?: string) => void;
  onRetour: () => void;
  /** Visite à distance ouverte par Retour : temps restant. */
  retour: { resteMs: number; recuA: number } | null;
}) {
  const [etat, setEtat] = useState<{ e: EtatBoutique; recuA: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [ouverture, setOuverture] = useState<{ sorts: SpellType[]; depuis: DOMRect | null } | null>(null);
  const [fiche, setFiche] = useState<Piece | null>(null);
  const [tampon, setTampon] = useState<string[] | null>(null);
  const [vend, setVend] = useState(false);
  const [parties, setParties] = useState<Set<string>>(new Set());
  const [, setTic] = useState(0);
  const { livre } = useLivre(partieId, version);
  const paquet = useRef<HTMLDivElement>(null);
  const carteFiche = useRef<HTMLDivElement>(null);
  const vendre = useRef<HTMLButtonElement>(null);
  const [frappe, setFrappe] = useState(0);

  const charger = () =>
    api.get<EtatBoutique>(`/parties/${partieId}/boutique`).then(
      (e) => {
        setErreur(null);
        setEtat((avant) => {
          if (e.krachResteMs !== null && avant?.e.krachResteMs == null) setFrappe((n) => n + 1);
          return { e, recuA: Date.now() };
        });
      },
      (x: unknown) => setErreur(message(x)),
    );
  useEffect(() => {
    void charger();
  }, [partieId, version]);

  // Décomptes (vague, Krach, Retour) ; à la fin de la vague ou du Krach, la vitrine se recharge.
  const depuis = etat ? Date.now() - etat.recuA : 0;
  const vagueMs = etat ? etat.e.vagueResteMs - depuis : 0;
  const krachMs = etat?.e.krachResteMs != null ? etat.e.krachResteMs - depuis : null;
  const retourMs = retour ? retour.resteMs - (Date.now() - retour.recuA) : 0;
  const enRetour = retourMs > 0;
  const present = qr !== null || enRetour;
  useEffect(() => {
    const t = setInterval(() => setTic((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const finVague = etat !== null && vagueMs <= 0;
  const finKrach = krachMs !== null && krachMs <= 0;
  useEffect(() => {
    if (finVague || finKrach) void charger();
  }, [finVague, finKrach]);

  useEffect(() => {
    if (!fiche) return;
    vendre.current?.focus({ preventScroll: true });
    const clavier = (e: KeyboardEvent) => e.key === 'Escape' && !vend && setFiche(null);
    addEventListener('keydown', clavier);
    return () => removeEventListener('keydown', clavier);
  }, [fiche, vend]);

  const lieu = qr ? { qr } : {};
  const e = etat?.e ?? null;
  const krach = krachMs !== null && krachMs > 0;
  const bouton = e ? boutonAchat({ present, envoi, e, jenny, vagueMs }) : null;

  const acheter = async () => {
    if (!e || !bouton) return;
    if (bouton.qr) return setScan(true);
    setEnvoi(true);
    try {
      const r = await api.post<{ prix: number; sorts: { itemId: string; sort: SpellType }[]; jenny: number }>(`/parties/${partieId}/boutique/achat`, { ...lieu, position: await positionAction() });
      majJenny(r.jenny);
      flotte(`−${r.prix} J`, 'perte');
      setOuverture({ sorts: r.sorts.map((s) => s.sort), depuis: paquet.current?.getBoundingClientRect() ?? null });
    } catch (x) {
      vibrer([60, 60, 60]);
      annoncer(`${message(x)}. Rien n’a été dépensé.`, 'Masadora');
      void charger();
    } finally {
      setEnvoi(false);
    }
  };

  const revendre = async () => {
    const p = fiche;
    if (!p || vend) return;
    setVend(true);
    let r: { prix: number; contrefacon: 'copie' | 'deguise' | null; jenny: number };
    try {
      r = await api.post(`/parties/${partieId}/boutique/revente`, { ...lieu, itemId: p.itemId, position: await positionAction() });
    } catch (x) {
      setVend(false);
      setFiche(null);
      vibrer([60, 60, 60]);
      annoncer(`${message(x)}.`, 'Masadora');
      return;
    }
    // Le serveur dit ce que Masadora a reconnu (RG-8.9).
    const faux = r.contrefacon !== null;
    setTampon(faux ? ['CONTRE-', 'FAÇON'] : ['VENDU', `${r.prix} J`]);
    vibrer(faux ? [60, 60, 60] : 40);
    await delai(faux ? 900 : 600);
    // Les pièces quittent la carte et tombent dans la barre.
    const calme = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [x0, y0] = carteFiche.current ? centre(carteFiche.current) : [innerWidth / 2, innerHeight / 2];
    const cible = document.querySelector('.barre .jenny');
    const [x1, y1] = cible ? centre(cible) : [innerWidth - 40, 30];
    setFiche(null);
    setTampon(null);
    setVend(false);
    setParties((s) => new Set(s).add(p.itemId));
    if (!calme)
      await Promise.all(
        Array.from({ length: nbPieces(r.prix) }, (_, i) => {
          const el = document.createElement('i');
          el.className = 'mas-piece';
          el.textContent = 'J';
          document.body.append(el);
          const dx = (Math.random() - 0.5) * 120;
          const haut = 80 + Math.random() * 80;
          return el
            .animate(
              [
                { transform: `translate(${x0 + dx * 0.3}px,${y0}px) scale(.6)`, opacity: 0 },
                { transform: `translate(${x0 + dx}px,${y0 - haut}px) scale(1.1)`, opacity: 1, offset: 0.35 },
                { transform: `translate(${x1}px,${y1}px) scale(.7)`, opacity: 1 },
              ],
              { duration: 760, delay: i * 70, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'both' },
            )
            .finished.finally(() => {
              el.remove();
              vibrer(8);
            });
        }),
      );
    majJenny(r.jenny);
    flotte(`+${r.prix} J`, 'gain');
    apresAction();
    if (r.contrefacon === 'copie') annoncer(`Masadora a reconnu une contrefaçon : ${p.vue.nom} reprise ${r.prix} J.`, 'Masadora');
    else if (r.contrefacon === 'deguise') annoncer(`Masadora a reconnu un doublon déguisé : elle reprend sa vraie carte ${r.prix} J.`, 'Masadora');
  };

  // Revente : cartes du Book (hors table d'échange) et objets.
  const cartes: Piece[] =
    livre && e
      ? contenu(livre)
          .filter((c): c is EmplacementCarte => c.kind === 'carte' && !c.engagee)
          .map((c) => ({
            itemId: c.itemId,
            vue: { genre: 'designee', numero: c.numero, nom: c.nom, rang: c.rang, limite: c.limite ?? null, texte: c.texte ?? null, grisee: estDemasquee(c) },
            prix: prixRachat(c, e),
            ou: texteFiche({ objet: false, designe: c.designe && !c.cachee, numero: numeroCarte(c.numero), prix: prixRachat(c, e) ?? 0 }),
            faux: estDemasquee(c),
          }))
      : [];
  const objets: Piece[] =
    livre && e
      ? livre.objets
          .filter((o) => !o.engage)
          .map((o) => {
            const d = OBJETS[o.objet as ObjetType];
            const prix = e.reventeObjets[o.objet] ?? null;
            return { itemId: o.itemId, vue: { genre: 'objet', numero: d.numero ? String(d.numero) : '—', nom: d.nom, texte: d.effet }, prix, ou: texteFiche({ objet: true, prix: prix ?? 0 }), faux: false };
          })
      : [];
  const gele = livre?.gele ?? false;
  const tuile = (p: Piece) => (
    <button
      key={p.itemId}
      className={`choix${p.faux ? ' faux' : ''}${parties.has(p.itemId) ? ' part' : ''}`}
      disabled={p.prix === null}
      aria-label={`${p.vue.nom}, ${p.prix === null ? 'invendable' : `rachat ${p.prix} jenny`}`}
      onClick={() => setFiche(p)}
    >
      <Carte {...p.vue} />
      <span className="rachat">{p.prix === null ? 'invendable' : `${p.prix} J`}</span>
    </button>
  );

  return (
    <div className="masadora">
      <FiltreEncre />
      <div className="mas-tete">
        <button className="mas-retour" onClick={onRetour}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Accueil
        </button>
        <div className="enseigne">
          <div className="planche">
            <h1>MASADORA</h1>
            <span>la ville des cartes de sort</span>
          </div>
        </div>
        {enRetour && (
          <span className="distance" role="status">
            Visite à distance (Retour) · <b>{minSec(retourMs)}</b>
          </span>
        )}
      </div>

      {erreur && <p className="mas-erreur">{erreur}</p>}

      {scan && (
        <section className="mas-case">
          <CameraQr
            lire={lireQrLieu}
            onLu={(v) => {
              setQr(v);
              setScan(false);
              annoncer('QR de Masadora lu : tu es à la boutique.', 'Masadora');
            }}
            invalide="Ce QR n’est pas celui d’un lieu du jeu"
            saisie="Ou saisis le code de la boutique"
          />
          <button className="mas-secondaire" onClick={() => setScan(false)}>
            Fermer l’appareil photo
          </button>
        </section>
      )}

      {e && bouton && (
        <section className="mas-case vitrine" aria-labelledby="mas-t-paquet">
          <div className={`presentoir${envoi ? ' envoi' : ''}`}>
            <Paquet ref={paquet} />
            {krach && (
              <span key={frappe} className="tampon-krach frappe">
                <Tampon mots={['KRACH', '−50 %']} taille={22} />
              </span>
            )}
          </div>
          <div className="infos">
            <h2 id="mas-t-paquet" className="quoi">
              Paquet de 3 sorts au hasard
            </h2>
            <div className="prix">
              <b>
                {e.prixPaquet}
                <small>J</small>
              </b>
              {krach && e.prixBase !== e.prixPaquet && <s>{e.prixBase} J</s>}
            </div>
            {krach && krachMs !== null && (
              <p className="krach-fin">
                Fin du Krach dans <b>{minSec(krachMs)}</b>
              </p>
            )}
            <dl>
              <div>
                <dt>Reste cette vague</dt>
                <dd className={e.paquetsRestants ? undefined : 'vide'}>{e.paquetsRestants ? `${e.paquetsRestants} paquet${e.paquetsRestants > 1 ? 's' : ''}` : 'épuisé'}</dd>
              </div>
              <div>
                <dt>Vague suivante</dt>
                <dd>{minSec(vagueMs)}</dd>
              </div>
              <div>
                <dt>Tes achats</dt>
                <dd className={e.mesAchats >= e.maxParVague ? 'vide' : undefined}>
                  {e.mesAchats} / {e.maxParVague}
                </dd>
              </div>
            </dl>
          </div>
          <button className={`acheter${bouton.qr ? ' qr' : ''}`} disabled={!bouton.actif || scan} onClick={() => void acheter()}>
            {bouton.texte}
          </button>
        </section>
      )}

      {e && (
        <section className={`mas-case revente${!present || gele ? ' ferme' : ''}`} aria-labelledby="mas-t-revente">
          <div className="tete">
            <h2 id="mas-t-revente">Revendre</h2>
            <span>Masadora reprend toute carte, sauf les SS</span>
          </div>
          {!present && <p className="aide">Scanne le QR de la boutique pour revendre.</p>}
          {present && gele && <p className="aide">Ton Book est gelé : va voir le Game Master.</p>}
          <h3>Cartes</h3>
          {cartes.length ? <div className="grille">{cartes.map(tuile)}</div> : <p className="aide">Aucune carte à revendre.</p>}
          {objets.length > 0 && (
            <>
              <h3>Objets</h3>
              <div className="grille">{objets.map(tuile)}</div>
            </>
          )}
          <p className="aide">
            Rachat : D {e.revente.D} J · C {e.revente.C} J · B {e.revente.B} J · A {e.revente.A} J · S {e.revente.S} J · contrefaçon {e.reventeContrefacon} J. Une carte posée sur une table d’échange
            n’apparaît pas ici.
          </p>
        </section>
      )}

      {fiche && (
        <div className="mas-fiche" role="dialog" aria-modal="true" aria-labelledby="mas-f-ou" onClick={(x) => x.target === x.currentTarget && !vend && setFiche(null)}>
          <div className="f-boite">
            <div className="f-carte" ref={carteFiche}>
              <Carte {...fiche.vue} />
              {tampon && (
                <span className="mas-tampon pose">
                  <Tampon mots={tampon} taille={tampon[0] === 'VENDU' ? 24 : 18} />
                </span>
              )}
            </div>
            <p className="ou" id="mas-f-ou">
              {fiche.ou}
            </p>
            <div className="f-actions">
              <button className="garder" disabled={vend} onClick={() => setFiche(null)}>
                Garder
              </button>
              <button ref={vendre} className="vendre" disabled={vend} onClick={() => void revendre()}>
                {vend ? 'Envoi…' : `Revendre ${fiche.prix} J`}
              </button>
            </div>
          </div>
        </div>
      )}

      {ouverture && (
        <Ouverture
          sorts={ouverture.sorts}
          depuis={ouverture.depuis}
          onFini={() => {
            setOuverture(null);
            apresAction();
          }}
        />
      )}
    </div>
  );
}
