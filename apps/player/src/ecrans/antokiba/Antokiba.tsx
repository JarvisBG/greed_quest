// Page ⑭ : Antokiba, la ville des enchères (prototype validé : docs/prototype/antokiba.html).
// RG-11.4 / 11.5 : un PNJ met une carte en vente 3 min ; pour participer, on scanne le QR d'Antokiba sur place (gardé
// le temps de la visite ; avec le sort Retour, visite à distance sans QR), puis on lève sa palette dans l'app. Seul le
// gagnant paie, à la clôture ; sans offre, la carte retourne au stock du PNJ. La salle des ventes est la seule case
// sombre : le lot sur un pupitre sous un projecteur, la meilleure offre, le décompte ; plusieurs lots = vignettes.
// Montants et refus : serveur (P1) ; la requête part au toucher, un refus ne dépense rien.
import type { PositionInput } from '@gq/shared';
import { Carte } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { minSec } from '../../lib/boutique';
import { api } from '../../lib/client';
import { boutonPalette, etatVignette, fusionnerLot, jeMene, type Cloture, type Lot } from '../../lib/encheres';
import { lireQrLieu } from '../../lib/qr';
import { CameraQr } from '../CameraQr';
import { FiltreEncre, Tampon } from '../masadora/Paquet';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);
/** Un lot clos reste 4 s dans la salle avec son tampon ; sans nouvelle du serveur, il part au bout de 20 s. */
const TAMPON_MS = 4000;
const ATTENTE_MS = 20_000;
/**
 * QR d'Antokiba scanné : gardé 15 min, même si l'on quitte la page (« Kirua a surenchéri… Voir » y ramène un joueur
 * qui est toujours sur place). Le serveur le revérifie à chaque inscription (RG-11.4).
 */
const QR_MS = 15 * 60_000;
let qrGarde: { code: string; a: number } | null = null;
const qrValide = () => (qrGarde && Date.now() - qrGarde.a < QR_MS ? qrGarde.code : null);

/** Un lot de la salle : l'état reçu, l'heure de réception (décompte), et sa fin quand le serveur l'a close. */
interface Place {
  lot: Lot;
  recuA: number;
  absentDepuis: number | null;
  fin: (Cloture & { vueA: number }) | null;
}

function Palette({ num, moi, leve }: { num?: number | string; moi?: boolean; leve?: boolean }) {
  return (
    <span className={`ant-palette${moi ? ' moi' : ''}${leve ? ' leve' : ''}`} aria-hidden="true">
      <span className="rond">{num}</span>
      <span className="manche" />
    </span>
  );
}

const carteDe = (l: Lot) => <Carte genre="designee" numero={l.carte.numero} nom={l.carte.nom} rang={l.carte.rang} limite={l.carte.limite} texte={l.carte.texte} />;

