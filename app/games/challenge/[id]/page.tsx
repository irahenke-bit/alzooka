"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";

type Challenge = {
  id: string;
  challenger_id: string;
  challenged_id: string;
  mode: "blitz" | "five_second";
  challenger_allow_sharing: boolean;
  status: string;
  created_at: string;
  expires_at: string;
  challenger: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
};

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function AcceptChallengePage() {
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [allowSharing, setAllowSharing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient();
  const router = useRouter();
  const params = useParams();
  const challengeId = params.id as string;

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);

      // Get user data for header
      const { data: userInfo } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .single();
      
      if (userInfo) {
        setUserData(userInfo);
      }

      // Get challenge details
      const { data: challengeData, error: challengeError } = await supabase
        .from("trivia_challenges")
        .select(`
          id,
          challenger_id,
          challenged_id,
          mode,
          challenger_allow_sharing,
          status,
          created_at,
          expires_at
        `)
        .eq("id", challengeId)
        .single();

      if (challengeError || !challengeData) {
        setError("Challenge not found");
        setLoading(false);
        return;
      }

      // Check if this user is part of the challenge
      if (challengeData.challenged_id !== user.id && challengeData.challenger_id !== user.id) {
        setError("You are not part of this challenge");
        setLoading(false);
        return;
      }

      // Get challenger info
      const { data: challengerInfo } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", challengeData.challenger_id)
        .single();

      if (challengerInfo) {
        setChallenge({
          ...challengeData,
          challenger: challengerInfo,
        });
      }

      setLoading(false);
    }

    init();
  }, [supabase, router, challengeId]);

  async function acceptChallenge() {
    if (!challenge || !currentUser) return;
    
    setResponding(true);

    // Fetch questions for the game
    const { data: questions } = await supabase
      .from("trivia_questions")
      .select("id")
      .eq("is_approved", true)
      .limit(challenge.mode === "five_second" ? 10 : 50);

    if (!questions || questions.length === 0) {
      alert("No questions available. Please try again later.");
      setResponding(false);
      return;
    }

    const questionIds = questions.map(q => q.id);

    // Create the game - current user (accepter) is player1 for RLS purposes
    // The challenger info is preserved in the challenge record
    const { data: game, error: gameError } = await supabase
      .from("trivia_games")
      .insert({
        mode: challenge.mode,
        player1_id: currentUser.id,  // Accepter is player1 (RLS requires this)
        player2_id: challenge.challenger_id,  // Challenger is player2
        player1_allow_sharing: allowSharing,
        player2_allow_sharing: challenge.challenger_allow_sharing,
        question_ids: questionIds,
        status: "active",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (gameError || !game) {
      console.error("Failed to create game:", gameError);
      alert("Failed to create game. Please try again.");
      setResponding(false);
      return;
    }

    // Update challenge status and link game
    await supabase
      .from("trivia_challenges")
      .update({ status: "accepted", game_id: game.id })
      .eq("id", challenge.id);

    // Navigate to play the game
    router.push(`/games/play?gameId=${game.id}`);
  }

  async function declineChallenge() {
    if (!challenge) return;
    
    setResponding(true);

    await supabase
      .from("trivia_challenges")
      .update({ status: "declined" })
      .eq("id", challenge.id);

    router.push("/games");
  }

  function formatTimeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  function isExpired() {
    if (!challenge) return false;
    return new Date(challenge.expires_at) < new Date();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
        <Header user={currentUser} userUsername={null} userAvatarUrl={null} />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--alzooka-cream)", opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
        <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "var(--alzooka-cream)", marginBottom: 16 }}>{error || "Challenge not found"}</p>
          <Link href="/games" style={{ color: "var(--alzooka-gold)" }}>← Back to Games</Link>
        </div>
      </div>
    );
  }

  const isChallenger = currentUser?.id === challenge.challenger_id;
  const isChallenged = currentUser?.id === challenge.challenged_id;
  const isPending = challenge.status === "pending";
  const expired = isExpired();

  return (
    <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
      <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
      
      <main style={{ maxWidth: 500, margin: "0 auto", padding: "24px 16px" }}>
        <Link href="/games" style={{ color: "var(--alzooka-cream)", opacity: 0.6, textDecoration: "none", fontSize: 14 }}>
          ← Back to Games
        </Link>

        <div style={{
          marginTop: 24,
          padding: 24,
          background: "rgba(240, 235, 224, 0.05)",
          borderRadius: 16,
          border: "1px solid rgba(240, 235, 224, 0.1)",
          textAlign: "center",
        }}>
          {/* Challenge icon */}
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>

          {/* Challenger info */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
            {challenge.challenger.avatar_url ? (
              <img src={challenge.challenger.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: "50%" }} />
            ) : (
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(240, 235, 224, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
              }}>
                👤
              </div>
            )}
          </div>

          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
            {isChallenger ? (
              <>You challenged someone!</>
            ) : (
              <>@{challenge.challenger.username} challenged you!</>
            )}
          </h1>

          <p style={{ margin: "0 0 24px", opacity: 0.7, fontSize: 14 }}>
            {formatTimeAgo(challenge.created_at)}
          </p>

          {/* Game mode */}
          <div style={{
            display: "inline-block",
            padding: "12px 24px",
            background: challenge.mode === "blitz" ? "rgba(29, 185, 84, 0.2)" : "rgba(229, 115, 115, 0.2)",
            borderRadius: 12,
            marginBottom: 24,
          }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>
              {challenge.mode === "blitz" ? "⚡ Blitz Mode" : "⏱️ Five Second Mode"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>
              {challenge.mode === "blitz" ? "2 min, unlimited questions" : "10 questions, 5 sec each"}
            </p>
          </div>

          {/* Status messages */}
          {expired && isPending && (
            <div style={{
              padding: 16,
              background: "rgba(229, 115, 115, 0.2)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <p style={{ margin: 0, color: "#e57373" }}>This challenge has expired</p>
            </div>
          )}

          {challenge.status === "declined" && (
            <div style={{
              padding: 16,
              background: "rgba(229, 115, 115, 0.2)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <p style={{ margin: 0, color: "#e57373" }}>This challenge was declined</p>
            </div>
          )}

          {challenge.status === "accepted" && (
            <div style={{
              padding: 16,
              background: "rgba(29, 185, 84, 0.2)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <p style={{ margin: 0, color: "#1DB954" }}>Challenge accepted! Game in progress.</p>
            </div>
          )}

          {/* Actions for challenged user */}
          {isChallenged && isPending && !expired && (
            <>
              {/* Sharing consent */}
              <div style={{
                padding: 16,
                background: "rgba(240, 235, 224, 0.05)",
                borderRadius: 12,
                marginBottom: 24,
                textAlign: "left",
              }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={allowSharing}
                    onChange={(e) => setAllowSharing(e.target.checked)}
                    style={{ marginTop: 4, width: 18, height: 18, accentColor: "var(--alzooka-gold)" }}
                  />
                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14 }}>
                      Allow sharing results
                    </p>
                    <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                      If both agree, the winner can share publicly
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={declineChallenge}
                  disabled={responding}
                  style={{
                    flex: 1,
                    padding: 16,
                    fontSize: 16,
                    fontWeight: 600,
                    background: "transparent",
                    border: "2px solid rgba(229, 115, 115, 0.5)",
                    borderRadius: 12,
                    color: "#e57373",
                    cursor: responding ? "not-allowed" : "pointer",
                    opacity: responding ? 0.7 : 1,
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={acceptChallenge}
                  disabled={responding}
                  style={{
                    flex: 2,
                    padding: 16,
                    fontSize: 16,
                    fontWeight: 700,
                    background: "var(--alzooka-gold)",
                    color: "var(--alzooka-teal-dark)",
                    border: "none",
                    borderRadius: 12,
                    cursor: responding ? "not-allowed" : "pointer",
                    opacity: responding ? 0.7 : 1,
                  }}
                >
                  {responding ? "..." : "Accept & Play"}
                </button>
              </div>
            </>
          )}

          {/* Message for challenger */}
          {isChallenger && isPending && !expired && (
            <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
              Waiting for @{challenge.challenger.username === userData?.username ? "opponent" : challenge.challenger.username} to respond...
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

