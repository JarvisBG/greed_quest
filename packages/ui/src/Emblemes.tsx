// Emblèmes dessinés (provisoires, redessinés pour le jeu) : couverture du Book, licence de Hunter, dos de carte.

export function EmblemeBook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <circle cx="50" cy="50" r="44" />
      <circle cx="50" cy="50" r="36" strokeWidth="1.5" />
      <path d="M50 10v80M10 50h80" strokeWidth="1.2" />
      <path d="M36 38c0-6 4-10 10-10h8M36 38v24c0 6 4 10 10 10h8V52h-8" strokeWidth="5" />
      <path d="M64 28v44" strokeWidth="5" />
    </svg>
  );
}

export function EmblemeHunter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M50 4 92 28v44L50 96 8 72V28z" fill="#e7eaee" />
      <path d="M50 12 85 32v36L50 88 15 68V32z" fill="#121418" />
      <path d="M34 30v40M66 30v40M34 50h32" stroke="#e7eaee" strokeWidth="8" strokeLinecap="square" />
      <path d="M50 22v8M50 70v8" stroke="#e7eaee" strokeWidth="4" />
    </svg>
  );
}

export function EmblemeDos({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" stroke="#d7b25a" aria-hidden="true">
      <circle cx="50" cy="50" r="42" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="34" strokeWidth="1" />
      <path d="m50 8 8 34 34 8-34 8-8 34-8-34-34-8 34-8z" strokeWidth="2" />
      <circle cx="50" cy="50" r="9" strokeWidth="2.5" />
    </svg>
  );
}
