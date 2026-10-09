import { randomBytes, randomUUID } from 'node:crypto';

export const newId = (): string => randomUUID();

/** RG-6.1 : id de balise non devinable, imprimé dans le QR (96 bits, base64url). */
export const newBeaconId = (): string => randomBytes(12).toString('base64url');

/** Secret aléatoire (licence QR, codes d'accès). */
export const newSecret = (bytes = 32): string => randomBytes(bytes).toString('base64url');
