export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size * 0.75} 
      viewBox="0 0 80 60" 
      fill="none"
      style={{ display: "block" }}
    >
      {/* Three flowing wave lines - matching reference exactly */}
      {/* Waves flow diagonally, starting narrow left and widening right */}
      <path 
        d="M 8 38 C 20 38, 25 28, 40 28 C 55 28, 60 18, 72 18" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="5" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 8 48 C 20 48, 25 38, 40 38 C 55 38, 60 28, 72 28" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="5" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 8 58 C 20 58, 25 48, 40 48 C 55 48, 60 38, 72 38" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="5" 
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

