import type { FastifyReply } from 'fastify';

/** Résultat d'action : un refus (`ok: false`) est renvoyé en 409 avec son motif en clair (RG-7.4). */
export function send<T extends { ok: boolean }>(reply: FastifyReply, r: T): T {
  if (!r.ok) reply.status(409);
  return r;
}

export const refus = <C extends string>(code: C, message: string) => ({ ok: false as const, code, message });
