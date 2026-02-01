"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogoWithText } from "@/app/components/Logo";
import Link from "next/link";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Get code from URL (PKCE flow)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const errorParam = urlParams.get("error");
        const errorDesc = urlParams.get("error_description");

        // Clear any localStorage signup flags
        localStorage.removeItem("alzooka_signup");
        
        if (errorParam) {
          setErrorMsg(errorDesc || errorParam);
          setStatus("error");
          return;
        }
        
        if (code) {
          // Exchange code for session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMsg(error.message);
            setStatus("error");
            return;
          }
        }
        
        // Check for hash tokens (implicit flow)
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          // Wait for Supabase to process
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setErrorMsg("No session established");
          setStatus("error");
          return;
        }
        
        const user = session.user;
        
        // Check for profile
        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          // User already has a profile, go to home
          router.push("/");
        } else {
          // No profile - send to complete-profile page to create one
          router.push("/auth/complete-profile");
        }
      } catch (err) {
        setErrorMsg(String(err));
        setStatus("error");
      }
    }
    
    handleCallback();
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
        background: "var(--bg-card)",
        borderRadius: 12,
        textAlign: "center",
        maxWidth: 400,
      }}>
        <p style={{ marginBottom: 16, color: "#0165FC" }}>
          Authentication failed: {errorMsg}
        </p>
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
