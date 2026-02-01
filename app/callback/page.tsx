"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogoWithText } from "@/app/components/Logo";
import Link from "next/link";

export default function CallbackPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function handleAuth() {
      try {
        // Check for code in URL (PKCE flow)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Code exchange failed:", error);
            setStatus("error");
            return;
          }
        }

        // Check for hash tokens (implicit flow)
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          // Supabase client auto-handles this, just wait
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Now check for user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setStatus("error");
          return;
        }

        // Check for profile
        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (profile) {
          // Has profile, go home
          router.push("/");
        } else {
          // No profile - go to complete profile page
          router.push("/auth/complete-profile");
        }
      } catch (err) {
        console.error("Auth error:", err);
        setStatus("error");
      }
    }

    handleAuth();
  }, [supabase, router]);

  if (status === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <LogoWithText />
        <p style={{ marginTop: 24 }}>Signing you in...</p>
      </div>
    );
  }

  // Error state
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <LogoWithText />
      <div style={{
        marginTop: 40,
        padding: 24,
        background: "var(--bg-header)",
        borderRadius: 12,
        textAlign: "center",
      }}>
        <p style={{ marginBottom: 16, color: "#e57373" }}>Authentication failed. Please try again.</p>
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
