"use client";

import { useState, useEffect, Suspense } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogoWithText } from "@/app/components/Logo";

function CompleteProfileContent() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
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

    // Check if user already has a profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profile) {
      // Already has profile, go to feed
      router.push("/");
      return;
    }

    // Pre-fill display name from email if available
    const emailPrefix = user.email?.split("@")[0] || "";
    if (emailPrefix) {
      setDisplayName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
    }

    setChecking(false);
  }

  // Check username availability with debounce
  useEffect(() => {
    if (!username.trim() || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("id")
        .ilike("username", username.trim())
        .single();
      
      setUsernameAvailable(!data);
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Please enter a display name");
      return;
    }

    if (!username.trim() || username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    if (usernameAvailable === false) {
      setError("That username is already taken");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
          avatar_url: null,
          bio: null,
        });

      if (insertError) {
        if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
          setError("That username is already taken");
        } else {
          setError(insertError.message);
        }
        setLoading(false);
        return;
      }

      // Success! Go to feed
      router.push("/");
    } catch (err) {
      console.error("Error creating profile:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
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
          Welcome! 🎉
        </h1>
        <p style={{ 
          fontSize: 14, 
          opacity: 0.7, 
          marginBottom: 32,
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          Let&apos;s set up your profile. Choose a display name and username.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14,
              fontWeight: 500,
            }}>
              Display Name
            </label>
            <input
              type="text"
              placeholder="How you want to be called"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              style={{ width: "100%" }}
            />
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              This is shown on your profile and posts
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 6, 
              fontSize: 14,
              fontWeight: 500,
            }}>
              Username
            </label>
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.5,
                fontSize: 14,
              }}>
                @
              </span>
              <input
                type="text"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                maxLength={30}
                style={{ width: "100%", paddingLeft: 28 }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <p style={{ fontSize: 12, opacity: 0.6 }}>
                Letters, numbers, underscores only
              </p>
              {username.length >= 3 && usernameAvailable !== null && (
                <p style={{ 
                  fontSize: 12, 
                  color: usernameAvailable ? "#81c784" : "#e57373",
                }}>
                  {usernameAvailable ? "✓ Available" : "✗ Taken"}
                </p>
              )}
            </div>
          </div>

          {error && (
            <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}

          <button 
            type="submit" 
            disabled={loading || usernameAvailable === false}
            style={{ width: "100%" }}
          >
            {loading ? "Creating profile..." : "Create My Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
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
      <CompleteProfileContent />
    </Suspense>
  );
}
