"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { signupSchema, getFirstZodError } from "@/lib/validation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate form data with Zod
    const result = signupSchema.safeParse({
      username,
      email,
      password,
    });

    if (!result.success) {
      setError(getFirstZodError(result.error));
      setLoading(false);
      return;
    }

    const { username: validatedUsername, email: validatedEmail } = result.data;

    // Check if username is taken
    const { data: existingUser } = await supabase
      .from("users")
      .select("username")
      .eq("username", validatedUsername.toLowerCase())
      .single();

    if (existingUser) {
      setError("Username is already taken");
      setLoading(false);
      return;
    }

    // Sign up with Supabase Auth (profile created automatically via trigger)
    const { error: signUpError } = await supabase.auth.signUp({
      email: validatedEmail,
      password,
      options: {
        data: {
          username: validatedUsername,
          display_name: validatedUsername,
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Success - redirect to feed
    router.push("/");
    router.refresh();
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

      {/* Signup Form */}
      <form onSubmit={handleSignup} style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            required
          />
        </div>

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
            placeholder="Password (8+ chars, 1 uppercase, 1 special)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {error && (
          <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 14 }}>
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </p>

      <p className="text-muted" style={{ marginTop: 32, fontSize: 12, textAlign: "center", maxWidth: 300 }}>
        By signing up, you agree to maintain one identity and act in good faith.
      </p>
    </div>
  );
}

