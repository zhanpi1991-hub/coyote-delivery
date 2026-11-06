import React from 'react';

interface LogoProps {
  variant?: 'light' | 'dark' | 'copper';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSecondary?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'light',
  size = 'md',
  showText = true,
  showSecondary = true,
  layout = 'horizontal',
  className = '',
}) => {
  // Dimensions for the SVG mark
  const iconSizes = {
    sm: { w: 26, h: 26, viewBox: '0 0 48 48' },
    md: { w: 34, h: 34, viewBox: '0 0 48 48' },
    lg: { w: 44, h: 44, viewBox: '0 0 48 48' },
    xl: { w: 60, h: 60, viewBox: '0 0 48 48' },
  };

  const textSizes = {
    sm: { primary: 'text-sm tracking-[0.16em]', secondary: 'text-[9px] tracking-[0.22em]' },
    md: { primary: 'text-base tracking-[0.18em]', secondary: 'text-[10px] tracking-[0.26em]' },
    lg: { primary: 'text-xl tracking-[0.2em]', secondary: 'text-xs tracking-[0.3em]' },
    xl: { primary: 'text-2xl tracking-[0.22em]', secondary: 'text-sm tracking-[0.32em]' },
  };

  // Color mappings
  const markColors = {
    light: {
      leftEar: '#D98943',
      rightEar: '#BD702C',
      forehead: '#F3E9DC',
      snoutLeft: '#D98943',
      snoutRight: '#8A7668',
      nose: '#21150F',
      textPrimary: 'text-white',
      textSecondary: 'text-[#D98943]',
      badgeBg: 'bg-[#382216]',
      badgeBorder: 'border-[#8A7668]/30',
    },
    dark: {
      leftEar: '#382216',
      rightEar: '#21150F',
      forehead: '#D98943',
      snoutLeft: '#382216',
      snoutRight: '#21150F',
      nose: '#D98943',
      textPrimary: 'text-[#21150F]',
      textSecondary: 'text-[#8A7668]',
      badgeBg: 'bg-[#F3E9DC]',
      badgeBorder: 'border-[#E8DAC8]',
    },
    copper: {
      leftEar: '#D98943',
      rightEar: '#BD702C',
      forehead: '#E8A264',
      snoutLeft: '#D98943',
      snoutRight: '#BD702C',
      nose: '#382216',
      textPrimary: 'text-[#D98943]',
      textSecondary: 'text-[#8A7668]',
      badgeBg: 'bg-[#FAF4EC]',
      badgeBorder: 'border-[#D98943]/30',
    },
  }[variant];

  const currentIcon = iconSizes[size];
  const currentText = textSizes[size];

  return (
    <div
      className={`inline-flex items-center ${
        layout === 'vertical' ? 'flex-col text-center gap-2' : 'gap-3'
      } ${className}`}
    >
      {/* Abstract Geometric Coyote Mark */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={currentIcon.w}
          height={currentIcon.h}
          viewBox={currentIcon.viewBox}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 group-hover:scale-105"
        >
          {/* Left Ear */}
          <polygon
            points="24,20 12,6 18,22"
            fill={markColors.leftEar}
          />
          {/* Right Ear */}
          <polygon
            points="24,20 36,6 30,22"
            fill={markColors.rightEar}
          />
          {/* Forehead Facet */}
          <polygon
            points="24,14 18,22 24,28 30,22"
            fill={markColors.forehead}
          />
          {/* Left Cheek / Snout */}
          <polygon
            points="18,22 8,28 24,42 24,28"
            fill={markColors.snoutLeft}
          />
          {/* Right Cheek / Snout */}
          <polygon
            points="30,22 40,28 24,42 24,28"
            fill={markColors.snoutRight}
          />
          {/* Nose Accent Point */}
          <polygon
            points="22,38 26,38 24,42"
            fill={markColors.nose}
          />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className={`flex flex-col leading-none ${layout === 'vertical' ? 'items-center' : ''}`}>
          <span className={`font-black font-sans uppercase ${currentText.primary} ${markColors.textPrimary}`}>
            COYOTE
          </span>
          {showSecondary && (
            <span
              className={`font-semibold uppercase mt-1 ${currentText.secondary} ${markColors.textSecondary}`}
            >
              DELIVERY
            </span>
          )}
        </div>
      )}
    </div>
  );
};
