"use client";

import { useState, useEffect, Suspense } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { LogoWithText } from "@/app/components/Logo";

// Generate username from display name with numbering rules:
// - First person: blazefoley (no number)
// - Second: blazefoley01, then blazefoley06, blazefoley11, etc. (increment by 5)
// - When 2-digit exhausted (96), move to 3-digit: 101, 106, etc.
async function generateUsername(displayName: string, supabase: ReturnType<typeof createBrowserClient>): Promise<string> {
  // Create base username from display name
  const baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Remove spaces and special chars
    .substring(0, 20); // Limit length
  
  if (!baseUsername || baseUsername.length < 2) {
    return `user${Date.now().toString().slice(-6)}`;
  }

  // Check if base username is available
  const { data: exactMatch } = await supabase
    .from("users")
    .select("username")
    .eq("username", baseUsername)
    .single();

  if (!exactMatch) {
    return baseUsername; // First person gets clean username
  }

  // Find all existing usernames with this base
  const { data: existingUsers } = await supabase
    .from("users")
    .select("username")
    .ilike("username", `${baseUsername}%`);

  // Extract the highest number suffix used
  let highestNumber = 0;
  const regex = new RegExp(`^${baseUsername}(\\d+)$`, "i");
  
  if (existingUsers) {
    for (const user of existingUsers) {
      const match = user.username.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > highestNumber) {
          highestNumber = num;
        }
      }
    }
  }

  // Calculate next number (increment by 5, minimum 2 digits starting at 01)
  let nextNumber: number;
  if (highestNumber === 0) {
    // No numbered versions exist yet, start at 01
    nextNumber = 1;
  } else {
    // Find next number that's at least 5 more than highest
    nextNumber = highestNumber + 5;
    // Round up to next multiple of 5 that ends in 1 or 6
    const remainder = nextNumber % 5;
    if (remainder !== 1 && remainder !== 0) {
      nextNumber = nextNumber + (5 - remainder) + 1;
    }
  }

  // Format with minimum 2 digits
  const suffix = nextNumber.toString().padStart(2, "0");
  
  return `${baseUsername}${suffix}`;
}

function CompleteProfileContent() {
  const [displayName, setDisplayName] = useState("");
  const [generatedUsername, setGeneratedUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [generatingUsername, setGeneratingUsername] = useState(false);
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
      const formatted = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
      setDisplayName(formatted);
    }

    setChecking(false);
  }

  // Generate username when display name changes
  useEffect(() => {
    if (!displayName.trim() || displayName.length < 2) {
      setGeneratedUsername("");
      return;
    }

    const timer = setTimeout(async () => {
      setGeneratingUsername(true);
      const username = await generateUsername(displayName.trim(), supabase);
      setGeneratedUsername(username);
      setGeneratingUsername(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [displayName, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Please enter a display name");
      return;
    }

    if (!generatedUsername) {
      setError("Please wait for username to be generated");
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

      // Generate fresh username at submit time to avoid race conditions
      const finalUsername = await generateUsername(displayName.trim(), supabase);

      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          username: finalUsername,
          display_name: displayName.trim(),
          avatar_url: null,
          bio: null,
          has_password: false,
        });

      if (insertError) {
        if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
          setError("Username conflict - please try again");
          // Regenerate username
          const newUsername = await generateUsername(displayName.trim(), supabase);
          setGeneratedUsername(newUsername);
        } else {
          setError(insertError.message);
        }
        setLoading(false);
        return;
      }

      // Success! Go to set password page so they can create a password for easy future logins
      router.push("/auth/set-password");
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
          <div style={{ marginBottom: 24 }}>
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
              placeholder="Your name (e.g. Blaze Foley)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              style={{ width: "100%" }}
              autoFocus
            />
            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
              This is how your name appears on posts and your profile
            </p>
          </div>

          {/* Username Preview */}
          {displayName.trim().length >= 2 && (
            <div style={{ 
              marginBottom: 24,
              padding: 16,
              background: "rgba(240, 235, 224, 0.05)",
              borderRadius: 8,
              border: "1px solid rgba(240, 235, 224, 0.1)",
            }}>
              <p style={{ 
                fontSize: 13, 
                opacity: 0.7, 
                marginBottom: 8,
              }}>
                Your username will be:
              </p>
              <p style={{ 
                fontSize: 18, 
                fontWeight: 600,
                color: "var(--alzooka-gold)",
              }}>
                {generatingUsername ? (
                  <span style={{ opacity: 0.5 }}>generating...</span>
                ) : (
                  `@${generatedUsername}`
                )}
              </p>
              <p style={{ fontSize: 12, opacity: 0.5, marginTop: 8 }}>
                Others can mention you with this @username
              </p>
            </div>
          )}

          {error && (
            <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
              {error}
            </p>
          )}

          <button 
            type="submit" 
            disabled={loading || generatingUsername || !generatedUsername}
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
