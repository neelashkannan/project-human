export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoSurface" x1="18" y1="16" x2="106" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f5f7fb" />
          <stop offset="1" stopColor="#d9e1eb" />
        </linearGradient>
        <linearGradient id="logoInk" x1="35" y1="28" x2="99" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#435062" />
          <stop offset="1" stopColor="#738091" />
        </linearGradient>
      </defs>

      <rect x="12" y="12" width="104" height="104" rx="30" fill="url(#logoSurface)" />
      <rect x="12" y="12" width="104" height="104" rx="30" stroke="#8a94a3" strokeWidth="2" />

      <circle cx="49" cy="31" r="5.5" fill="url(#logoInk)" />

      <path
        d="M49 43v26c0 11-7 18-18 18"
        stroke="url(#logoInk)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M73 85V44m0 20c0-8 6-13 14-13 8 0 14 6 14 16v18"
        stroke="url(#logoInk)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
