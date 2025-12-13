"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";

export default function AuthCallbackPage() {
  const [checking, setChecking] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function checkProfile() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // No auth user, redirect to login
        router.push("/login");
        return;
      }

      // Check if user has a profile in the users table
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (profile) {
        // Profile exists, redirect to home
        router.push("/");
      } else {
        // No profile found - show message
        setUserEmail(user.email || "your Google account");
        setNoProfile(true);
        setChecking(false);
      }
    }

    checkProfile();
  }, [supabase, router]);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p>Checking your account...</p>
      </div>
    );
  }

  if (noProfile) {
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
            We could not find a profile associated with <strong>{userEmail}</strong>.
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

  return null;
}
