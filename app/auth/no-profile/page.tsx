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
  const [status, setStatus] = useState<"checking" | "creating" | "error" | "no-auth">("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    // Clear any signup flag
    localStorage.removeItem("alzooka_signup");
    
    // Always try to create profile for authenticated users without one
    createProfileIfNeeded();

    async function createProfileIfNeeded() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setStatus("no-auth");
          return;
        }

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (existingProfile) {
          // Profile exists, go to feed
          router.push("/");
          return;
        }

        // No profile - create one
        setStatus("creating");

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
          setErrorMsg(insertError.message);
          setStatus("error");
          return;
        }

        // Success - go to feed
        router.push("/");
      } catch (err) {
        console.error("Error:", err);
        setErrorMsg(String(err));
        setStatus("error");
      }
    }
  }, [supabase, router]);

  if (status === "checking" || status === "creating") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <LogoWithText />
        <p style={{ marginTop: 24 }}>
          {status === "checking" ? "Checking account..." : "Creating your profile..."}
        </p>
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
        textAlign: "center",
      }}>
        <LogoWithText />
        <div style={{
          marginTop: 40,
          padding: 32,
          background: "var(--alzooka-teal-dark)",
          borderRadius: 12,
          maxWidth: 400,
        }}>
          <h2 style={{ marginBottom: 16, color: "#e57373" }}>Profile Creation Failed</h2>
          <p style={{ marginBottom: 16, color: "var(--alzooka-cream)" }}>{errorMsg}</p>
          <p style={{ marginBottom: 24, color: "var(--text-muted)" }}>
            Please try again or contact support.
          </p>
          <Link href="/signup" style={{ color: "var(--alzooka-gold)" }}>
            Back to Sign Up
          </Link>
        </div>
      </div>
    );
  }

  // status === "no-auth" - show the original no profile page
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
