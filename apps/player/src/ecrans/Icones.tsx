// Icônes dessinées à la main, un seul trait (2,4 px), pour les onglets et quelques états.
const P = { viewBox: '0 0 24 24', 'aria-hidden': true } as const;

export const IconeAccueil = () => (
  <svg {...P}>
    <path d="M3 11 12 3l9 8M6 9.5V21h12V9.5M10 21v-6h4v6" />
  </svg>
);
export const IconeScanner = () => (
  <svg {...P}>
    <path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 12h10" />
  </svg>
);
export const IconeBook = () => (
  <svg {...P}>
    <path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zM5 19a2 2 0 0 1 2-2h12M9 7h6" />
  </svg>
);
export const IconeSorts = () => (
  <svg {...P}>
    <path d="m12 2 2.6 6.6L21 9.5l-5 4.4 1.6 6.6L12 17l-5.6 3.5L8 13.9 3 9.5l6.4-.9z" />
  </svg>
);
export const IconeEchanges = () => (
  <svg {...P}>
    <path d="M4 8h14l-4-4M20 16H6l4 4" />
  </svg>
);
export const IconeJuste = () => (
  <svg {...P}>
    <path d="m4 12 5 5L20 6" />
  </svg>
);
export const IconeFaux = () => (
  <svg {...P}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const FlecheGauche = () => (
  <svg {...P}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);
export const FlecheDroite = () => (
  <svg {...P}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);
