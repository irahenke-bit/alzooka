"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"password" | "magic">("password");
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email! We sent you a magic link to sign in.");
    }
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
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

        {/* Login Mode Toggle */}
        <div style={{ 
          display: "flex", 
          marginBottom: 16,
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(240, 235, 224, 0.2)",
        }}>
          <button
            type="button"
            onClick={() => { setLoginMode("password"); setError(""); setSuccess(""); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: loginMode === "password" ? "var(--alzooka-gold)" : "transparent",
              color: loginMode === "password" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode("magic"); setError(""); setSuccess(""); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: loginMode === "magic" ? "var(--alzooka-gold)" : "transparent",
              color: loginMode === "magic" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Magic Link
          </button>
        </div>

        {loginMode === "password" ? (
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
        ) : (
          <form onSubmit={handleMagicLink}>
            <div style={{ marginBottom: 16 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <p style={{ 
              fontSize: 13, 
              opacity: 0.7, 
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              We&apos;ll send you a link to sign in instantly — no password needed.
            </p>

            {error && (
              <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
                {error}
              </p>
            )}

            {success && (
              <p style={{ color: "#81c784", marginBottom: 16, fontSize: 14 }}>
                {success}
              </p>
            )}

            <button type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup">Sign up</Link>
      </p>
    </div>
  );
}

