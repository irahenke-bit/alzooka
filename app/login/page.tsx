"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [noProfileEmail, setNoProfileEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  // Check if user is authenticated but has no profile
  useEffect(() => {
    async function checkAuthState() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // User is authenticated - check if they have a profile
        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          // Has profile, redirect to home
          router.push("/");
        } else {
          // Authenticated but no profile - show the message
          setNoProfileEmail(user.email || "your account");
        }
      }
    }
    
    checkAuthState();
  }, [supabase, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center",
      padding: 20 
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40 }}>
        <LogoWithText />
      </div>

      {/* No Profile Message */}
      {noProfileEmail && (
        <div style={{
          width: "100%",
          maxWidth: 400,
          marginBottom: 32,
          padding: 24,
          background: "var(--alzooka-teal-dark)",
          borderRadius: 12,
          border: "1px solid var(--alzooka-gold)",
          textAlign: "center",
        }}>
          <h2 style={{ marginBottom: 12, fontSize: 20, color: "var(--alzooka-gold)" }}>
            Account Not Found
          </h2>
          <p style={{ marginBottom: 16, lineHeight: 1.6, color: "var(--alzooka-cream)" }}>
            We could not find a profile associated with <strong>{noProfileEmail}</strong>.
          </p>
          <p style={{ marginBottom: 20, lineHeight: 1.6, color: "var(--text-muted)", fontSize: 14 }}>
            Please sign up to create your Alzooka account.
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
        </div>
      )}

      {/* Login Form */}
      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: "100%",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            backgroundColor: "#fff",
            color: "#1a3a4a",
            border: "2px solid var(--alzooka-gold)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          marginBottom: 24,
          gap: 16 
        }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}

