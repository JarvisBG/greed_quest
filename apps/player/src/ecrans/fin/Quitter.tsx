// Page ⑱ : « Quitter la partie » (RG-5.7), ouvert depuis le bas de la licence. La fiche dit ce qu'on perd (plus aucune
// action ; ta SS retourne sur l'île, RG-8.12) et ce qu'on garde (tu restes classé, RG-13), puis l'abandon se confirme
// en maintenant le bouton 2 s : l'encre rouge monte ; lâcher trop tôt l'explique. Le refus du serveur s'affiche en clair.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/client';
import { contenu, type LivreRecu } from '../../lib/livre';

const MAINTIEN_MS = 2000;
const vibrer = (p: number | number[]) => navigator.vibrate?.(p);

const IconeNon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const IconeRetourIle = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
  </svg>
);
const IconeOui = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export function Quitter({ partieId, abandonner, onFermer }: { partieId: string; abandonner: () => Promise<void>; onFermer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const appuiFond = useRef(false);
  const [ss, setSs] = useState(false);
  const [aide, setAide] = useState('Garde le doigt appuyé 2 secondes.');
  const [refus, setRefus] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const encours = useRef<{ a: Animation[]; t: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    ref.current?.showModal();
    // Une SS dans le Book : elle retournera sur l'île (RG-8.12).
    api.get<LivreRecu>(`/parties/${partieId}/livre`).then(
      (l) => setSs(contenu(l).some((e) => e.kind === 'carte' && e.rang === 'SS')),
      () => undefined,
    );
  }, [partieId]);

  const fermer = () => ref.current?.close();

  const confirmer = async () => {
    setEnvoi(true);
    setRefus(null);
    try {
      await abandonner();
      fermer();
    } catch (e) {
      setRefus(e instanceof Error ? e.message : String(e));
      setAide('Garde le doigt appuyé 2 secondes.');
    } finally {
      setEnvoi(false);
    }
  };

  const debut = () => {
    if (encours.current || envoi || !bouton.current) return;
    vibrer(15);
    const rem = bouton.current.querySelector('.remplir');
    const sur = bouton.current.querySelector('.lib.sur');
    const o = { duration: MAINTIEN_MS, easing: 'linear', fill: 'forwards' as const };
    const a = [rem?.animate([{ scale: '0 1' }, { scale: '1 1' }], o), sur?.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], o)].filter(
      (x): x is Animation => x !== undefined,
    );
    const t = setTimeout(() => {
      encours.current = null;
      vibrer([40, 30, 90]);
      setAide('Un instant…');
      void confirmer();
    }, MAINTIEN_MS);
    encours.current = { a, t };
  };
  const stop = () => {
    const e = encours.current;
    if (!e) return;
    clearTimeout(e.t);
    e.a.forEach((x) => x.cancel());
    encours.current = null;
    setAide('Pas encore : garde le doigt appuyé jusqu’au bout.');
  };

  return (
    <dialog
      className="fiche"
      ref={ref}
      aria-labelledby="fp-quitter-titre"
      onClose={onFermer}
      onPointerDown={(e) => {
        appuiFond.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && appuiFond.current) fermer();
        appuiFond.current = false;
      }}
    >
      <div className="fiche-corps fp-quitter">
        <h2 className="gros" id="fp-quitter-titre">
          Quitter la partie ?
        </h2>
        <ul className="fp-pertes">
          <li className="perd">
            <IconeNon />
            <span>
              <b>Plus aucune action</b> jusqu’à la fin : ni scan, ni sort, ni échange, ni achat.
            </span>
          </li>
          {ss && (
            <li className="perd">
              <IconeRetourIle />
              <span>
                <b>Ta carte SS retourne sur l’île</b> : elle réapparaîtra pour les autres.
              </span>
            </li>
          )}
          <li className="garde">
            <IconeOui />
            <span>
              <b>Tu restes classé</b> avec les cartes de ton Book, et tu suis la partie jusqu’au classement final.
            </span>
          </li>
        </ul>
        <p className="doux">C’est définitif : tu ne pourras pas revenir dans cette partie.</p>
        {refus && (
          <p className="erreur" role="alert">
            {refus}
          </p>
        )}
        <div className="actions">
          <button className="gi-btn-encre" onClick={fermer}>
            Je continue à jouer
          </button>
          <button
            ref={bouton}
            className="fp-maintien"
            aria-describedby="fp-maintien-aide"
            disabled={envoi}
            onPointerDown={(e) => {
              if (e.button > 0) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              debut();
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onPointerLeave={stop}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                e.preventDefault();
                debut();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === 'Enter' || e.key === ' ') stop();
            }}
          >
            <i className="remplir" />
            <span className="lib">Maintiens pour abandonner</span>
            <span className="lib sur" aria-hidden="true">
              Maintiens pour abandonner
            </span>
          </button>
          <p className="fp-maintien-aide" id="fp-maintien-aide" aria-live="polite">
            {aide}
          </p>
        </div>
      </div>
    </dialog>
  );
}
