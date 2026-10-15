import { Annonce } from '@gq/ui';
import { useEffect, useRef, useState } from 'react';
import { Accueil, useEvenements, type SousEcran } from './ecrans/Accueil';
import { Chrono } from './ecrans/Chrono';
import { Echanges } from './ecrans/echanges/Echanges';
import { SessionEchange } from './ecrans/echanges/SessionEchange';
import { Trade } from './ecrans/echanges/Trade';
import { Entree } from './ecrans/Entree';
import { Examen } from './ecrans/Examen';
import { IconeAccueil, IconeBook, IconeEchanges, IconeScanner, IconeSorts } from './ecrans/Icones';
import { Inscription, type Kit as KitRecu } from './ecrans/Inscription';
import { Kit } from './ecrans/Kit';
import { Book } from './ecrans/book/Book';
import { BandeauClear } from './ecrans/clear/BandeauClear';
import { CineClear } from './ecrans/clear/CineClear';
import { Lots } from './ecrans/clear/Lots';
import { CineFin } from './ecrans/fin/CineFin';
import { Classement } from './ecrans/fin/Classement';
import { Quitter } from './ecrans/fin/Quitter';
import { BandeauSpectateur, Spectateur } from './ecrans/fin/Spectateur';
import { Licence } from './ecrans/licence/Licence';
import { Masadora } from './ecrans/masadora/Masadora';
import { Adjuge } from './ecrans/antokiba/Adjuge';
import { Antokiba } from './ecrans/antokiba/Antokiba';
import { Arene, BandeauCombat } from './ecrans/arene/Arene';
import { Defaite } from './ecrans/arene/Defaite';
import { Victoire } from './ecrans/arene/Victoire';
import { Nen } from './ecrans/Nen';
import { Alarme } from './ecrans/raid/Alarme';
import { Fuite } from './ecrans/raid/Fuite';
import { BandeauRaid, Raid } from './ecrans/raid/Raid';
import { Victoire as VictoireRaid } from './ecrans/raid/Victoire';
import { Scan } from './ecrans/scan/Scan';
import { Tirage, useTirages } from './ecrans/scan/Tirage';
import { BandeauGel, styleGivre, useGel } from './ecrans/sorts/BandeauGel';
import { BandeauZetsu } from './ecrans/sorts/BandeauZetsu';
import { PieceFortune } from './ecrans/sorts/CaseNen';
import { minSec } from './ecrans/sorts/FicheSort';
import { SortRecu } from './ecrans/sorts/SortRecu';
import { Sorts } from './ecrans/sorts/Sorts';
import { api, session } from './lib/client';
import { creerEveil, eveilDisponible, preferenceEveil } from './lib/eveil';
import { baliseDepuisUrl } from './lib/qr';
import { bossDe } from './lib/raid';
import type { Question } from './lib/quiz';
import { etapesDuTirage } from './lib/tirage';
import { texteFerme } from './lib/fin';
import { useJeu, type Moi } from './lib/useJeu';

/** Amendement 2026-10-10 : visite à distance (sort Retour) encore ouverte pour cette ville. */
const retourActif = (m: Moi, ville: 'masadora' | 'antokiba') => m.retour?.ville === ville && m.retour.resteMs - (Date.now() - m.recuA) > 0;

interface Questionnaires {
  examen: Question[];
  nen: Question[];
  /** RG-5.4 : question secrète de Wing pour le Spécialiste. */
  specialisation: Question;
}

type Onglet = 'accueil' | 'scan' | 'livre' | 'sorts' | 'echanges';
/** Page ⑱ : onglets d'action, barrés après la fin de partie ou l'abandon. */
const ACTIONS = new Set<Onglet>(['scan', 'sorts', 'echanges']);
const ONGLETS: { id: Onglet; nom: string; icone: () => React.JSX.Element }[] = [
  { id: 'accueil', nom: 'Accueil', icone: IconeAccueil },
  { id: 'scan', nom: 'Scanner', icone: IconeScanner },
  { id: 'livre', nom: 'Book', icone: IconeBook },
  { id: 'sorts', nom: 'Sorts', icone: IconeSorts },
  { id: 'echanges', nom: 'Échanges', icone: IconeEchanges },
];

