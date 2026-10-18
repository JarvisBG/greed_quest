// Adresses en ligne (docs/DEPLOIEMENT.md) et contact (Spécifications fonctionnelles).
export const APP_JOUEUR = 'https://greed-island-joueur.jarvismboummeu28.workers.dev';
export const CONSOLE = 'https://greed-island-console.jarvismboummeu28.workers.dev';
export const ECRAN = 'https://greed-island-ecran.jarvismboummeu28.workers.dev';

export const CONTACT_NOM = 'Jarvis Mboummeu';
const MESSAGE = 'Bonjour, je souhaite organiser une partie de Greed Island.';
export const WHATSAPP = `https://wa.me/237698376108?text=${encodeURIComponent(MESSAGE)}`;
export const TELEPHONES = [
  { affiche: '+237 6 98 37 61 08', lien: 'tel:+237698376108', whatsapp: true },
  { affiche: '+237 6 70 07 96 98', lien: 'tel:+237670079698', whatsapp: false },
] as const;
