import { describe, expect, it } from 'vitest';
import { baliseDepuisUrl, lireQrBalise } from './qr';

describe('QR de balise (RG-6.1)', () => {
  it('identifiant brut', () => {
    expect(lireQrBalise('  aZ3_-x9QpL0k  ')).toBe('aZ3_-x9QpL0k');
  });
  it('lien vers l’app avec ?balise=', () => {
    expect(lireQrBalise('https://jeu.example/?partie=p1&balise=aZ3_-x9QpL0k')).toBe('aZ3_-x9QpL0k');
    expect(baliseDepuisUrl('?partie=p1&balise=aZ3_-x9QpL0k')).toBe('aZ3_-x9QpL0k');
  });
  it('rejette ce qui n’est pas une balise', () => {
    expect(lireQrBalise('Bonjour tout le monde')).toBeNull();
    expect(lireQrBalise('https://exemple.fr/page')).toBeNull();
    expect(lireQrBalise('abc')).toBeNull();
    expect(baliseDepuisUrl('?partie=p1')).toBeNull();
  });
});
