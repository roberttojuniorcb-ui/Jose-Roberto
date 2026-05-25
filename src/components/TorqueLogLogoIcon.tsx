import React from 'react';

interface TorqueLogLogoIconProps {
  className?: string;
  size?: number | string;
}

export default function TorqueLogLogoIcon({ className = '', size = 48 }: TorqueLogLogoIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`select-none shrink-0 ${className}`}
      fill="currentColor"
    >
      {/* 1. Slowly Rotating Outer Gear Group */}
      <g className="origin-[46px_50px] animate-[spin_25s_linear_infinite]">
        {/* Main circular track of the cog */}
        <circle cx="46" cy="50" r="30" stroke="currentColor" strokeWidth="3" fill="none" className="opacity-90" />
        <circle cx="46" cy="50" r="25" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" fill="none" className="opacity-60" />

        {/* Outer teeth of the gear */}
        {/* Programmatic rendering of teeth around the gear circumference */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
          <rect
            key={angle}
            x="43.5"
            y="16"
            width="5"
            height="7"
            rx="1"
            fill="currentColor"
            transform={`rotate(${angle} 46 50)`}
          />
        ))}
      </g>

      {/* 2. Sweeping Arrow that wraps around the bottom and right side */}
      <path
        d="M 46 88 A 38 38 0 0 0 84 50 L 91 50 L 81.5 31 L 72 50 L 79 50 A 33 33 0 0 1 46 83 L 46 88 Z"
        fill="currentColor"
        className="text-orange-500 drop-shadow-[0_2px_4px_rgba(249,115,22,0.3)] animate-[pulse_3s_ease-in-out_infinite]"
      />

      {/* 3. Speeding Motorcycle Rider Silhouette with forward motion vibrate */}
      <g className="origin-[46px_50px] animate-[bounce_1.2s_ease-in-out_infinite] transform-gpu">
        {/* Speed / Motion lines trailing behind the motorcycle */}
        <g className="opacity-95 text-orange-400">
          <line 
            x1="6" 
            y1="46" 
            x2="18" 
            y2="46" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            className="animate-[pulse_0.4s_infinite_alternate]" 
          />
          <line 
            x1="2" 
            y1="51" 
            x2="15" 
            y2="51" 
            stroke="currentColor" 
            strokeWidth="3.0" 
            strokeLinecap="round" 
            className="animate-[pulse_0.3s_infinite_alternate]" 
          />
          <line 
            x1="5" 
            y1="56" 
            x2="14" 
            y2="56" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            className="animate-[pulse_0.5s_infinite_alternate]" 
          />
        </g>

        {/* Silhouette of the motorcycle & leaning rider */}
        <path
          d="M 19 56 
             C 19 51, 23 48, 28 48 
             C 30 48, 32 49, 34 52 
             L 42 45 
             C 41 43, 40 41, 40 39 
             C 40 34, 44 30, 49 30 
             C 51 30, 53 31, 54 32 
             L 63 26 
             C 65 25, 67 26, 68 29 
             L 70 33 
             C 72 34, 73 35, 74 37 
             L 78 44 
             C 80 47, 79 51, 76 53 
             C 74 55, 71 56, 68 56 
             L 19 56 Z"
          fill="currentColor"
          className="text-white filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
        />

        {/* Detailed High-Contrast highlights inside silhouette */}
        {/* Body contour and arms */}
        <path 
          d="M 41 45 C 47 41, 52 40, 58 43" 
          stroke="currentColor" 
          strokeWidth="1.8" 
          strokeLinecap="round" 
          fill="none" 
          className="text-slate-900"
        />
        {/* Lower torso cutout */}
        <path 
          d="M 34 53 C 43 49, 49 49, 55 51" 
          stroke="currentColor" 
          strokeWidth="1.8" 
          strokeLinecap="round" 
          fill="none" 
          className="text-slate-900"
        />
        {/* Helmet visor highlight */}
        <path 
          d="M 50 31 C 53 31, 54 32, 55 35" 
          stroke="currentColor" 
          strokeWidth="1.6" 
          strokeLinecap="round" 
          fill="none" 
          className="text-slate-900"
        />

        {/* Motorcycle wheels inside group */}
        <circle cx="28" cy="54" r="7" fill="currentColor" className="text-slate-900" />
        <circle cx="28" cy="54" r="5" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" />
        <circle cx="28" cy="54" r="2.2" fill="currentColor" className="text-slate-900" />

        <circle cx="65" cy="54" r="7" fill="currentColor" className="text-slate-900" />
        <circle cx="65" cy="54" r="5" fill="none" stroke="currentColor" strokeWidth="2" className="text-white" />
        <circle cx="65" cy="54" r="2.2" fill="currentColor" className="text-slate-900" />
      </g>
    </svg>
  );
}
