"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogoWithText } from "@/app/components/Logo";
import Link from "next/link";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "no-profile" | "error">("loading");
  const [email, setEmail] = useState("");
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
          router.push("/");
        } else {
          setEmail(user.email || "your account");
          setStatus("no-profile");
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

  if (status === "error") {
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
          background: "var(--alzooka-teal-dark)",
          borderRadius: 12,
          textAlign: "center",
          maxWidth: 400,
        }}>
          <p style={{ marginBottom: 16, color: "#e57373" }}>
            Authentication failed: {errorMsg}
          </p>
          <Link href="/login" style={{ color: "var(--alzooka-gold)" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // no-profile
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
        border: "1px solid var(--alzooka-gold)",
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
          Wrong account?{" "}
          <Link href="/login" style={{ color: "var(--alzooka-gold)" }}>
            Try again
          </Link>
        </p>
      </div>
    </div>
  );
}
