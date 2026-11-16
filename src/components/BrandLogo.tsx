import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
  xl: 'w-16 h-16 rounded-2xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showBadge = false,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        className={`${SIZE_MAP[size]} overflow-hidden border border-emerald-500/35 bg-[#070B14] shadow-lg shadow-emerald-950/50 flex items-center justify-center`}
      >
        <img
          src="/icons/icon.svg"
          alt="SABAA QUANT"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
      {showBadge && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#070B14]" />
      )}
    </div>
  );
};
