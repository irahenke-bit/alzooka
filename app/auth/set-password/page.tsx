"use client";

import { useState, useEffect, Suspense } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogoWithText } from "@/app/components/Logo";

function SetPasswordContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    // Check if user has a profile (they should after complete-profile)
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // No profile yet, go back to complete-profile
      router.push("/auth/complete-profile");
      return;
    }

    setEmail(user.email || "");
    setChecking(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter a password");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least 1 uppercase letter");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError("Password must contain at least 1 special character");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Update has_password flag in users table
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({ has_password: true })
          .eq("id", user.id);
      }

      // Success! Go to feed
      router.push("/");
    } catch (err) {
      console.error("Error setting password:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleSkip() {
    // User can skip and just use magic link forever
    router.push("/");
  }

  if (checking) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center" 
      }}>
        <p>Loading...</p>
      </div>
    );
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
      <div style={{ marginBottom: 40 }}>
        <LogoWithText />
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 600, 
          marginBottom: 8,
          textAlign: "center",
        }}>
          Set Your Password 🔐
        </h1>
        <p style={{ 
          fontSize: 14, 
          color: "rgba(255,255,255,0.7)", 
          marginBottom: 32,
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          Create a password so you can sign in easily next time without needing an email link.
        </p>

        {/* Hidden email field for browser password managers */}
        <form onSubmit={handleSubmit} autoComplete="on">
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14,
              fontWeight: 500,
            }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              readOnly
              style={{ 
                width: "100%", 
                color: "rgba(255,255,255,0.7)",
                cursor: "not-allowed",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14,
              fontWeight: 500,
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              8+ characters, 1 uppercase, 1 special character
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14,
              fontWeight: 500,
            }}>
              Confirm Password
            </label>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          {error && (
            <p style={{ color: "#0165FC", marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: "100%", marginBottom: 12 }}
          >
            {loading ? "Saving..." : "Save Password"}
          </button>

          <button 
            type="button"
            onClick={handleSkip}
            style={{ 
              width: "100%",
              background: "linear-gradient(135deg, #000000 0%, #000000 100%)",
              border: "2px solid var(--accent)",
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Continue without password
          </button>
          <p style={{ 
            fontSize: 13, 
            color: "rgba(255,255,255,0.7)", 
            marginTop: 10,
            textAlign: "center",
            lineHeight: 1.5,
          }}>
            You can always sign in with an email link.<br />
            You can also create a password later in your settings.
          </p>
        </form>

        <p style={{ 
          fontSize: 12, 
          color: "rgba(255,255,255,0.5)", 
          marginTop: 24,
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          Your browser should offer to save your password automatically.
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center" 
      }}>
        <p>Loading...</p>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  );
}