export function App() {
  const jeu = useJeu();
  const [kit, setKit] = useState<KitRecu | null>(null);
  const [quiz, setQuiz] = useState<Questionnaires | null>(null);
  const [examenOuvert, setExamenOuvert] = useState(false);
  const [, majReport] = useState(0);
  const [onglet, setOnglet] = useState<Onglet>('accueil');
  /** Écran ouvert depuis l'accueil (licence, lieux, raid). */
  const [sous, setSous] = useState<SousEcran | null>(null);
  /** Page ⑮ : la licence ouverte depuis l'arène y ramène. */
  const retourLicence = useRef<SousEcran | null>(null);
  const lus = useEvenements(jeu.partieId ?? '', jeu.version);
  // Page ⑯ : la case du raid à l'accueil suit la barre de vie en direct.
  const raidVue = jeu.raid.vue;
  const evenements = raidVue ? { ...lus, liste: lus.liste.map((e) => (e.id === raidVue.id ? { ...e, pv: raidVue.pv, pvMax: raidVue.pvMax } : e)) } : lus;
  /** Cinématiques du tirage (page ⑥), jouées une à une par-dessus l'app. */
  const tirages = useTirages();
  /** Page ⑫ : la table scellée laisse place à la cinématique « TRADE ! », puis disparaît sous sa nuit. */
  const [trade, setTrade] = useState(false);
  const [tableCachee, setTableCachee] = useState(false);
  /** Page ⑱ : fiche « Quitter la partie » ouverte ; le gagnant du Clear passe de ses lots au classement final. */
  const [quitter, setQuitter] = useState(false);
  const [voirClassement, setVoirClassement] = useState(false);
  // RG-7.5 : chaque tirage rejoué au retour du réseau a sa cinématique ; le solde suit à la fin.
  useEffect(() => {
    const r = jeu.rejoues[0];
    if (!r) return;
    jeu.prendreRejoue();
    void tirages.jouer(etapesDuTirage(r.gains), { secondSouffle: r.secondSouffle, surJenny: jeu.ajouterJenny }).then(() => jeu.majJenny(r.jenny));
  }, [jeu.rejoues]);
  // Balise scannée avec l'appareil photo du téléphone : l'app s'ouvre sur `?balise=<id>`.
  const [baliseLien, setBaliseLien] = useState<string | null>(() => baliseDepuisUrl(location.search));
  // Option « garder l'écran allumé » (facultative, consomme de la batterie).
  const eveil = useRef<ReturnType<typeof creerEveil> | null>(null);
  const [ecranAllume, setEcranAllume] = useState(preferenceEveil);
  useEffect(() => {
    if (jeu.phase !== 'en_jeu' || !eveilDisponible()) return;
    const e = creerEveil();
    e.demarrer();
    eveil.current = e;
    return () => e.arreter();
  }, [jeu.phase]);

  useEffect(() => {
    if (!jeu.partieId || quiz) return;
    api.get<Questionnaires>(`/parties/${jeu.partieId}/questionnaires`).then(setQuiz, () => undefined);
  }, [jeu.partieId, quiz]);

  const moi = jeu.moi;
  const partie = jeu.partie;
  const clear = jeu.clear.etat;
  /** Page ⑪ : gel subi (Gel, Accompagnement), pour le bandeau, l'onglet Scanner givré et la cinématique. */
  const gel = useGel(moi);
  const moiRef = useRef(moi);
  moiRef.current = moi;
  // Parcours d'arrivée : kit → Examen (RG-5.3, peut attendre) → test de Nen (RG-5.4) → accueil.
  let ecran: 'kit' | 'examen' | 'nen' | 'accueil' = 'accueil';
  if (jeu.phase === 'en_jeu' && moi) {
    if (kit) ecran = 'kit';
    else if (!moi.examenFait && (examenOuvert || !session.examenReporte(moi.id))) ecran = 'examen';
    // Un Spécialiste sans pouvoir (page rechargée avant la question secrète) y revient.
    else if (moi.nen === null || (moi.nen === 'specialisation' && moi.pouvoirSpe === null)) ecran = 'nen';
  }
  useEffect(() => {
    if (ecran !== 'accueil' || !baliseLien) return;
    setOnglet('scan');
    const u = new URL(location.href);
    u.searchParams.delete('balise');
    history.replaceState(null, '', u);
  }, [ecran, baliseLien]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [onglet, sous, ecran]);

  const finEtape = () => {
    setExamenOuvert(false);
    void jeu.rafraichir();
  };
  const enJeu = jeu.phase === 'en_jeu' && partie && moi;
  /** Page ⑱ : partie terminée (RG-4.6) ou joueur parti (abandon, RG-5.7) : plus d'action, seulement suivre. */
  const termine = partie?.etat === 'terminee';
  const spectateur = moi?.statut === 'abandon';
  const classement = jeu.fin.classement;

  return (
    <div className="app">
      {jeu.phase !== 'sans_partie' && (
      <header className="barre">
        {enJeu ? (
          <>
            <Chrono partie={partie} recueA={jeu.partieRecueA} />
            <span className="liaison">
              <i className={`gi-pastille ${jeu.connexion}`} aria-hidden="true" />
              {jeu.connexion === 'en_ligne' ? 'En ligne' : jeu.connexion === 'connexion' ? 'Connexion…' : 'Hors ligne'}
            </span>
            <span className="jenny" aria-label={`${moi.jenny} jenny`}>
              {moi.jenny}
              <small>J</small>
            </span>
          </>
        ) : (
          <span className="marque">Greed Island</span>
        )}
      </header>
      )}
      {enJeu && ecran === 'accueil' && spectateur && !termine && <BandeauSpectateur />}
      {enJeu && ecran === 'accueil' && <BandeauZetsu moi={moi} />}
      {enJeu && ecran === 'accueil' && <BandeauGel moi={moi} par={jeu.gelePar} />}
      {/* Page ⑰ : Clear déclaré, en attente du Game Master, sur toutes les pages sauf la licence. */}
      {enJeu && ecran === 'accueil' && clear.etat === 'declare' && !(onglet === 'accueil' && sous === 'licence') && (
        <BandeauClear
          onLicence={() => {
            setOnglet('accueil');
            setSous('licence');
          }}
        />
      )}
      {/* Page ⑮ : combat en cours à l'arène, sur toutes les pages sauf l'arène elle-même. */}
      {enJeu && ecran === 'accueil' && !(onglet === 'accueil' && sous === 'arene') && (
        <BandeauCombat
          etat={jeu.arene.etat}
          onOuvrir={() => {
            setOnglet('accueil');
            setSous('arene');
          }}
        />
      )}

      {/* Page ⑯ : raid en cours, sur toutes les pages sauf le combat lui-même. */}
      {enJeu && ecran === 'accueil' && !(onglet === 'accueil' && sous === 'raid') && (
        <BandeauRaid
          vue={jeu.raid.vue}
          onOuvrir={() => {
            setOnglet('accueil');
            setSous('raid');
          }}
        />
      )}

      {jeu.alerte && (
        <Annonce
          cle={jeu.alerte.n}
          genre={jeu.alerte.genre}
          qui={jeu.alerte.qui}
          texte={jeu.alerte.texte}
          onFermer={jeu.fermerAlerte}
          {...(jeu.alerte.duree ? { dureeMs: jeu.alerte.duree } : {})}
          {...(jeu.alerte.voir
            ? {
                action: (
                  <button
                    onClick={() => {
                      if (jeu.alerte?.voir === 'antokiba') {
                        setOnglet('accueil');
                        setSous('encheres');
                      } else setOnglet('echanges');
                      jeu.fermerAlerte();
                    }}
                  >
                    Voir
                  </button>
                ),
              }
            : {})}
        />
      )}

      <main>
        {jeu.phase === 'sans_partie' && <Entree onChoix={jeu.choisirPartie} />}
        {jeu.phase === 'chargement' && (
          <div className="planche">
            <p className="doux">Chargement…</p>
          </div>
        )}
        {jeu.phase === 'erreur' && (
          <div className="planche">
            <section className="gi-case">
              <p className="erreur">{jeu.erreur}</p>
              <button className="gi-btn-encre" onClick={() => void jeu.rafraichir()}>
                Réessayer
              </button>
              <button className="gi-lien" onClick={jeu.quitterPartie}>
                Rejoindre une autre partie
              </button>
            </section>
          </div>
        )}
        {jeu.phase === 'non_inscrit' && partie && (
          <Inscription
            partie={partie}
            onAutrePartie={jeu.quitterPartie}
            onInscrit={(s, k) => {
              setKit(k);
              jeu.ouvrirSession(s);
            }}
          />
        )}
        {enJeu && (
          <>
            {ecran === 'kit' && kit && <Kit kit={kit} onSuite={() => setKit(null)} />}
            {ecran === 'examen' && quiz && (
              <Examen
                partieId={partie.id}
                questions={quiz.examen}
                onBonus={(bonus) => jeu.majJenny(moi.jenny + bonus)}
                onReporter={() => {
                  session.reporterExamen(moi.id);
                  setExamenOuvert(false);
                  majReport((n) => n + 1);
                }}
                onFini={finEtape}
              />
            )}
            {ecran === 'nen' && quiz && <Nen partieId={partie.id} nenConnu={moi.nen} questions={quiz.nen} secrete={quiz.specialisation} onFini={finEtape} />}
            {(ecran === 'examen' || ecran === 'nen') && !quiz && (
              <div className="planche">
                <p className="doux">Chargement…</p>
              </div>
            )}
            {ecran === 'accueil' && onglet === 'scan' && (
              <Scan
                partieId={partie.id}
                scannerBalise={jeu.scannerBalise}
                enFile={jeu.enFile}
                gpsErreur={jeu.gpsErreur}
                baliseInitiale={baliseLien}
                jouerTirage={tirages.jouer}
                majJenny={jeu.majJenny}
                ajouterJenny={jeu.ajouterJenny}
                key={baliseLien ?? 'camera'}
              />
            )}
            {ecran === 'accueil' && onglet === 'livre' && (
              <Book
                partieId={partie.id}
                version={jeu.version}
                apresAction={jeu.apresAction}
                positionAction={jeu.positionAction}
                onSorts={() => setOnglet('sorts')}
                onClearDeclare={jeu.clear.declare}
              />
            )}
            {ecran === 'accueil' && onglet === 'sorts' && (
              <Sorts
                partieId={partie.id}
                moi={moi}
                version={jeu.version}
                positionAction={jeu.positionAction}
                apresAction={jeu.apresAction}
                suiviCible={jeu.suiviCible}
                ouvrirSuivi={jeu.ouvrirSuivi}
                positionCarte={jeu.positionCarte}
                onVille={(v) => {
                  setOnglet('accueil');
                  setSous(v === 'masadora' ? 'boutique' : 'encheres');
                }}
              />
            )}
            {ecran === 'accueil' && onglet === 'echanges' && (
              <Echanges partieId={partie.id} version={jeu.version} echange={jeu.echange} recevoir={jeu.recevoirEchange} positionAction={jeu.positionAction} />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'licence' && jeu.licenceSecret && (
              <Licence
                partieId={partie.id}
                joueurId={moi.id}
                pseudo={moi.pseudo}
                nen={moi.nen}
                secret={jeu.licenceSecret}
                sortie={spectateur ? 'abandon' : termine ? 'terminee' : null}
                onQuitter={() => setQuitter(true)}
                onRetour={() => {
                  setSous(retourLicence.current);
                  retourLicence.current = null;
                }}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'arene' && (
              <Arene
                etat={jeu.arene.etat}
                jenny={moi.jenny}
                recharger={() => void jeu.arene.recharger()}
                onLicence={() => {
                  retourLicence.current = 'arene';
                  setSous('licence');
                }}
                onRetour={() => setSous(null)}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'boutique' && (
              <Masadora
                partieId={partie.id}
                jenny={moi.jenny}
                version={jeu.version}
                positionAction={jeu.positionAction}
                apresAction={jeu.apresAction}
                majJenny={jeu.majJenny}
                annoncer={jeu.annoncer}
                onRetour={() => setSous(null)}
                retour={retourActif(moi, 'masadora') && moi.retour ? { resteMs: moi.retour.resteMs, recuA: moi.recuA } : null}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'encheres' && (
              <Antokiba
                partieId={partie.id}
                moi={moi.id}
                jenny={moi.jenny}
                version={jeu.version}
                positionAction={jeu.positionAction}
                annoncer={jeu.annoncer}
                onRetour={() => setSous(null)}
                retour={retourActif(moi, 'antokiba') && moi.retour ? { resteMs: moi.retour.resteMs, recuA: moi.recuA } : null}
                encheres={jeu.encheres}
              />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === 'raid' && (
              <Raid
                vue={jeu.raid.vue}
                questions={jeu.raid.questions}
                coupAutre={jeu.raid.coupAutre}
                repondre={jeu.raid.repondre}
                charger={() => void jeu.raid.charger()}
                onRetour={() => setSous(null)}
              />
            )}
            {/* Page ⑰ : le gagnant choisit ses 3 lots, puis garde le récapitulatif à montrer à l'organisateur. */}
            {ecran === 'accueil' && onglet === 'accueil' && sous === null && clear.etat === 'gagne' && !(classement && voirClassement) && (
              <Lots etat={clear} partieNom={partie.nom} choisir={jeu.clear.choisirLots} {...(classement && termine ? { onClassement: () => setVoirClassement(true) } : {})} />
            )}
            {/* Page ⑱ : la partie terminée, l'accueil devient le classement final. */}
            {ecran === 'accueil' && onglet === 'accueil' && sous === null && termine && classement && (clear.etat !== 'gagne' || voirClassement) && (
              <Classement c={classement} {...(clear.etat === 'gagne' ? { onLots: () => setVoirClassement(false) } : {})} />
            )}
            {/* Page ⑱ : après l'abandon, l'accueil du spectateur (Book figé, annonces). */}
            {ecran === 'accueil' && onglet === 'accueil' && sous === null && clear.etat !== 'gagne' && !(termine && classement) && spectateur && (
              <Spectateur partieId={partie.id} version={jeu.version} jenny={moi.jenny} notifs={jeu.notifs} onBook={() => setOnglet('livre')} />
            )}
            {ecran === 'accueil' && onglet === 'accueil' && sous === null && clear.etat !== 'gagne' && !(termine && classement) && !spectateur && (
              <Accueil
                partie={partie}
                moi={moi}
                version={jeu.version}
                evenements={evenements}
                notifs={jeu.notifs}
                ecranAllume={ecranAllume}
                onEcranAllume={(oui) => {
                  setEcranAllume(oui);
                  void eveil.current?.regler(oui);
                }}
                onExamen={() => setExamenOuvert(true)}
                onOuvrir={setSous}
                pastilleAntokiba={jeu.encheres.pastille}
                onBook={() => setOnglet('livre')}
                position={jeu.positionCarte()}
              />
            )}
          </>
        )}
      </main>

      {jeu.phase === 'en_jeu' && ecran === 'accueil' && (
        <nav className="onglets" aria-label="Navigation">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              data-onglet={o.id}
              aria-current={onglet === o.id ? 'page' : undefined}
              className={ACTIONS.has(o.id) && (termine || spectateur) ? 'ferme' : o.id === 'scan' && gel > 0 ? 'gele' : undefined}
              style={o.id === 'scan' && gel > 0 && !termine && !spectateur ? styleGivre : undefined}
              onClick={() => {
                // Page ⑱ : après la fin ou l'abandon, les onglets d'action sont barrés ; le refus est dit en clair.
                if (ACTIONS.has(o.id) && (termine || spectateur)) return jeu.annoncer(texteFerme(termine));
                // Page ⑪ : gelé, le Scanner reste fermé ; le refus est dit en clair.
                if (o.id === 'scan' && gel > 0) return jeu.annoncer(`Tu es gelé : plus de scan pendant encore ${minSec(gel)}.`);
                if (o.id === 'scan') setBaliseLien(null);
                if (o.id === 'accueil') setSous(null);
                setOnglet(o.id);
              }}
            >
              <o.icone />
              {o.nom}
              {o.id === 'echanges' && jeu.echange && <span className="point" aria-label="échange en cours" />}
              {o.id === 'scan' && gel > 0 && <span className="gel-t" aria-label={`gelé encore ${minSec(gel)}`}>{minSec(gel)}</span>}
              {o.id === 'scan' && moi?.specialisation.fortuneArmee && (
                <span className="onglet-fortune" role="img" aria-label="Fortune armée : un gain de plus">
                  <PieceFortune plus />
                </span>
              )}
            </button>
          ))}
        </nav>
      )}
      {/* Page ⑫ : proposition reçue (appel), attente, table, où que soit le joueur dans l'app ; puis « TRADE ! ». */}
      {enJeu && ecran === 'accueil' && (
        <SessionEchange
          partieId={partie.id}
          jenny={moi.jenny}
          version={jeu.version}
          echange={jeu.echange}
          conclu={jeu.echangeConclu}
          tableCachee={tableCachee}
          recevoir={jeu.recevoirEchange}
          finParMoi={jeu.finParMoi}
          onScelle={() => setTrade(true)}
        />
      )}
      {trade && jeu.echangeConclu && (
        <Trade
          key={jeu.echangeConclu.id}
          echange={jeu.echangeConclu}
          onNuit={() => setTableCachee(true)}
          onFini={() => {
            setTrade(false);
            setTableCachee(false);
            jeu.finEchangeConclu();
          }}
        />
      )}
      {/* Page ⑭ : enchère gagnée, où que soit le joueur dans l'app (après un tirage en cours). */}
      {!tirages.courant && jeu.encheres.adjuge && (
        <Adjuge
          key={jeu.encheres.adjuge.id}
          adjuge={jeu.encheres.adjuge}
          onDebit={jeu.majJenny}
          onFini={() => {
            jeu.encheres.finAdjuge();
            jeu.apresAction();
          }}
        />
      )}
      {/* Page ⑮ : verdict de l'arène, où que soit le joueur (après un tirage en cours). */}
      {!tirages.courant && jeu.arene.issue?.etat === 'gagnee' && (
        <Victoire
          key={jeu.arene.issue.id}
          issue={jeu.arene.issue}
          onFini={() => {
            jeu.arene.finIssue();
            jeu.apresAction();
          }}
        />
      )}
      {!tirages.courant && jeu.arene.issue?.etat === 'perdue' && <Defaite key={jeu.arene.issue.id} issue={jeu.arene.issue} onFini={jeu.arene.finIssue} />}
      {/* Page ⑯ : alarme du raid, puis victoire (paquet de 3 sorts) ou fuite, où que soit le joueur. */}
      {enJeu && ecran === 'accueil' && !tirages.courant && jeu.raid.alarme && (
        <Alarme
          key={jeu.raid.alarme.id}
          boss={bossDe(jeu.raid.vue?.bossId)}
          vue={jeu.raid.vue}
          onCombat={() => {
            jeu.raid.finAlarme();
            setOnglet('accueil');
            setSous('raid');
          }}
          onPlusTard={jeu.raid.finAlarme}
        />
      )}
      {!tirages.courant && jeu.raid.issue?.type === 'victoire' && (
        <VictoireRaid
          key={jeu.raid.issue.id}
          issue={jeu.raid.issue}
          onFini={() => {
            jeu.raid.finIssue();
            jeu.apresAction();
          }}
        />
      )}
      {!tirages.courant && jeu.raid.issue?.type === 'fuite' && <Fuite key={jeu.raid.issue.id} issue={jeu.raid.issue} onFini={jeu.raid.finIssue} />}
      {/* Page ⑰ : sceau du Clear déclaré, refus du GM, Book en gloire, annonce aux autres joueurs. */}
      {enJeu && !tirages.courant && jeu.clear.cine && (
        <CineClear
          key={jeu.clear.cineN}
          cine={jeu.clear.cine}
          pseudo={moi.pseudo}
          cartes={clear.etat === 'gagne' ? clear.lots : []}
          onFini={() => {
            // Après le Book en gloire : le choix des lots (à l'accueil).
            if (jeu.clear.cine?.type === 'gloire') {
              setOnglet('accueil');
              setSous(null);
            }
            jeu.clear.finCine();
          }}
        />
      )}
      {/* Page ⑱ : fin de partie (gong et podium) après l'annonce du Clear, ou abandon (licence rayée). */}
      {enJeu && !tirages.courant && !jeu.clear.cine && jeu.fin.cine && (
        <CineFin
          key={jeu.fin.cineN}
          cine={jeu.fin.cine}
          classement={classement}
          pseudo={moi.pseudo}
          onFini={() => {
            setOnglet('accueil');
            setSous(null);
            jeu.fin.finCine();
          }}
        />
      )}
      {enJeu && quitter && (
        <Quitter
          partieId={partie.id}
          abandonner={async () => {
            await jeu.fin.abandonner();
            void jeu.rafraichir();
          }}
          onFermer={() => setQuitter(false)}
        />
      )}
      {tirages.courant && <Tirage key={tirages.courant.id} demande={tirages.courant} onFini={tirages.terminer} />}
      {/* Page ⑪ : sorts reçus qui frappent, un par un, après un tirage en cours. */}
      {!tirages.courant && jeu.sortRecu && jeu.partieId && (
        <SortRecu
          key={`${jeu.sortRecu.n ?? ''}-${jeu.sortRecu.sort}-${jeu.sortRecu.heureJeu ?? ''}`}
          recu={jeu.sortRecu}
          partieId={jeu.partieId}
          geleMs={() => {
            const m = moiRef.current;
            return m ? Math.max(m.delais.gel, m.accompagne) - (Date.now() - m.recuA) : 0;
          }}
          onFini={jeu.finSortRecu}
        />
      )}
    </div>
  );
}
