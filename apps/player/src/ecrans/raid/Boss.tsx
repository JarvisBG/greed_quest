// Page ⑯ : le boss tel qu'il apparaît. Boss de base dessiné (le chef de la Brigade : casque à cornes, bandeau,
// yeux rouges, bras croisés, écusson « B » ; moue ou ricanement ; yeux en croix une fois vaincu). Les boss de la
// bibliothèque : image détourée (il se tient dans l'arène) ou image avec fond (affiche « AVIS DE RECHERCHE »).
import type { Boss } from '../../lib/raid';
import { Tampon } from '../masadora/Paquet';

export function ChefBrigade() {
  return (
    <svg viewBox="0 0 200 220" aria-hidden="true">
      <path d="M8 220 L22 132 Q30 116 60 112 L140 112 Q170 116 178 132 L192 220 Z" fill="#2b2f37" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M60 112 L84 170 M140 112 L116 170" stroke="#111" strokeWidth="3" fill="none" />
      <path d="M40 150 Q46 132 62 128 M160 150 Q154 132 138 128" stroke="#4a505c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="138" r="13" fill="#1b1d22" stroke="#111" strokeWidth="3" />
      <path d="M94 131 V145 M94 131 H101 Q106 131 106 135 Q106 138 101 138 H94 M101 138 Q107 138 107 141.5 Q107 145 101 145 H94" stroke="#e0322b" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <rect x="28" y="160" width="112" height="28" rx="13" fill="#3a3f49" stroke="#111" strokeWidth="4" transform="rotate(-8 84 174)" />
      <rect x="60" y="164" width="112" height="28" rx="13" fill="#343943" stroke="#111" strokeWidth="4" transform="rotate(8 116 178)" />
      <circle cx="40" cy="176" r="15" fill="#c98b5e" stroke="#111" strokeWidth="4" />
      <circle cx="162" cy="181" r="15" fill="#b8784c" stroke="#111" strokeWidth="4" />
      <path d="M34 170 Q40 166 46 170 M156 175 Q162 171 168 175" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M84 98 L86 116 L114 116 L116 98 Z" fill="#b8784c" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M58 30 Q40 10 30 2 Q34 26 54 50 Z" fill="#e9e1cf" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M142 30 Q160 10 170 2 Q166 26 146 50 Z" fill="#e9e1cf" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M56 70 Q56 26 100 24 Q144 26 144 70 L140 96 Q122 108 100 108 Q78 108 60 96 Z" fill="#c98b5e" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M54 66 Q54 22 100 20 Q146 22 146 66 L146 62 Q100 50 54 62 Z" fill="#2b2f37" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <path d="M72 34 L80 44 M118 30 L124 40" stroke="#4a505c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M56 66 L144 66 L144 86 Q100 80 56 86 Z" fill="#141519" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      <g className="yeux">
        <path d="M68 72 L92 76 L88 81 L70 78 Z" fill="#ff3b30" />
        <path d="M132 72 L108 76 L112 81 L130 78 Z" fill="#ff3b30" />
      </g>
      <g className="croix" stroke="#f1ece2" strokeWidth="3.5" strokeLinecap="round">
        <path d="M72 70 L86 82 M86 70 L72 82" />
        <path d="M114 70 L128 82 M128 70 L114 82" />
      </g>
      <path d="M118 88 L126 104" stroke="#8a5a36" strokeWidth="2.5" strokeLinecap="round" />
      <path className="moue" d="M84 96 Q100 92 116 96" stroke="#111" strokeWidth="4" fill="none" strokeLinecap="round" />
      <g className="grin">
        <path d="M78 92 Q100 108 122 92 Q100 100 78 92 Z" fill="#fff" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M86 95 L88 100 M94 97 L95 102 M101 98 L101 103 M108 97 L107 102 M115 95 L113 100" stroke="#111" strokeWidth="2" />
      </g>
    </svg>
  );
}

/** Le boss, quel que soit son rendu ; `ko` : vaincu (yeux en croix, image grisée, tampon « VAINCU » sur l'affiche). */
export function VisuelBoss({ boss }: { boss: Boss }) {
  if (boss.rendu === 'dessin' || !boss.image) return <ChefBrigade />;
  if (boss.rendu === 'detoure') return <img src={boss.image} alt="" />;
  return (
    <div className="rd-avis">
      <span className="a-titre">AVIS DE RECHERCHE</span>
      <div className="photo">
        <img src={boss.image} alt="" />
      </div>
      <span className="a-nom">{boss.nom}</span>
      <span className="a-prime">Récompense : 3 sorts par chasseur</span>
      <div className="tampon-ko">
        <Tampon mots={['VAINCU']} taille={24} />
      </div>
    </div>
  );
}
