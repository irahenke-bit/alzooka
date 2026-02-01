"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";
import Link from "next/link";
import { notifyTriviaChallenge } from "@/lib/notifications";

type User = {
  id: string;
  username: string;
  display_name?: string | null;
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
  const [allowSharing, setAllowSharing] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);

  const supabase = createBrowserClient();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
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
          requester_id,
          addressee_id,
          requester:users!friendships_requester_id_fkey(id, username, display_name, avatar_url),
          addressee:users!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted")
        .limit(10);

      if (friendships) {
        const friendList: User[] = [];
        for (const f of friendships) {
          const friendData = f.requester_id === user.id ? f.addressee : f.requester;
          if (friendData && typeof friendData === "object") {
            const fd = friendData as unknown as { id: string; username: string; display_name?: string | null; avatar_url: string | null };
            if (fd.id && fd.username) {
              friendList.push({
                id: fd.id,
                username: fd.username,
                display_name: fd.display_name,
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
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
      .neq("id", currentUser.id)
      .neq("is_active", false)
      .limit(10);

    if (data) {
      setSearchResults(data);
    }
    setSearching(false);
  }

  async function sendChallenge() {
    if (!selectedUser || !currentUser || !userData) return;
    
    setSending(true);

    // Create the challenge
    const { data: challenge, error } = await supabase
      .from("trivia_challenges")
      .insert({
        challenger_id: currentUser.id,
        challenged_id: selectedUser.id,
        mode: selectedMode,
        challenger_allow_sharing: allowSharing,
      })
      .select("id")
      .single();

    if (error || !challenge) {
      console.error("Failed to send challenge:", error);
      alert("Failed to send challenge. Please try again.");
      setSending(false);
      return;
    }

    // Send notification to challenged user
    await notifyTriviaChallenge(
      supabase,
      selectedUser.id,
      userData.username,
      currentUser.id,
      challenge.id,
      selectedMode
    );

    alert(`Challenge sent to @${selectedUser.username}! You'll be notified when they accept so you can play your turn.`);
    router.push("/games");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-card)" }}>
        <Header user={currentUser} userUsername={null} userAvatarUrl={null} />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <p style={{ color: "#ffffff", opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-card)" }}>
      <Header user={currentUser} userUsername={userData?.username || null} userAvatarUrl={userData?.avatar_url || null} />
      
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px" }}>
        <Link href="/games" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 14 }}>
          ← Back to Games
        </Link>

        <h1 style={{ fontSize: 28, margin: "16px 0 24px", color: "var(--accent)" }}>
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
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    color: "#ffffff",
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  style={{
                    padding: "12px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    background: "var(--accent)",
                    color: "black",
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
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "#ffffff",
                      }}
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                      ) : (
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "var(--border-default)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          👤
                        </div>
                      )}
                      <div>
                        {user.display_name && <span style={{ fontWeight: 600 }}>{user.display_name}</span>}
                        <span style={{ fontWeight: user.display_name ? 400 : 600, opacity: user.display_name ? 0.7 : 1, marginLeft: user.display_name ? 6 : 0 }}>@{user.username}</span>
                      </div>
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
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        color: "#ffffff",
                      }}
                    >
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                      ) : (
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "var(--border-default)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          👤
                        </div>
                      )}
                      <div>
                        {friend.display_name && <span style={{ fontWeight: 600 }}>{friend.display_name}</span>}
                        <span style={{ fontWeight: friend.display_name ? 400 : 600, opacity: friend.display_name ? 0.7 : 1, marginLeft: friend.display_name ? 6 : 0 }}>@{friend.username}</span>
                      </div>
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
              background: "var(--bg-card)",
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
                    background: "var(--border-default)",
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
                  border: "1px solid var(--border-hover)",
                  borderRadius: 6,
                  color: "rgba(255,255,255,0.7)",
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
                    background: selectedMode === "blitz" ? "rgba(29, 185, 84, 0.2)" : "black",
                    border: selectedMode === "blitz" ? "2px solid #1DB954" : "2px solid var(--border-subtle)",
                    borderRadius: 12,
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.7)",
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
                    background: selectedMode === "five_second" ? "rgba(229, 115, 115, 0.2)" : "black",
                    border: selectedMode === "five_second" ? "2px solid #0165FC" : "2px solid var(--border-subtle)",
                    borderRadius: 12,
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.7)",
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
              background: "var(--bg-card)",
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allowSharing}
                  onChange={(e) => setAllowSharing(e.target.checked)}
                  style={{ marginTop: 4, width: 18, height: 18, accentColor: "var(--accent)" }}
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

            {/* How it works note */}
            <div style={{
              padding: 14,
              background: "rgba(29, 185, 84, 0.1)",
              border: "1px solid rgba(29, 185, 84, 0.3)",
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                <strong>How it works:</strong> @{selectedUser.username} will play first after accepting your challenge. 
                You'll get a notification when it's your turn to play!
              </p>
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
                background: "var(--accent)",
                color: "black",
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

