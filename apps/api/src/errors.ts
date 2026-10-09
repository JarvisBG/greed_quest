// Refus renvoyés aux clients : `{ ok: false, code, message }`, message en clair et en français (RG-7.4).

export class Refus extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}

export const nonAuthentifie = () => new Refus('non_authentifie', 'Connexion requise', 401);
export const interdit = () => new Refus('interdit', 'Action réservée à un autre rôle', 403);
export const introuvable = (quoi: string) => new Refus('introuvable', `${quoi} introuvable`, 404);
