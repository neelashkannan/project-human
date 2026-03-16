export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="logoGradSoft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      <circle cx="60" cy="60" r="54" fill="#1c1c1f" />
      <circle cx="60" cy="60" r="54" fill="none" stroke="#2a2a2d" strokeWidth="1.5" />

      <g>
        {/* Head */}
        <circle cx="60" cy="30" r="9" fill="url(#logoGrad)" />

        {/* Body flowing into J */}
        <path
          d="M60 39 C60 39 60 56 60 66 C60 80 51 87 40 87 C33 87 29 82 29 77"
          stroke="url(#logoGrad)"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Right arm */}
        <path
          d="M60 51 C66 49 76 45 84 49"
          stroke="url(#logoGradSoft)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />

        {/* Left arm */}
        <path
          d="M60 53 C54 51 44 48 36 51"
          stroke="url(#logoGradSoft)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />

        {/* Heartbeat pulse */}
        <path
          d="M22 97 L38 97 L43 89 L49 105 L54 86 L60 97 L98 97"
          stroke="url(#logoGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.4"
        />
      </g>
    </svg>
  );
}
