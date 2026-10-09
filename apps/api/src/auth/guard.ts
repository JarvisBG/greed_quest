// Contrôle des rôles (RG-3). Le GM a tous les droits du PNJ.
import type { FastifyRequest } from 'fastify';
import { interdit, nonAuthentifie } from '../errors.js';
import type { Role, Session } from './tokens.js';

export function requireRole(req: FastifyRequest, partieId: string, ...roles: Role[]): Session {
  const s = req.session;
  if (!s) throw nonAuthentifie();
  if (s.partieId !== partieId || !roles.includes(s.role)) throw interdit();
  return s;
}

export const STAFF: Role[] = ['pnj', 'gm'];
