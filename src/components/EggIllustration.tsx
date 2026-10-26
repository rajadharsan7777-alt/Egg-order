import React from 'react';

export type EggIllustrationType = 'nattu_kozhi' | 'white_farm' | 'brown_freerange' | 'kadaknath' | 'quail';

interface EggIllustrationProps {
  type: EggIllustrationType;
  className?: string;
}

export const EggIllustration: React.FC<EggIllustrationProps> = ({ type, className = 'w-full h-full' }) => {
  switch (type) {
    case 'nattu_kozhi':
      // Rustic speckled organic country chicken egg in woven nest
      return (
        <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          <defs>
            <radialGradient id="nattuEggGrad1" cx="45%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="40%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </radialGradient>
            <radialGradient id="nattuEggGrad2" cx="42%" cy="36%" r="65%">
              <stop offset="0%" stopColor="#ffedd5" />
              <stop offset="45%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#9a3412" />
            </radialGradient>
            <linearGradient id="nestStraw" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <filter id="eggShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="12" stdDeviation="10" floodOpacity="0.22" floodColor="#451a03" />
            </filter>
          </defs>

          {/* Background warm farm glow */}
          <rect width="320" height="220" fill="#fffbeb" />
          <circle cx="160" cy="110" r="105" fill="#fef3c7" opacity="0.6" />

          {/* Straw / Nest Bedding Lines */}
          <g stroke="url(#nestStraw)" strokeWidth="3" opacity="0.45" strokeLinecap="round">
            <path d="M40 165 C90 195, 230 195, 280 165" />
            <path d="M60 175 C110 205, 210 205, 260 175" />
            <path d="M75 160 C130 185, 190 185, 245 160" />
            <path d="M50 180 C120 215, 200 215, 270 180" />
            <path d="M90 150 C140 165, 180 165, 230 150" />
          </g>

          {/* Secondary background egg */}
          <g filter="url(#eggShadow)">
            <ellipse cx="198" cy="118" rx="42" ry="58" transform="rotate(22 198 118)" fill="url(#nattuEggGrad2)" />
            {/* Speckles */}
            <circle cx="185" cy="105" r="1.5" fill="#7c2d12" opacity="0.6" />
            <circle cx="210" cy="120" r="2" fill="#7c2d12" opacity="0.5" />
            <circle cx="195" cy="140" r="1.5" fill="#7c2d12" opacity="0.7" />
          </g>

          {/* Primary country egg */}
          <g filter="url(#eggShadow)">
            <ellipse cx="135" cy="112" rx="46" ry="64" transform="rotate(-12 135 112)" fill="url(#nattuEggGrad1)" />
            {/* Soft highlight curve */}
            <path d="M120 75 C132 80, 142 95, 140 120" stroke="#ffedd5" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
            {/* Speckles */}
            <circle cx="125" cy="95" r="2" fill="#451a03" opacity="0.5" />
            <circle cx="145" cy="110" r="1.8" fill="#451a03" opacity="0.6" />
            <circle cx="130" cy="130" r="2.2" fill="#451a03" opacity="0.55" />
            <circle cx="152" cy="138" r="1.4" fill="#451a03" opacity="0.5" />
            <circle cx="118" cy="120" r="1.6" fill="#451a03" opacity="0.6" />
          </g>

          {/* Authentic Country Tag Icon */}
          <g transform="translate(24, 24)">
            <rect width="84" height="24" rx="4" fill="#451a03" fillOpacity="0.85" />
            <text x="42" y="16" fill="#fef3c7" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.05em">
              100% NATIVE
            </text>
          </g>
        </svg>
      );

    case 'white_farm':
      // Pristine white table eggs in classic egg tray grid
      return (
        <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          <defs>
            <radialGradient id="whiteEggGrad1" cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f1f5f9" />
              <stop offset="90%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>
            <radialGradient id="whiteEggGrad2" cx="35%" cy="30%" r="68%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>
            <filter id="trayShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="10" stdDeviation="8" floodOpacity="0.12" floodColor="#334155" />
            </filter>
          </defs>

          {/* Clean neutral background */}
          <rect width="320" height="220" fill="#f8fafc" />
          <circle cx="160" cy="110" r="105" fill="#f1f5f9" opacity="0.7" />

          {/* Paper-pulp tray socket impressions */}
          <g fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5">
            <ellipse cx="90" cy="155" rx="36" ry="16" />
            <ellipse cx="160" cy="165" rx="38" ry="18" />
            <ellipse cx="230" cy="155" rx="36" ry="16" />
          </g>

          {/* Left Egg */}
          <g filter="url(#trayShadow)">
            <ellipse cx="98" cy="122" rx="38" ry="52" transform="rotate(-8 98 122)" fill="url(#whiteEggGrad2)" />
            <path d="M85 95 C93 100, 98 112, 96 128" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
          </g>

          {/* Right Egg */}
          <g filter="url(#trayShadow)">
            <ellipse cx="222" cy="122" rx="38" ry="52" transform="rotate(8 222 122)" fill="url(#whiteEggGrad2)" />
            <path d="M210 95 C218 100, 222 112, 220 128" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
          </g>

          {/* Center Showcase White Egg */}
          <g filter="url(#trayShadow)">
            <ellipse cx="160" cy="110" rx="44" ry="60" fill="url(#whiteEggGrad1)" />
            <path d="M145 80 C154 85, 160 100, 158 118" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" opacity="0.9" />
            {/* Gentle candling warmth stamp */}
            <circle cx="160" cy="116" r="16" fill="#fef08a" opacity="0.15" />
          </g>

          <g transform="translate(24, 24)">
            <rect width="84" height="24" rx="4" fill="#1e293b" fillOpacity="0.85" />
            <text x="42" y="16" fill="#f8fafc" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.05em">
              GRADE-A TABLE
            </text>
          </g>
        </svg>
      );

    case 'brown_freerange':
      // Organic brown eggs with golden glow
      return (
        <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          <defs>
            <radialGradient id="brownGrad1" cx="40%" cy="35%" r="68%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="50%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </radialGradient>
            <filter id="brownShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="12" stdDeviation="10" floodOpacity="0.2" floodColor="#431407" />
            </filter>
          </defs>

          <rect width="320" height="220" fill="#fff7ed" />
          <circle cx="160" cy="110" r="105" fill="#ffedd5" opacity="0.6" />

          {/* Botanical grain leaf motif */}
          <path d="M60 180 Q100 130 160 150 Q130 180 60 180 Z" fill="#bbf7d0" opacity="0.35" />
          <path d="M260 180 Q220 130 160 150 Q190 180 260 180 Z" fill="#bbf7d0" opacity="0.35" />

          {/* Pair of Golden Brown Eggs */}
          <g filter="url(#brownShadow)">
            <ellipse cx="195" cy="118" rx="42" ry="58" transform="rotate(18 195 118)" fill="url(#brownGrad1)" opacity="0.95" />
          </g>
          <g filter="url(#brownShadow)">
            <ellipse cx="132" cy="112" rx="45" ry="62" transform="rotate(-14 132 112)" fill="url(#brownGrad1)" />
            <path d="M118 78 C128 84, 136 96, 134 116" stroke="#ffedd5" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          </g>

          <g transform="translate(24, 24)">
            <rect width="84" height="24" rx="4" fill="#78350f" fillOpacity="0.85" />
            <text x="42" y="16" fill="#fef3c7" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.05em">
              PASTURE LAID
            </text>
          </g>
        </svg>
      );

    case 'kadaknath':
      // Mysterious dark native Kadaknath eggs
      return (
        <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          <defs>
            <radialGradient id="kadakGrad1" cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#78716c" />
              <stop offset="50%" stopColor="#44403c" />
              <stop offset="90%" stopColor="#1c1917" />
              <stop offset="100%" stopColor="#0c0a09" />
            </radialGradient>
            <filter id="darkShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="12" stdDeviation="12" floodOpacity="0.3" floodColor="#000000" />
            </filter>
          </defs>

          <rect width="320" height="220" fill="#f5f5f4" />
          <circle cx="160" cy="110" r="105" fill="#e7e5e4" opacity="0.7" />

          {/* Rare feather illustration */}
          <path d="M70 170 C120 130, 200 130, 250 170" stroke="#78716c" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />

          <g filter="url(#darkShadow)">
            <ellipse cx="160" cy="112" rx="45" ry="63" fill="url(#kadakGrad1)" />
            {/* Satin sheen reflection */}
            <path d="M142 78 C150 84, 156 98, 154 116" stroke="#d6d3d1" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
          </g>

          <g transform="translate(24, 24)">
            <rect width="88" height="24" rx="4" fill="#1c1917" fillOpacity="0.9" />
            <text x="44" y="16" fill="#f5f5f4" fontSize="9" fontWeight="700" textAnchor="middle" letterSpacing="0.05em">
              RARE NATIVE
            </text>
          </g>
        </svg>
      );

    case 'quail':
      // Distinct speckled mini quail eggs cluster
      return (
        <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
          <defs>
            <radialGradient id="quailBase" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#f5f5f4" />
              <stop offset="60%" stopColor="#e7e5e4" />
              <stop offset="100%" stopColor="#a8a29e" />
            </radialGradient>
            <filter id="quailShadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.2" floodColor="#44403c" />
            </filter>
          </defs>

          <rect width="320" height="220" fill="#fafaf9" />
          <circle cx="160" cy="110" r="105" fill="#f5f5f4" opacity="0.8" />

          {/* Trio of speckled mini eggs */}
          {/* Egg 1 */}
          <g filter="url(#quailShadow)">
            <ellipse cx="115" cy="120" rx="26" ry="36" transform="rotate(-15 115 120)" fill="url(#quailBase)" />
            <circle cx="110" cy="110" r="3" fill="#292524" opacity="0.7" />
            <circle cx="120" cy="125" r="4.5" fill="#44403c" opacity="0.65" />
            <circle cx="106" cy="128" r="2.5" fill="#1c1917" opacity="0.6" />
            <circle cx="122" cy="106" r="2" fill="#292524" opacity="0.55" />
          </g>

          {/* Egg 2 */}
          <g filter="url(#quailShadow)">
            <ellipse cx="205" cy="122" rx="25" ry="35" transform="rotate(18 205 122)" fill="url(#quailBase)" />
            <circle cx="200" cy="115" r="3.5" fill="#292524" opacity="0.75" />
            <circle cx="212" cy="126" r="3" fill="#44403c" opacity="0.6" />
            <circle cx="198" cy="132" r="2" fill="#1c1917" opacity="0.7" />
          </g>

          {/* Egg 3 (Center) */}
          <g filter="url(#quailShadow)">
            <ellipse cx="160" cy="105" rx="28" ry="40" fill="url(#quailBase)" />
            <circle cx="152" cy="95" r="4" fill="#292524" opacity="0.8" />
            <circle cx="168" cy="104" r="5" fill="#44403c" opacity="0.7" />
            <circle cx="156" cy="118" r="3" fill="#1c1917" opacity="0.65" />
            <circle cx="166" cy="88" r="2" fill="#292524" opacity="0.6" />
          </g>

          <g transform="translate(24, 24)">
            <rect width="84" height="24" rx="4" fill="#292524" fillOpacity="0.85" />
            <text x="42" y="16" fill="#f5f5f4" fontSize="10" fontWeight="600" textAnchor="middle" letterSpacing="0.05em">
              KAADAI MUTTAI
            </text>
          </g>
        </svg>
      );

    default:
      return null;
  }
};
