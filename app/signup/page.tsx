"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!termsAccepted) {
      setError("You must agree to the Terms and Conditions to create an account");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      setLoading(false);
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError("Password must contain at least one special character");
      setLoading(false);
      return;
    }

    const termsAcceptedAt = new Date().toISOString();

    // Sign up with Supabase Auth - store metadata for later profile creation
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          terms_accepted_at: termsAcceptedAt,
          signup_method: "password",
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Check if email confirmation is required
    if (signUpData.user && !signUpData.session) {
      setLoading(false);
      setSuccess("Check your email! Click the link to verify your account and complete your profile.");
      return;
    }

    // No email confirmation required - go to complete profile
    router.push("/auth/complete-profile");
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    
    if (!termsAccepted) {
      setError("You must agree to the Terms and Conditions to create an account");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Check your email! Click the link to complete your account setup.");
    }
    setLoading(false);
  }

  async function handleGoogleSignUp() {
    if (!termsAccepted) {
      setError("You must agree to the Terms and Conditions to create an account");
      return;
    }

    setLoading(true);
    setError("");

    localStorage.setItem("alzooka_signup", "true");
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      localStorage.removeItem("alzooka_signup");
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
      <div style={{ marginBottom: 40 }}>
        <LogoWithText />
      </div>

      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Google Sign Up Button - Brand colors allowed */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={loading}
          style={{
            width: "100%",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            background: "#ffffff",
            color: "#1f1f1f",
            border: "1px solid #dadce0",
            fontWeight: 500,
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

        {/* Email Link Button - Light solid provider style (secondary) */}
        <button
          type="button"
          onClick={() => { setShowMagicLink(true); setError(""); setSuccess(""); }}
          disabled={loading}
          style={{
            width: "100%",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "10px 16px",
            background: "#f2f2f2",
            color: "#1f1f1f",
            border: "1px solid #dadce0",
            fontWeight: 500,
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#e8e8e8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f2f2f2";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.background = "#dedede";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.background = "#e8e8e8";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f1f1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M22 7l-10 6L2 7"/>
          </svg>
          Sign up with Email Link
        </button>

        {/* Magic Link Form */}
        {showMagicLink && (
          <div style={{
            marginBottom: 24,
            padding: 16,
            background: "rgba(240, 235, 224, 0.05)",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
          }}>
            <form onSubmit={handleMagicLink}>
              <p style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                Enter your email and we'll send you a link to create your account — no password needed!
              </p>
              
              <div style={{ marginBottom: 12 }}>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Terms checkbox for magic link */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ 
                  display: "flex", 
                  alignItems: "flex-start", 
                  gap: 10, 
                  cursor: "pointer",
                  fontSize: 13,
                }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{ 
                      marginTop: 2,
                      width: 16, 
                      height: 16, 
                      accentColor: "var(--accent)",
                    }}
                  />
                  <span>
                    I agree to the{" "}
                    <Link 
                      href="/terms" 
                      target="_blank"
                      style={{ color: "var(--accent)" }}
                    >
                      Terms and Conditions
                    </Link>
                  </span>
                </label>
              </div>

              {error && showMagicLink && (
                <p style={{ color: "#0165FC", marginBottom: 12, fontSize: 14 }}>
                  {error}
                </p>
              )}

              {success && (
                <>
                  <p style={{ color: "#0165FC", marginBottom: 8, fontSize: 14 }}>
                    ✓ {success}
                  </p>
                  <div style={{
                    background: "rgba(201, 162, 92, 0.15)",
                    border: "1px solid rgba(201, 162, 92, 0.4)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                  }}>
                    <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                      📬 <strong>Check your spam folder!</strong> We're a new community and some email providers are still learning to trust us. If you don't see our email in your inbox, please check your spam/junk folder.
                    </p>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button 
                  type="button" 
                  onClick={() => { setShowMagicLink(false); setError(""); setSuccess(""); }}
                  style={{ 
                    flex: 1,
                    background: "transparent",
                    border: "1px solid var(--border-hover)",
                    color: "#ffffff",
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} style={{ flex: 2 }}>
                  {loading ? "Sending..." : "Send Link"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Divider */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          marginBottom: 24,
          gap: 16 
        }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>or create with password</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
        </div>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div style={{ marginBottom: 16, position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password (8+ chars, 1 uppercase, 1 special)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              style={{ paddingRight: 60 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--accent)",
                fontSize: 13,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: "flex", 
              alignItems: "flex-start", 
              gap: 10, 
              cursor: "pointer",
              fontSize: 14,
            }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ 
                  marginTop: 2,
                  width: 18, 
                  height: 18, 
                  accentColor: "var(--accent)",
                  cursor: "pointer",
                }}
              />
              <span>
                I agree to the{" "}
                <Link 
                  href="/terms" 
                  target="_blank"
                  style={{ color: "var(--accent)", textDecoration: "underline" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms and Conditions
                </Link>
              </span>
            </label>
          </div>

          {error && !showMagicLink && (
            <p style={{ color: "#0165FC", marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}

          {success && !showMagicLink && (
            <>
              <p style={{ color: "#0165FC", marginBottom: 8, fontSize: 14 }}>
                ✓ {success}
              </p>
              <div style={{
                background: "rgba(201, 162, 92, 0.15)",
                border: "1px solid rgba(201, 162, 92, 0.4)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  📬 <strong>Check your spam folder!</strong> We're a new community and some email providers are still learning to trust us. If you don't see our email in your inbox, please check your spam/junk folder.
                </p>
              </div>
            </>
          )}

          <button type="submit" disabled={loading || !!success} style={{ width: "100%" }}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
