import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { ALPHABET_CODE_PARTIE } from '@gq/shared';

export const newId = (): string => randomUUID();

/** Identifiant d'une partie = code court à taper ou à dicter (6 caractères, environ 1 milliard de codes). */
export const newCodePartie = (): string => Array.from({ length: 6 }, () => ALPHABET_CODE_PARTIE[randomInt(ALPHABET_CODE_PARTIE.length)]).join('');

/** RG-6.1 : id de balise non devinable, imprimé dans le QR (96 bits, base64url). */
export const newBeaconId = (): string => randomBytes(12).toString('base64url');

/** Secret aléatoire (licence QR, codes d'accès). */
export const newSecret = (bytes = 32): string => randomBytes(bytes).toString('base64url');
