export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size * 0.6} 
      viewBox="0 0 80 48" 
      fill="none"
      style={{ display: "block", margin: "0 auto" }}
    >
      {/* Three wave lines */}
      <path 
        d="M8 12 Q20 4, 32 12 T56 12 T72 12" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M8 24 Q20 16, 32 24 T56 24 T72 24" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M8 36 Q20 28, 32 36 T56 36 T72 36" 
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

