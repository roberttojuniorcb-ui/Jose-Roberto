import React from 'react';

interface TorqueLogLogoIconProps {
  className?: string;
  size?: number | string;
  variant?: 'esportivo' | 'premium';
}

export default function TorqueLogLogoIcon({ 
  className = '', 
  size = 48,
  variant = 'esportivo'
}: TorqueLogLogoIconProps) {
  if (variant === 'premium') {
    return (
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={`select-none shrink-0 ${className}`}
        fill="none"
      >
        <defs>
          <linearGradient id="premiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" /> {/* orange-500 */}
            <stop offset="50%" stopColor="#f59e0b" /> {/* amber-500 */}
            <stop offset="100%" stopColor="#ea580c" /> {/* orange-600 */}
          </linearGradient>
          <filter id="glowFilter" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Kinetic Ring - Heavy border styling for massive visibility */}
        <circle 
          cx="50" 
          cy="50" 
          r="41" 
          stroke="url(#premiumGrad)" 
          strokeWidth="6.5" 
          strokeDasharray="200 60" 
          className="origin-center animate-[spin_10s_linear_infinite]"
        />

        {/* Dynamic inner orbital node */}
        <circle 
          cx="50" 
          cy="9" 
          r="6.5" 
          fill="#f59e0b" 
          className="origin-center animate-[spin_10s_linear_infinite] drop-shadow-[0_0_8px_#f59e0b]" 
        />

        {/* Ultra-Tech Geometric "T" and arrow fusion representing torque power and speed */}
        <g filter="url(#glowFilter)" className="animate-[pulse_4s_ease-in-out_infinite]">
          {/* Main vertical column of T - thick tech lines */}
          <path 
            d="M 44,40 L 44,70 C 44,74.5 47.5,78 52,78 L 56,78 C 60.5,78 64,74.5 64,70 L 64,54" 
            stroke="url(#premiumGrad)" 
            strokeWidth="9.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="opacity-95"
          />

          {/* Torque Arrow Head - Bold speed chevron facing right */}
          <path 
            d="M 30,34 L 54,34 L 74,34 L 62,20 M 74,34 L 62,48" 
            stroke="url(#premiumGrad)" 
            strokeWidth="9.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />

          {/* Kinetic Speed Lines behind */}
          <path 
            d="M 18,34 L 22,34 M 14,44 L 26,44 M 20,54 L 30,54" 
            stroke="#f59e0b" 
            strokeWidth="3.5" 
            strokeLinecap="round"
            className="animate-[pulse_1s_infinite_alternate] opacity-80"
          />
        </g>

        {/* Small subtle inner compass or power dot */}
        <circle cx="50" cy="50" r="4.5" fill="#ffffff" className="animate-pulse" />
      </svg>
    );
  }

  // DEFAULT / ESPORTIVO: The enhanced turbo logo
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`select-none shrink-0 ${className}`}
      fill="currentColor"
    >
      {/* 1. Slowly Rotating Outer Gear Group */}
      <g className="origin-[46px_50px] animate-[spin_20s_linear_infinite]">
        {/* Main circular track of the cog */}
        <circle cx="46" cy="50" r="32" stroke="currentColor" strokeWidth="4.5" fill="none" className="opacity-95" />
        <circle cx="46" cy="50" r="25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" fill="none" className="opacity-70" />

        {/* Outer teeth of the gear - thickened to be larger and much more visible */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
          <rect
            key={angle}
            x="43"
            y="13"
            width="6"
            height="9"
            rx="1.5"
            fill="currentColor"
            transform={`rotate(${angle} 46 50)`}
          />
        ))}
      </g>

      {/* 2. Sweeping Arrow that wraps around the bottom and right side */}
      <path
        d="M 46 90 A 40 40 0 0 0 86 50 L 92 50 L 81.5 28 L 71 50 L 77 50 A 31 31 0 0 1 46 81 L 46 90 Z"
        fill="currentColor"
        className="text-orange-500 drop-shadow-[0_3px_6px_rgba(249,115,22,0.45)] animate-[pulse_2.5s_ease-in-out_infinite]"
      />

      {/* 3. Speeding Motorcycle Rider Silhouette with forward motion vibrate */}
      <g className="origin-[46px_50px] animate-[bounce_1.2s_ease-in-out_infinite] transform-gpu">
        {/* Speed / Motion lines trailing behind the motorcycle */}
        <g className="opacity-95 text-orange-400">
          <line 
            x1="4" 
            y1="44" 
            x2="19" 
            y2="44" 
            stroke="currentColor" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            className="animate-[pulse_0.4s_infinite_alternate]" 
          />
          <line 
            x1="1" 
            y1="50" 
            x2="16" 
            y2="50" 
            stroke="currentColor" 
            strokeWidth="4.0" 
            strokeLinecap="round" 
            className="animate-[pulse_0.3s_infinite_alternate]" 
          />
          <line 
            x1="3" 
            y1="56" 
            x2="15" 
            y2="56" 
            stroke="currentColor" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            className="animate-[pulse_0.5s_infinite_alternate]" 
          />
        </g>

        {/* Silhouette of the motorcycle & leaning rider - enlarged for supreme visibility */}
        <path
          d="M 18 56 
             C 18 50, 22 47, 28 47 
             C 30 47, 32 48, 34 51 
             L 42 43 
             C 41 41, 40 39, 40 37 
             C 40 32, 44 28, 49 28 
             C 51 28, 53 29, 54 30 
             L 63 24 
             C 65 23, 67 24, 68 27 
             L 70 31 
             C 72 32, 73 33, 74 35 
             L 78 42 
             C 80 45, 79 49, 76 51 
             C 74 53, 71 54, 68 54 
             L 18 54 Z"
          fill="currentColor"
          className="text-white filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.65)]"
        />

        {/* Detailed High-Contrast highlights inside silhouette */}
        <path 
          d="M 41 43 C 47 39, 52 38, 58 41" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          fill="none" 
          className="text-slate-950"
        />
        <path 
          d="M 34 51 C 43 47, 49 47, 55 49" 
          stroke="currentColor" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          fill="none" 
          className="text-slate-950"
        />
        <path 
          d="M 50 29 C 53 29, 54 30, 55 33" 
          stroke="currentColor" 
          strokeWidth="2.0" 
          strokeLinecap="round" 
          fill="none" 
          className="text-slate-950"
        />

        {/* Motorcycle wheels inside group */}
        <circle cx="28" cy="52" r="8" fill="currentColor" className="text-slate-950" />
        <circle cx="28" cy="52" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white" />
        <circle cx="28" cy="52" r="2.5" fill="currentColor" className="text-slate-950" />

        <circle cx="65" cy="52" r="8" fill="currentColor" className="text-slate-950" />
        <circle cx="65" cy="52" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white" />
        <circle cx="65" cy="52" r="2.5" fill="currentColor" className="text-slate-950" />
      </g>
    </svg>
  );
}
