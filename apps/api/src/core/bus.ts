// Bus de diffusion (P5) : les actions publient après commit ; Socket.IO (2.7) relaie vers les rooms.

/** Destinataires, d'après la matrice « Diffusion temps réel » de REGLES.md. */
export type Audience =
  | { type: 'joueur'; id: string }
  | { type: 'joueurs' }
  | { type: 'staff' }
  | { type: 'gm' }
  | { type: 'tracker' };

export interface Emission {
  partieId: string;
  a: Audience;
  evenement: string;
  data: unknown;
}

export type Listener = (e: Emission) => void;

export class Bus {
  private listeners = new Set<Listener>();

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  publish(e: Emission): void {
    for (const l of this.listeners) l(e);
  }
}