export function Antokiba({
  partieId,
  moi,
  jenny,
  version,
  positionAction,
  annoncer,
  onRetour,
  retour,
  encheres,
}: {
  partieId: string;
  moi: string;
  jenny: number;
  version: number;
  positionAction: (envoyer?: boolean) => Promise<PositionInput>;
  annoncer: (texte: string, qui?: string) => void;
  onRetour: () => void;
  /** Visite à distance ouverte par Retour : temps restant. */
  retour: { resteMs: number; recuA: number } | null;
  encheres: { surPage: (oui: boolean) => void; noter: (l: Lot) => void; clotures: Cloture[] };
}) {
  const [salle, setSalle] = useState<Map<string, Place>>(new Map());
  const [lu, setLu] = useState(false);
  const [vu, setVu] = useState<string | null>(null);
  const [pas, setPas] = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const [qr, setQrEtat] = useState<string | null>(qrValide);
  const setQr = (code: string) => {
    qrGarde = { code, a: Date.now() };
    setQrEtat(code);
  };
  const [scan, setScan] = useState<string | null>(null);
  const [fiche, setFiche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bond, setBond] = useState(0);
  const [leve, setLeve] = useState(0);
  const [, setTic] = useState(0);
  const palettes = useRef<HTMLDivElement>(null);
  const salleRef = useRef(salle);
  salleRef.current = salle;
  const noter = useRef(encheres.noter);
  noter.current = encheres.noter;

  useEffect(() => {
    encheres.surPage(true);
    return () => encheres.surPage(false);
  }, []);

  /** Une palette surgit dans la salle à chaque offre ; le montant bondit. */
  const surgir = (pseudo: string, montant: number, deMoi: boolean) => {
    setBond((n) => n + 1);
    const boite = palettes.current;
    if (!boite || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const p = document.createElement('span');
    p.className = 'surgit';
    p.innerHTML = `<span class="ant-palette${deMoi ? ' moi' : ''}"><span class="rond"></span><span class="manche"></span></span><span class="qui"></span>`;
    p.querySelector('.rond')!.textContent = String(montant);
    p.querySelector('.qui')!.textContent = deMoi ? 'toi' : pseudo;
    p.style.left = `${deMoi ? boite.clientWidth - 80 : 20 + Math.random() * 40}px`;
    p.style.top = '34px';
    boite.append(p);
    p.animate([{ translate: '0 40px', rotate: '-14deg', opacity: 0 }, { translate: '0 0', rotate: '0deg', opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { translate: '0 -10px', opacity: 0 }], {
      duration: 1500,
      easing: 'cubic-bezier(.3,1.4,.5,1)',
    }).finished.finally(() => p.remove());
  };

  /** Range un lot reçu (lecture ou réponse à mon offre) dans la salle. */
  const ranger = (l: Lot, recuA: number) =>
    setSalle((s) => {
      const n = new Map(s);
      const avant = s.get(l.id);
      const lot = fusionnerLot(avant?.lot, l, moi);
      noter.current(lot);
      n.set(l.id, { lot, recuA, absentDepuis: null, fin: avant?.fin ?? null });
      return n;
    });

  const charger = () =>
    api.get<{ encheres: Lot[] }>(`/parties/${partieId}/encheres`).then(
      (r) => {
        setErreur(null);
        const maintenant = Date.now();
        const avant = salleRef.current;
        // Les offres des autres depuis la dernière lecture : leur palette surgit ; si je menais, ça vibre.
        for (const l of r.encheres) {
          const p = avant.get(l.id)?.lot;
          const o = l.meilleureOffre;
          if (p && o && o.montant !== p.meilleureOffre?.montant && o.joueurId !== moi) {
            if (l.id === (vu ?? r.encheres[0]?.id)) surgir(o.pseudo, o.montant, false);
            if (jeMene(p, moi)) vibrer([40, 40, 40]);
          }
        }
        setSalle((s) => {
          // Les lots gardent leur place ; un lot qui n'est plus ouvert attend sa fin (tampon), les nouveaux s'ajoutent.
          const recus = new Map(r.encheres.map((l) => [l.id, l]));
          const n = new Map<string, Place>();
          const placer = (l: Lot) => {
            const lot = fusionnerLot(s.get(l.id)?.lot, l, moi);
            noter.current(lot);
            n.set(l.id, { lot, recuA: maintenant, absentDepuis: null, fin: null });
          };
          for (const [id, p] of s) {
            const l = recus.get(id);
            if (l) placer(l);
            else n.set(id, { ...p, absentDepuis: p.absentDepuis ?? maintenant });
          }
          for (const l of r.encheres) if (!n.has(l.id)) placer(l);
          return n;
        });
        if (!lu) {
          // En arrivant : le lot où l'on a été dépassé d'abord.
          const depasse = r.encheres.find((l) => l.maOffre != null && !jeMene(l, moi));
          if (depasse) setVu(depasse.id);
          setLu(true);
        }
      },
      (x: unknown) => setErreur(message(x)),
    );
  useEffect(() => {
    void charger();
  }, [partieId, version]);

  // Fins de lots reçues par le temps réel : tampon ADJUGÉ / INVENDU sur le lot.
  useEffect(() => {
    setSalle((s) => {
      let change = false;
      const n = new Map(s);
      for (const c of encheres.clotures) {
        const p = n.get(c.id);
        if (p && !p.fin) {
          n.set(c.id, { ...p, fin: { ...c, vueA: Date.now() } });
          change = true;
        }
      }
      return change ? n : s;
    });
  }, [encheres.clotures]);

  // Décomptes ; les lots clos quittent la salle après leur tampon.
  useEffect(() => {
    const t = setInterval(() => {
      setTic((n) => n + 1);
      const maintenant = Date.now();
      setSalle((s) => {
        let change = false;
        const n = new Map(s);
        for (const [id, p] of s) {
          if ((p.fin && maintenant - p.fin.vueA > TAMPON_MS) || (!p.fin && p.absentDepuis !== null && maintenant - p.absentDepuis > ATTENTE_MS)) {
            n.delete(id);
            change = true;
          }
        }
        return change ? n : s;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!fiche) return;
    const clavier = (e: KeyboardEvent) => e.key === 'Escape' && setFiche(false);
    addEventListener('keydown', clavier);
    return () => removeEventListener('keydown', clavier);
  }, [fiche]);

  const places = [...salle.values()];
  const place = places.find((p) => p.lot.id === vu) ?? places[0] ?? null;
  const l = place?.lot ?? null;
  const fin = place?.fin ?? null;
  const reste = (p: Place) => (p.absentDepuis !== null ? 0 : Math.max(0, p.lot.resteMs - (Date.now() - p.recuA)));
  const resteMs = place ? reste(place) : 0;
  const retourMs = retour ? retour.resteMs - (Date.now() - retour.recuA) : 0;
  const enRetour = retourMs > 0;
  const present = qr !== null || enRetour;
  const bouton = l && !fin ? boutonPalette({ lot: l, moi, pas, jenny, present, envoi, resteMs }) : null;
  const mene = l ? jeMene(l, moi) : false;

  /** Inscription à un lot (QR scanné, ou visite à distance) ; renvoie le lot à jour. */
  const rejoindre = async (id: string, code: string | null) => {
    const r = await api.post<{ enchere: Lot }>(`/parties/${partieId}/encheres/${id}/rejoindre`, { ...(code ? { qr: code } : {}), position: await positionAction() });
    ranger(r.enchere, Date.now());
    return r.enchere;
  };

  const lever = async () => {
    if (!l || !bouton?.actif) return;
    if (bouton.qr) return setScan(l.id);
    setEnvoi(true);
    try {
      if (!l.inscrit) await rejoindre(l.id, qr);
      const r = await api.post<{ enchere: Lot }>(`/parties/${partieId}/encheres/${l.id}/offre`, { montant: bouton.montant });
      ranger(r.enchere, Date.now());
      vibrer(20);
      surgir('', bouton.montant, true);
      setLeve((n) => n + 1);
      setPas(1);
    } catch (x) {
      vibrer([60, 60, 60]);
      annoncer(`${message(x)}. Rien n’a été dépensé.`, 'Antokiba');
      void charger();
    } finally {
      setEnvoi(false);
    }
  };

  const qrLu = async (id: string, code: string) => {
    setScan(null);
    setEnvoi(true);
    try {
      await rejoindre(id, code);
      setQr(code);
      annoncer('Te voilà inscrit à l’enchère. Lève ta palette quand tu veux.', 'Antokiba');
    } catch (x) {
      vibrer([60, 60, 60]);
      annoncer(`${message(x)}.`, 'Antokiba');
    } finally {
      setEnvoi(false);
    }
  };

  const tampon = fin ? (fin.vendue ? ['ADJUGÉ', `${fin.joueurId === moi ? 'toi' : fin.pseudo} · ${fin.prix} J`] : ['INVENDU']) : null;

  return (
    <div className="masadora antokiba">
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
            <h1>ANTOKIBA</h1>
            <span>la ville des enchères</span>
          </div>
        </div>
        {enRetour && (
          <span className="distance" role="status">
            Visite à distance (Retour) · <b>{minSec(retourMs)}</b>
          </span>
        )}
      </div>

      {erreur && <p className="mas-erreur">{erreur}</p>}

      <section className={`ant-salle${fin ? ' lot-fini' : ''}`} aria-labelledby="ant-t-lot" aria-live="polite">
        {l ? (
          <>
            <div className="lot-tete">
              <h2 id="ant-t-lot">Lot en vente</h2>
              <span>
                lot {places.indexOf(place!) + 1} sur {places.length}
              </span>
            </div>
            <div className="scene-lot">
              <div className="pupitre">
                <span className="cone" aria-hidden="true" />
                <button className="lot" aria-label={`${l.carte.nom} : voir la carte en grand`} onClick={() => setFiche(true)}>
                  {carteDe(l)}
                </button>
                <span className="socle" aria-hidden="true">
                  ANTOKIBA
                </span>
                {tampon && (
                  <span key={l.id} className="tampon-lot frappe">
                    <Tampon mots={tampon} taille={19} />
                  </span>
                )}
              </div>
              <div className="offre">
                <span className="libelle">{fin ? (fin.vendue ? 'Adjugé' : 'Aucune offre') : l.meilleureOffre ? 'Meilleure offre' : 'Prix de départ'}</span>
                <span key={bond} className={`montant${bond ? ' bondit' : ''}`}>
                  {fin?.vendue ? fin.prix : (l.meilleureOffre?.montant ?? l.prixDepart)}
                  <small>J</small>
                </span>
                <span className="qui">
                  {fin ? (
                    fin.vendue ? (
                      <>
                        à <b>{fin.joueurId === moi ? 'toi' : fin.pseudo}</b>
                      </>
                    ) : (
                      'La carte retourne au stock du PNJ.'
                    )
                  ) : l.meilleureOffre ? (
                    <>
                      par <b>{mene ? 'toi' : l.meilleureOffre.pseudo}</b>
                    </>
                  ) : (
                    'Personne n’a encore levé sa palette.'
                  )}
                </span>
                {!fin && (
                  <span className={`decompte${resteMs <= 30_000 ? ' presse' : ''}`}>
                    {resteMs > 0 ? 'Fin dans' : 'Clôture'} <b>{minSec(resteMs)}</b>
                  </span>
                )}
              </div>
            </div>
            {!fin && l.maOffre != null && l.meilleureOffre && (
              <div className={`etat ${mene ? 'mene' : 'depasse'}`}>
                <Palette num={l.meilleureOffre.montant} moi={mene} leve={mene && leve > 0} key={leve} />
                <span>{mene ? 'Tu mènes. Si personne ne surenchérit, la carte est à toi.' : `${l.meilleureOffre.pseudo} a surenchéri : ${l.meilleureOffre.montant} J. À toi de jouer.`}</span>
              </div>
            )}
            {places.length > 1 && (
              <div className="lots">
                {places.map((p) => {
                  const e = p.fin ? { texte: p.fin.vendue ? 'adjugé' : 'invendu', genre: null } : etatVignette(p.lot, moi, reste(p));
                  return (
                    <button
                      key={p.lot.id}
                      className="vignette"
                      aria-pressed={p === place}
                      aria-label={`Lot ${places.indexOf(p) + 1} : ${p.lot.carte.nom}, ${e.texte}`}
                      onClick={() => {
                        setVu(p.lot.id);
                        setPas(1);
                      }}
                    >
                      {carteDe(p.lot)}
                      <span className={e.genre ?? undefined}>{e.texte}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          lu && (
            <div className="vide-salle">
              <p>Pas d’enchère en ce moment.</p>
              <small>Le commissaire-priseur annonce les lots sur place ; tu seras prévenu.</small>
            </div>
          )
        )}
        <div ref={palettes} className="salle-palettes" aria-hidden="true" />
      </section>

      {scan && (
        <section className="mas-case">
          <CameraQr lire={lireQrLieu} onLu={(code) => void qrLu(scan, code)} invalide="Ce QR n’est pas celui d’un lieu du jeu" saisie="Ou saisis le code d’Antokiba" />
          <button className="mas-secondaire" onClick={() => setScan(null)}>
            Fermer l’appareil photo
          </button>
        </section>
      )}

      {l && bouton && (
        <section className="mas-case ant-encherir" aria-labelledby="ant-t-palette">
          <h2 id="ant-t-palette">Ta palette</h2>
          <div className="ligne">
            {l.meilleureOffre && !bouton.qr && (
              <span className="pas" role="group" aria-label="Au-dessus de la meilleure offre">
                {[1, 5, 10].map((p) => (
                  <button key={p} aria-pressed={pas === p} onClick={() => setPas(p)}>
                    +{p}
                  </button>
                ))}
              </span>
            )}
            <span className="limite">
              Tu as <b>{jenny} J</b>
            </span>
          </div>
          <button className={`lever${bouton.qr ? ' qr' : ''}${envoi ? ' envoi' : ''}`} disabled={!bouton.actif || scan !== null} onClick={() => void lever()}>
            {bouton.actif && !bouton.qr && <Palette moi />}
            <span>{bouton.texte}</span>
          </button>
          <p className="regle">Seul le gagnant paie, à la fin. Si ses jenny ne suffisent plus, l’offre précédente d’un autre joueur l’emporte.</p>
        </section>
      )}

      {fiche && l && (
        <div className="ant-fiche" role="dialog" aria-modal="true" aria-label={l.carte.nom} onClick={() => setFiche(false)}>
          <div className="f-boite">
            {carteDe(l)}
            <p>Touche pour fermer</p>
          </div>
        </div>
      )}
    </div>
  );
}
