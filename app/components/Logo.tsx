export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size * 0.5} 
      viewBox="0 0 100 50" 
      fill="none"
      style={{ display: "block" }}
    >
      {/* Three smooth flowing wave lines */}
      <path 
        d="M 5 12 C 18 2, 30 2, 43 12 C 56 22, 68 22, 81 12 C 88 6, 95 6, 95 12" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 5 25 C 18 15, 30 15, 43 25 C 56 35, 68 35, 81 25 C 88 19, 95 19, 95 25" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 5 38 C 18 28, 30 28, 43 38 C 56 48, 68 48, 81 38 C 88 32, 95 32, 95 38" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function LogoWithText() {
  return (
    <div style={{ textAlign: "center" }}>
      <Logo size={64} />
      <h1 style={{ fontSize: 32, margin: "16px 0 0 0", fontWeight: 400 }}>
        Alzooka
      </h1>
      <p 
        className="text-muted" 
        style={{ margin: "8px 0 0 0", fontSize: 14, letterSpacing: 2 }}
      >
        COMMUNITY WITHOUT CLUTTER
      </p>
    </div>
  );
}

