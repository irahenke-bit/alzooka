"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackHandler() {
  const [status, setStatus] = useState("Processing...");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function handleCallback() {
      // Check for OAuth code in URL
      const code = searchParams.get("code");
      
      if (code) {
        // Exchange the code for a session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error("Code exchange error:", exchangeError);
          setStatus("Authentication failed. Redirecting to login...");
          setTimeout(() => router.push("/login"), 1500);
          return;
        }
      }

      // Now get the user
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        setStatus("Authentication failed. Redirecting to login...");
        setTimeout(() => router.push("/login"), 1500);
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
        // No profile, redirect to no-profile page with email
        router.push(`/auth/no-profile?email=${encodeURIComponent(user.email || "")}`);
      }
    }

    handleCallback();
  }, [supabase, router, searchParams]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <p>{status}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Processing...</div>}>
      <CallbackHandler />
    </Suspense>
  );
}
