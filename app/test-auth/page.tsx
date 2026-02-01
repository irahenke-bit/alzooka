"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function TestAuthPage() {
  const [urlInfo, setUrlInfo] = useState<string>("");

  useEffect(() => {
    const info = {
      href: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      searchParams: Object.fromEntries(new URLSearchParams(window.location.search)),
    };
    setUrlInfo(JSON.stringify(info, null, 2));
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h1>Auth Test Page</h1>
      <p>This page shows exactly what URL we received:</p>
      <pre style={{ 
        background: "#000000", 
        padding: 20, 
        borderRadius: 8, 
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}>
        {urlInfo || "Loading..."}
      </pre>
      <p style={{ marginTop: 20 }}>
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Back to Login
        </Link>
      </p>
    </div>
  );
}
