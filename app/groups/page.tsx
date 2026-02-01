"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import Header from "@/app/components/Header";

type Group = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  privacy: "public" | "private";
  created_at: string;
  member_count: number;
  is_member: boolean;
};

export default function GroupsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<"public" | "private">("public");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    let groupsSubscription: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      
      if (!user) {
        router.push("/login");
        return;
      }
      
      setUser(user);

      // Get username and avatar
      const { data: userData } = await supabase
        .from("users")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();
      if (userData) {
        setUserUsername(userData.username);
        setUserAvatarUrl(userData.avatar_url);
      }

      // eslint-disable-next-line react-hooks/immutability
      await loadGroups(user.id);
      setLoading(false);

      // Subscribe to group changes (inserts and deletes)
      groupsSubscription = supabase
        .channel('groups-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'groups'
          },
          async () => {
            try {
              // Refresh groups list whenever a group is created or deleted
              await loadGroups(user.id);
            } catch (err) {
              console.error("Error in groups subscription:", err);
            }
          }
        )
        .subscribe();

      // Refresh when page becomes visible (in case user had page open when group was deleted)
      const handleVisibilityChange = async () => {
        try {
          if (document.visibilityState === 'visible') {
            await loadGroups(user.id);
          }
        } catch (err) {
          console.error("Error in visibility handler:", err);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Cleanup
      return () => {
        if (groupsSubscription) {
          supabase.removeChannel(groupsSubscription);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    init();
  }, []);

  // Global escape key handler as a failsafe to close any stuck modal
  useEffect(() => {
    function handleGlobalEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowCreateModal(false);
      }
    }
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, []);

  async function loadGroups(userId: string) {
    // Get user's memberships first
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);

    const memberGroupIds = new Set(memberships?.map(m => m.group_id) || []);

    // Get all public groups
    const { data: publicGroups } = await supabase
      .from("groups")
      .select(`
        id,
        name,
        description,
        avatar_url,
        privacy,
        created_at
      `)
      .eq("privacy", "public")
      .order("created_at", { ascending: false });

    // Get private groups user is a member of
    const { data: myPrivateGroups } = await supabase
      .from("groups")
      .select(`
        id,
        name,
        description,
        avatar_url,
        privacy,
        created_at
      `)
      .eq("privacy", "private")
      .in("id", Array.from(memberGroupIds).length > 0 ? Array.from(memberGroupIds) : ['00000000-0000-0000-0000-000000000000'])
      .order("created_at", { ascending: false });

    // Combine all groups (avoid duplicates)
    const allGroupsMap = new Map<string, typeof publicGroups extends (infer T)[] | null ? T : never>();
    for (const g of publicGroups || []) {
      allGroupsMap.set(g.id, g);
    }
    for (const g of myPrivateGroups || []) {
      allGroupsMap.set(g.id, g);
    }
    const allGroups = Array.from(allGroupsMap.values());

    // Get member counts for all groups in one query
    const groupIds = allGroups.map(g => g.id);
    let memberCounts: Record<string, number> = {};

    if (groupIds.length > 0) {
      const { data: membershipRows } = await supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", groupIds);

      memberCounts = (membershipRows || []).reduce((acc, row) => {
        acc[row.group_id] = (acc[row.group_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }

    const groupsWithCounts: Group[] = allGroups
      .filter(group => group && group.id) // Filter out any null/undefined groups
      .map(group => ({
        ...group,
        member_count: memberCounts[group.id] || 0,
        is_member: memberGroupIds.has(group.id),
      }));

    // Separate into my groups and discover (only public groups in discover)
    setMyGroups(groupsWithCounts.filter(g => g && g.is_member));
    setGroups(groupsWithCounts.filter(g => g && !g.is_member && g.privacy === "public"));
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || !user) return;

    setCreating(true);

    // Create group
    const { data: newGroup, error } = await supabase
      .from("groups")
      .insert({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null,
        privacy: newGroupPrivacy,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && newGroup) {
      // Add creator as admin
      await supabase.from("group_members").insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: "admin",
      });

      setShowCreateModal(false);
      setNewGroupName("");
      setNewGroupDescription("");
      setNewGroupPrivacy("public");
      
      // Redirect to the new group
      router.push(`/groups/${newGroup.id}`);
    }

    setCreating(false);
  }

  async function handleJoinGroup(groupId: string) {
    if (!user) return;

    await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: user.id,
      role: "member",
    });

    await loadGroups(user.id);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Header
        user={user}
        userUsername={userUsername}
        userAvatarUrl={userAvatarUrl}
        currentPage="other"
      />

      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>
      {/* Page Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0, fontWeight: 400 }}>Communities</h1>
        <button onClick={() => setShowCreateModal(true)}>
          + Create Community
        </button>
      </div>

      {/* My Groups */}
      {myGroups.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, opacity: 0.8 }}>Your Communities</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {myGroups.map(group => (
              <Link 
                key={group.id} 
                href={`/groups/${group.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card" style={{ cursor: "pointer", transition: "transform 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    {group.avatar_url ? (
                      <img 
                        src={group.avatar_url} 
                        alt=""
                        style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{
                        width: 50,
                        height: 50,
                        borderRadius: 8,
                        background: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "black",
                        fontWeight: 700,
                        fontSize: 20,
                      }}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{group.name}</h3>
                      <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                        {group.member_count} {group.member_count === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  {group.description && (
                    <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
                      {group.description.slice(0, 100)}{group.description.length > 100 ? "..." : ""}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Discover Groups */}
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 16, opacity: 0.8 }}>
          {myGroups.length > 0 ? "Discover Communities" : "All Communities"}
        </h2>
        {groups.length === 0 && myGroups.length === 0 ? (
          <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
            No communities yet. Be the first to create one!
          </p>
        ) : groups.length === 0 ? (
          <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
            You've joined all available communities!
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {groups.map(group => (
              <div key={group.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  {group.avatar_url ? (
                    <img 
                      src={group.avatar_url} 
                      alt=""
                      style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "black",
                      fontWeight: 700,
                      fontSize: 20,
                    }}>
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{group.name}</h3>
                    <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                      {group.member_count} {group.member_count === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>
                {group.description && (
                  <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>
                    {group.description.slice(0, 100)}{group.description.length > 100 ? "..." : ""}
                  </p>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, opacity: 0.7 }}>
                    {group.privacy === "public" ? "🌐 Public" : "🔒 Private"}
                  </span>
                </div>
                {group.privacy === "public" ? (
                  <button 
                    onClick={() => handleJoinGroup(group.id)}
                    style={{ width: "100%", marginTop: 12 }}
                  >
                    Join Community
                  </button>
                ) : (
                  <Link
                    href={`/groups/${group.id}`}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 12,
                      padding: "10px 16px",
                      background: "transparent",
                      border: "1px solid var(--border-hover)",
                      color: "rgba(255,255,255,0.7)",
                      borderRadius: 8,
                      textAlign: "center",
                      textDecoration: "none",
                      fontSize: 14,
                    }}
                  >
                    View Community
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card"
            style={{ width: "90%", maxWidth: 450 }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 20px 0", fontSize: 20 }}>Create a Community</h2>
            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, opacity: 0.8 }}>
                  Community Name *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="e.g., Photography Enthusiasts"
                  maxLength={100}
                  required
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, opacity: 0.8 }}>
                  Description
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={e => setNewGroupDescription(e.target.value)}
                  placeholder="What's this community about?"
                  rows={3}
                  maxLength={500}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, opacity: 0.8 }}>
                  Privacy
                </label>
                <div style={{ display: "flex", gap: 32 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="privacy"
                      checked={newGroupPrivacy === "public"}
                      onChange={() => setNewGroupPrivacy("public")}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Public</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="privacy"
                      checked={newGroupPrivacy === "private"}
                      onChange={() => setNewGroupPrivacy("private")}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Private</span>
                  </label>
                </div>
                <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {newGroupPrivacy === "public" 
                    ? "Anyone can find and join this community" 
                    : "Only invited members can join"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" disabled={creating || !newGroupName.trim()}>
                  {creating ? "Creating..." : "Create Community"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-hover)",
                    color: "#ffffff",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

