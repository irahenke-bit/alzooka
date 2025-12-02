export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size * 0.6} 
      viewBox="0 0 100 60" 
      fill="none"
      style={{ display: "block" }}
    >
      {/* Three smooth wave lines - matching reference image exactly */}
      <path 
        d="M 10 15 Q 30 5, 50 15 Q 70 25, 90 15" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 10 30 Q 30 20, 50 30 Q 70 40, 90 30" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 10 45 Q 30 35, 50 45 Q 70 55, 90 45" 
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

