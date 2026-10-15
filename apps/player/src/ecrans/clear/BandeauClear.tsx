// Page ⑰ (RG-13.1) : Clear déclaré, Book gelé. Bandeau doré sous la barre, sur toutes les pages, tant que le Game
// Master n'a pas confirmé ou refusé ; raccourci vers la licence qu'il doit scanner.
import { Sceau } from './Sceau';

export function BandeauClear({ onLicence }: { onLicence: () => void }) {
  return (
    <div className="cl-bandeau" role="status">
      <Sceau className="mini-sceau" />
      <span>
        <b>Clear déclaré</b> : va voir le Game Master
      </span>
      <button onClick={onLicence}>Ma licence</button>
    </div>
  );
}
