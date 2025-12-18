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
          opacity: 0.7, 
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
                opacity: 0.7,
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
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
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
            <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
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
              background: "transparent",
              border: "1px solid rgba(240, 235, 224, 0.3)",
              color: "var(--alzooka-cream)",
              opacity: 0.7,
            }}
          >
            Skip for now (use email link to sign in)
          </button>
        </form>

        <p style={{ 
          fontSize: 12, 
          opacity: 0.5, 
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
