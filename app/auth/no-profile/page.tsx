"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";
import { Suspense } from "react";

function NoProfileContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your Google account";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      textAlign: "center",
    }}>
      <div style={{ marginBottom: 40 }}>
        <LogoWithText />
      </div>

      <div style={{
        maxWidth: 400,
        padding: 32,
        background: "var(--alzooka-teal-dark)",
        borderRadius: 12,
        border: "1px solid rgba(240, 235, 224, 0.2)",
      }}>
        <h2 style={{ marginBottom: 16, fontSize: 22, color: "var(--alzooka-gold)" }}>
          Account Not Found
        </h2>
        <p style={{ marginBottom: 24, lineHeight: 1.6, color: "var(--alzooka-cream)" }}>
          We could not find a profile associated with <strong>{email}</strong>.
        </p>
        <p style={{ marginBottom: 24, lineHeight: 1.6, color: "var(--text-muted)" }}>
          Please sign up to join Alzooka.
        </p>
        <Link
          href="/signup"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            background: "var(--alzooka-gold)",
            color: "var(--alzooka-teal-dark)",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Sign Up
        </Link>
        <p style={{ marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--alzooka-gold)" }}>
            Try signing in again
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function NoProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <NoProfileContent />
    </Suspense>
  );
}
