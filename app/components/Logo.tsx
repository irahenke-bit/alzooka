export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg 
      width={size} 
      height={size * 0.5} 
      viewBox="0 0 100 50" 
      fill="none"
      style={{ display: "block" }}
    >
      {/* Three smooth flowing wave lines - matching reference */}
      <path 
        d="M 5 12 C 5 12, 14 4, 25 4 C 36 4, 40 20, 51 20 C 62 20, 66 4, 77 4 C 88 4, 95 14, 95 12" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="3.5" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 5 25 C 5 25, 14 17, 25 17 C 36 17, 40 33, 51 33 C 62 33, 66 17, 77 17 C 88 17, 95 27, 95 25" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="3.5" 
        strokeLinecap="round"
        fill="none"
      />
      <path 
        d="M 5 38 C 5 38, 14 30, 25 30 C 36 30, 40 46, 51 46 C 62 46, 66 30, 77 30 C 88 30, 95 40, 95 38" 
        stroke="var(--alzooka-gold)" 
        strokeWidth="3.5" 
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

