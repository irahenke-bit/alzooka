"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState("Processing...");
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function handleCallback() {
      // Give Supabase a moment to process the OAuth callback from URL hash
      await new Promise(resolve => setTimeout(resolve, 500));

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
  }, [supabase, router]);

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
