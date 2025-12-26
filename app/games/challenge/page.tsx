"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";

type User = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type UserData = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function ChallengePage() {
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedMode, setSelectedMode] = useState<"blitz" | "five_second">("blitz");
  const [allowSharing, setAllowSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);

  const supabase = createBrowserClient();
  const router = useRouter();

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

      // Get friends/followers for quick suggestions
      const { data: friendships } = await supabase
        .from("friendships")
        .select(`
          user_id,
          friend_id,
          friend:users!friendships_friend_id_fkey(id, username, avatar_url),
          user:users!friendships_user_id_fkey(id, username, avatar_url)
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted")
        .limit(10);

      if (friendships) {
        const friendList: User[] = [];
        for (const f of friendships) {
          const friendData = f.user_id === user.id ? f.friend : f.user;
          if (friendData && typeof friendData === "object") {
            const fd = friendData as unknown as { id: string; username: string; avatar_url: string | null };
            if (fd.id && fd.username) {
              friendList.push({
                id: fd.id,
                username: fd.username,
                avatar_url: fd.avatar_url || null,
              });
            }
          }
        }
        setFriends(friendList);
      }

      setLoading(false);
    }

    init();
  }, [supabase, router]);

  async function handleSearch() {
    if (!searchQuery.trim() || !currentUser) return;
    
    setSearching(true);
    const { data } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .ilike("username", `%${searchQuery}%`)
      .neq("id", currentUser.id)
      .limit(10);

    if (data) {
      setSearchResults(data);
    }
    setSearching(false);
  }

  async function sendChallenge() {
    if (!selectedUser || !currentUser) return;
    
    setSending(true);

    // Create the challenge
    const { error } = await supabase
      .from("trivia_challenges")
      .insert({
        challenger_id: currentUser.id,
        challenged_id: selectedUser.id,
        mode: selectedMode,
        challenger_allow_sharing: allowSharing,
      });

    if (error) {
      console.error("Failed to send challenge:", error);
      alert("Failed to send challenge. Please try again.");
      setSending(false);
      return;
    }

    // TODO: Send notification to challenged user

    alert(`Challenge sent to @${selectedUser.username}!`);
    router.push("/games");
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--alzooka-teal-dark)" }}>
      <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
      
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <Link href="/games" style={{ color: "var(--alzooka-cream)", opacity: 0.6, textDecoration: "none", fontSize: 14 }}>
          ← Back to Games
        </Link>

        <h1 style={{ fontSize: 28, margin: "16px 0 24px", color: "var(--alzooka-gold)" }}>
          🎯 Challenge a Friend
        </h1>

        {/* Step 1: Select opponent */}
        {!selectedUser ? (
          <div>
            {/* Search */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
                Search for a player
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter username..."
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    fontSize: 16,
                    background: "rgba(240, 235, 224, 0.1)",
                    border: "1px solid rgba(240, 235, 224, 0.2)",
                    borderRadius: 8,
                    color: "var(--alzooka-cream)",
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  style={{
                    padding: "12px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    background: "var(--alzooka-gold)",
                    color: "var(--alzooka-teal-dark)",
                    border: "none",
                    borderRadius: 8,
                    cursor: searchQuery.trim() ? "pointer" : "not-allowed",
                    opacity: searchQuery.trim() ? 1 : 0.5,
                  }}
                >
                  {searching ? "..." : "Search"}
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, opacity: 0.8, marginBottom: 12 }}>Search Results</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        background: "rgba(240, 235, 224, 0.05)",
                        border: "1px solid rgba(240, 235, 224, 0.1)",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "var(--alzooka-cream)",
                      }}
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                      ) : (
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "rgba(240, 235, 224, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          👤
                        </div>
                      )}
                      <span style={{ fontWeight: 600 }}>@{user.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Friends suggestions */}
            {friends.length > 0 && searchResults.length === 0 && (
              <div>
                <h3 style={{ fontSize: 14, opacity: 0.8, marginBottom: 12 }}>Your Friends</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {friends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => setSelectedUser(friend)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        background: "rgba(240, 235, 224, 0.05)",
                        border: "1px solid rgba(240, 235, 224, 0.1)",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "var(--alzooka-cream)",
                      }}
                    >
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                      ) : (
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "rgba(240, 235, 224, 0.2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          👤
                        </div>
                      )}
                      <span style={{ fontWeight: 600 }}>@{friend.username}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Configure challenge */
          <div>
            {/* Selected opponent */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              background: "rgba(240, 235, 224, 0.05)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }} />
                ) : (
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(240, 235, 224, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    👤
                  </div>
                )}
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>@{selectedUser.username}</p>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Your opponent</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  borderRadius: 6,
                  color: "var(--alzooka-cream)",
                  cursor: "pointer",
                }}
              >
                Change
              </button>
            </div>

            {/* Game mode selection */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
                Choose game mode
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => setSelectedMode("blitz")}
                  style={{
                    flex: 1,
                    padding: 16,
                    background: selectedMode === "blitz" ? "rgba(29, 185, 84, 0.2)" : "rgba(240, 235, 224, 0.05)",
                    border: selectedMode === "blitz" ? "2px solid #1DB954" : "2px solid rgba(240, 235, 224, 0.1)",
                    borderRadius: 12,
                    cursor: "pointer",
                    color: "var(--alzooka-cream)",
                    textAlign: "left",
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontWeight: 600 }}>⚡ Blitz</p>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>2 min, unlimited Qs</p>
                </button>
                <button
                  onClick={() => setSelectedMode("five_second")}
                  style={{
                    flex: 1,
                    padding: 16,
                    background: selectedMode === "five_second" ? "rgba(229, 115, 115, 0.2)" : "rgba(240, 235, 224, 0.05)",
                    border: selectedMode === "five_second" ? "2px solid #e57373" : "2px solid rgba(240, 235, 224, 0.1)",
                    borderRadius: 12,
                    cursor: "pointer",
                    color: "var(--alzooka-cream)",
                    textAlign: "left",
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontWeight: 600 }}>⏱️ Five Second</p>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>10 Qs, 5 sec each</p>
                </button>
              </div>
            </div>

            {/* Sharing consent */}
            <div style={{
              padding: 16,
              background: "rgba(240, 235, 224, 0.05)",
              borderRadius: 12,
              marginBottom: 24,
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
                    If both players agree, the winner can share the result publicly. 
                    If only you agree, your name will be shown as &quot;unknown opponent&quot; to others.
                  </p>
                </div>
              </label>
            </div>

            {/* Send challenge button */}
            <button
              onClick={sendChallenge}
              disabled={sending}
              style={{
                width: "100%",
                padding: 16,
                fontSize: 18,
                fontWeight: 700,
                background: "var(--alzooka-gold)",
                color: "var(--alzooka-teal-dark)",
                border: "none",
                borderRadius: 12,
                cursor: sending ? "not-allowed" : "pointer",
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? "Sending..." : `Challenge @${selectedUser.username}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

