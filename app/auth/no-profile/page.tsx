"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoWithText } from "@/app/components/Logo";
import { Suspense, useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function NoProfileContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your Google account";
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    // Check if this was a signup flow
    const isSignup = localStorage.getItem("alzooka_signup") === "true";
    localStorage.removeItem("alzooka_signup");

    if (isSignup) {
      // Auto-create profile
      setIsCreating(true);
      createProfile();
    }

    async function createProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsCreating(false);
        return;
      }

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (existingProfile) {
        router.push("/");
        return;
      }

      // Generate username from Google name or email
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name;
      const emailPrefix = user.email?.split("@")[0] || "user";
      let baseUsername = googleName
        ? googleName.toLowerCase().replace(/[^a-z0-9_]/g, "_").substring(0, 20)
        : emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "_").substring(0, 20);

      // Make username unique
      let username = baseUsername;
      let attempt = 0;
      while (attempt < 100) {
        const { data: existing } = await supabase
          .from("users")
          .select("username")
          .eq("username", username)
          .single();

        if (!existing) break;
        attempt++;
        username = `${baseUsername}${attempt}`;
      }

      // Create the profile
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          username: username,
          display_name: googleName || emailPrefix,
          email: user.email,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          terms_accepted_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Failed to create profile:", insertError);
        setIsCreating(false);
        return;
      }

      // Success - go to feed
      router.push("/");
    }
  }, [supabase, router]);

  if (isCreating) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <LogoWithText />
        <p style={{ marginTop: 24 }}>Creating your profile...</p>
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
          No Profile Found
        </h2>
        <p style={{ marginBottom: 24, lineHeight: 1.6, color: "var(--alzooka-cream)" }}>
          No profile has been found associated with this Google account: <strong>{email}</strong>
        </p>
        <p style={{ marginBottom: 24, lineHeight: 1.6, color: "var(--text-muted)" }}>
          Please sign up to create your Alzooka profile.
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

export default function NoProfilePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <NoProfileContent />
    </Suspense>
  );
}
