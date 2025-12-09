"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";

type Group = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  privacy: "public" | "private";
  allow_member_invites: boolean;
  created_by: string;
  created_at: string;
};

type GroupInvite = {
  id: string;
  group_id: string;
  invited_user_id: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type Vote = {
  id: string;
  user_id: string;
  value: number;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_comment_id: string | null;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
};

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  edited_at: string | null;
  user_id: string;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  comments: Comment[];
};

export default function GroupPage() {
  const params = useParams();
  const groupId = params.id as string;
  const router = useRouter();
  const supabase = createBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [userUsername, setUserUsername] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [changingPrivacy, setChangingPrivacy] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<GroupInvite | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<Array<{id: string; username: string; display_name: string | null; avatar_url: string | null}>>([]);
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      
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

      // Get group info
      const { data: groupData } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (!groupData) {
        setLoading(false);
        return;
      }

      setGroup(groupData);

      // Check membership
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

      setIsMember(!!membership);
      setUserRole(membership?.role || null);

      // Check for pending invite if not a member and private group
      if (!membership && groupData.privacy === "private") {
        const { data: invite } = await supabase
          .from("group_invites")
          .select("*")
          .eq("group_id", groupId)
          .eq("invited_user_id", user.id)
          .eq("status", "pending")
          .single();
        
        setPendingInvite(invite || null);
      }

      // Load members only if member or public
      if (membership || groupData.privacy === "public") {
        // eslint-disable-next-line react-hooks/immutability
        await loadMembers();
      }

      // Load posts if member or public group
      if (membership || groupData.privacy === "public") {
        // eslint-disable-next-line react-hooks/immutability
        await loadPosts();
        // eslint-disable-next-line react-hooks/immutability
        await loadUserVotes(user.id);
        // eslint-disable-next-line react-hooks/immutability
        await loadVoteTotals();
      }

      setLoading(false);
    }

    init();
  }, [groupId]);

  async function loadMembers() {
    const { data } = await supabase
      .from("group_members")
      .select(`
        id,
        user_id,
        role,
        users (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("group_id", groupId)
      .order("role", { ascending: true });

    setMembers((data as unknown as Member[]) || []);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from("posts")
      .select(`
        id,
        content,
        image_url,
        created_at,
        edited_at,
        user_id,
        users (
          username,
          display_name,
          avatar_url
        ),
        comments (
          id,
          content,
          created_at,
          user_id,
          parent_comment_id,
          users (
            username,
            display_name,
            avatar_url
          )
        )
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const postsWithNestedComments = data.map((post: any) => {
        const allComments = (post.comments || []) as Comment[];
        const parentComments = allComments
          .filter(c => !c.parent_comment_id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const replies = allComments.filter(c => c.parent_comment_id);
        const commentsWithReplies = parentComments.map(parent => ({
          ...parent,
          replies: replies
            .filter(r => r.parent_comment_id === parent.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        }));
        return { ...post, comments: commentsWithReplies };
      });
      setPosts(postsWithNestedComments as unknown as Post[]);
    }
  }

  async function loadUserVotes(userId: string) {
    const { data } = await supabase
      .from("votes")
      .select("*")
      .eq("user_id", userId);

    if (data) {
      const voteMap: Record<string, Vote> = {};
      data.forEach((vote) => {
        const key = `${vote.target_type}-${vote.target_id}`;
        voteMap[key] = vote;
      });
      setVotes(voteMap);
    }
  }

  async function loadVoteTotals() {
    const { data } = await supabase
      .from("votes")
      .select("target_type, target_id, value");

    if (data) {
      const totals: Record<string, number> = {};
      data.forEach((vote) => {
        const key = `${vote.target_type}-${vote.target_id}`;
        totals[key] = (totals[key] || 0) + vote.value;
      });
      setVoteTotals(totals);
    }
  }

  async function handleVote(targetType: "post" | "comment", targetId: string, value: number) {
    if (!user) return;

    const key = `${targetType}-${targetId}`;
    const existingVote = votes[key];

    if (existingVote) {
      if (existingVote.value === value) {
        await supabase.from("votes").delete().eq("id", existingVote.id);
        const newVotes = { ...votes };
        delete newVotes[key];
        setVotes(newVotes);
        setVoteTotals({ ...voteTotals, [key]: (voteTotals[key] || 0) - existingVote.value });
      } else {
        await supabase.from("votes").update({ value }).eq("id", existingVote.id);
        setVotes({ ...votes, [key]: { ...existingVote, value } });
        setVoteTotals({ ...voteTotals, [key]: (voteTotals[key] || 0) - existingVote.value + value });
      }
    } else {
      const { data } = await supabase
        .from("votes")
        .insert({ user_id: user.id, target_type: targetType, target_id: targetId, value })
        .select()
        .single();

      if (data) {
        setVotes({ ...votes, [key]: data });
        setVoteTotals({ ...voteTotals, [key]: (voteTotals[key] || 0) + value });
      }
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeSelectedImage() {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if ((!content.trim() && !selectedImage) || !user) return;

    setPosting(true);

    let imageUrl: string | null = null;

    if (selectedImage) {
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, selectedImage, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        alert("Failed to upload image");
        setPosting(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(filePath);
      imageUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        content: content.trim(),
        image_url: imageUrl,
        user_id: user.id,
        group_id: groupId,
      })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("votes").insert({
        user_id: user.id,
        target_type: "post",
        target_id: data.id,
        value: 1,
      });
      
      setContent("");
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadPosts();
      await loadUserVotes(user.id);
      await loadVoteTotals();
    }

    setPosting(false);
  }

  async function handleJoin() {
    if (!user) return;
    await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: user.id,
      role: "member",
    });
    setIsMember(true);
    setUserRole("member");
    await loadMembers();
    await loadPosts();
    await loadUserVotes(user.id);
    await loadVoteTotals();
  }

  async function handleLeave() {
    if (!user || userRole === "admin") return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    setIsMember(false);
    setUserRole(null);
    await loadMembers();
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !group) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploadingBanner(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `group-${groupId}-banner-${Date.now()}.${fileExt}`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      alert("Failed to upload banner");
      setUploadingBanner(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(filePath);

    const { error: updateError } = await supabase.from("groups").update({ banner_url: publicUrl }).eq("id", groupId);
    
    if (updateError) {
      console.error("Error saving banner:", updateError);
      alert("Failed to save banner. Please try again.");
    } else {
      setGroup({ ...group, banner_url: publicUrl });
    }
    setUploadingBanner(false);
    
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }

  async function togglePrivacy() {
    if (!group || userRole !== "admin") {
      console.log("Toggle blocked - group:", !!group, "userRole:", userRole);
      return;
    }
    
    setChangingPrivacy(true);
    const newPrivacy = group.privacy === "public" ? "private" : "public";
    
    console.log("Attempting to change privacy to:", newPrivacy, "for group:", groupId);
    
    const { error } = await supabase
      .from("groups")
      .update({ privacy: newPrivacy })
      .eq("id", groupId);
    
    if (error) {
      console.error("Privacy update error:", error);
      alert("Failed to update privacy: " + error.message);
    } else {
      console.log("Privacy updated successfully");
      setGroup({ ...group, privacy: newPrivacy });
    }
    setChangingPrivacy(false);
  }

  async function toggleMemberInvites() {
    if (!group || userRole !== "admin") return;
    
    const newValue = !group.allow_member_invites;
    
    const { error } = await supabase
      .from("groups")
      .update({ allow_member_invites: newValue })
      .eq("id", groupId);
    
    if (!error) {
      setGroup({ ...group, allow_member_invites: newValue });
    }
  }

  async function acceptInvite() {
    if (!user || !pendingInvite) return;
    
    // Update invite status
    await supabase
      .from("group_invites")
      .update({ status: "accepted" })
      .eq("id", pendingInvite.id);
    
    // Join the group
    await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: user.id,
      role: "member",
    });
    
    setIsMember(true);
    setUserRole("member");
    setPendingInvite(null);
    await loadMembers();
    await loadPosts();
    if (user) {
      await loadUserVotes(user.id);
    }
    await loadVoteTotals();
  }

  async function declineInvite() {
    if (!pendingInvite) return;
    
    await supabase
      .from("group_invites")
      .update({ status: "declined" })
      .eq("id", pendingInvite.id);
    
    setPendingInvite(null);
  }

  async function searchUsersToInvite(query: string) {
    setInviteSearch(query);
    if (query.length < 2) {
      setInviteResults([]);
      return;
    }
    
    // Get existing member IDs
    const memberIds = members.map(m => m.user_id);
    
    const { data } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .not("id", "in", `(${memberIds.join(",")})`)
      .limit(10);
    
    setInviteResults(data || []);
  }

  async function sendInvite(invitedUserId: string) {
    if (!user) return;
    
    setSendingInvite(true);
    
    const { error } = await supabase.from("group_invites").insert({
      group_id: groupId,
      invited_user_id: invitedUserId,
      invited_by: user.id,
    });
    
    if (!error) {
      // Remove from results
      setInviteResults(prev => prev.filter(u => u.id !== invitedUserId));
      setInviteSearch("");
    }
    
    setSendingInvite(false);
  }

  async function handleDeletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    await supabase.from("posts").delete().eq("id", postId);
    await loadPosts();
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: "center" }}>
        <h1>Group not found</h1>
        <Link href="/groups">← Back to Groups</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>
      {/* Header */}
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 32,
        paddingBottom: 16,
        borderBottom: "1px solid rgba(240, 235, 224, 0.2)"
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <Logo size={32} />
          <span style={{ fontSize: 24, fontWeight: 400, color: "var(--alzooka-cream)" }}>Alzooka</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <UserSearch />
          <Link href="/groups" style={{ color: "var(--alzooka-cream)", fontSize: 14, textDecoration: "none", opacity: 0.8 }}>
            Groups
          </Link>
          <Link href="/" style={{ color: "var(--alzooka-cream)", fontSize: 14, textDecoration: "none", opacity: 0.8 }}>
            Feed
          </Link>
          {user && <NotificationBell userId={user.id} currentUsername={userUsername} />}
          <Link 
            href={`/profile/${userUsername}`}
            title="My Profile"
            style={{ display: "block", flexShrink: 0 }}
          >
            {userAvatarUrl ? (
              <img 
                src={userAvatarUrl} 
                alt="Profile"
                style={{
                  width: 34,
                  height: 34,
                  minWidth: 34,
                  minHeight: 34,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid var(--alzooka-gold)",
                  display: "block",
                }}
              />
            ) : (
              <div style={{
                width: 34,
                height: 34,
                minWidth: 34,
                minHeight: 34,
                borderRadius: "50%",
                background: "var(--alzooka-gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--alzooka-teal-dark)",
                fontWeight: 700,
                fontSize: 14,
              }}>
                {(userUsername || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            style={{ 
              background: "rgba(240, 235, 224, 0.1)", 
              color: "var(--alzooka-cream)",
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              borderRadius: 20,
              opacity: 0.9,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(240, 235, 224, 0.2)";
              e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
              e.currentTarget.style.opacity = "0.9";
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Group Header - Banner with overlay content */}
      <div 
        style={{ 
          marginBottom: 24, 
          borderRadius: 12, 
          overflow: "hidden",
          background: group.banner_url 
            ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(26,58,74,0.95) 60%), url(${group.banner_url}) center/cover`
            : "linear-gradient(135deg, var(--alzooka-teal-dark) 0%, var(--alzooka-teal) 100%)",
          position: "relative",
          padding: "24px",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {/* Banner upload button for admins */}
        {userRole === "admin" && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "rgba(0, 0, 0, 0.6)",
                border: "none",
                color: "white",
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📷 {uploadingBanner ? "Uploading..." : group.banner_url ? "Change Banner" : "Add Banner"}
            </button>
          </>
        )}

        {/* Group Info - overlaid on banner */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
          {group.avatar_url ? (
            <img src={group.avatar_url} alt="" style={{ 
              width: 90, 
              height: 90, 
              borderRadius: 12, 
              objectFit: "cover", 
              border: "4px solid var(--alzooka-gold)",
              flexShrink: 0,
            }} />
          ) : (
            <div style={{
              width: 90,
              height: 90,
              borderRadius: 12,
              background: "var(--alzooka-gold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--alzooka-teal-dark)",
              fontWeight: 700,
              fontSize: 36,
              flexShrink: 0,
            }}>
              {group.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: "0 0 8px 0", fontSize: 26, textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>{group.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <button
                onClick={() => setShowMembers(!showMembers)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--alzooka-cream)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 14,
                }}
              >
                👥 {members.length} {members.length === 1 ? "member" : "members"}
              </button>
              {userRole === "admin" ? (
                <button
                  onClick={togglePrivacy}
                  disabled={changingPrivacy}
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(240, 235, 224, 0.3)",
                    color: "var(--alzooka-cream)",
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Click to change privacy"
                >
                  {changingPrivacy ? "..." : group.privacy === "public" ? "🌐 Public" : "🔒 Private"}
                </button>
              ) : (
                <span style={{ fontSize: 14, color: "var(--alzooka-cream)" }}>
                  {group.privacy === "public" ? "🌐 Public" : "🔒 Private"}
                </span>
              )}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: "flex", gap: 8 }}>
            {isMember ? (
              <>
                {/* Invite button for admins, or members if allowed */}
                {group.privacy === "private" && (userRole === "admin" || group.allow_member_invites) && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                    }}
                  >
                    ➕ Invite
                  </button>
                )}
                {userRole !== "admin" && (
                  <button
                    onClick={handleLeave}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                    }}
                  >
                    Leave Group
                  </button>
                )}
              </>
            ) : group.privacy === "private" ? (
              pendingInvite ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={acceptInvite} style={{ background: "var(--alzooka-gold)", color: "var(--alzooka-teal-dark)" }}>
                    ✓ Accept Invite
                  </button>
                  <button
                    onClick={declineInvite}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                    }}
                  >
                    ✕ Decline
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 14, color: "var(--alzooka-cream)", opacity: 0.7 }}>
                  🔒 Invite only
                </span>
              )
            ) : (
              <button onClick={handleJoin}>Join Group</button>
            )}
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <p style={{ margin: "12px 0 0 0", opacity: 0.9, lineHeight: 1.5, fontSize: 14 }}>{group.description}</p>
        )}

        {/* Members List */}
        {showMembers && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(240, 235, 224, 0.2)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, opacity: 0.8 }}>Members</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {members.map(member => (
                <Link
                  key={member.id}
                  href={`/profile/${encodeURIComponent(member.users.username)}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}
                >
                  {member.users.avatar_url ? (
                    <img src={member.users.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--alzooka-gold)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--alzooka-teal-dark)",
                      fontWeight: 700,
                      fontSize: 12,
                    }}>
                      {(member.users.display_name || member.users.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span style={{ fontSize: 14 }}>{member.users.display_name || member.users.username}</span>
                    {member.role === "admin" && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: "var(--alzooka-gold)" }}>Admin</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Admin Settings */}
        {userRole === "admin" && group.privacy === "private" && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(240, 235, 224, 0.2)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, opacity: 0.8 }}>Admin Settings</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={group.allow_member_invites}
                onChange={toggleMemberInvites}
                style={{ width: 18, height: 18 }}
              />
              Allow members to invite others
            </label>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setShowInviteModal(false);
            setInviteSearch("");
            setInviteResults([]);
          }}
        >
          <div
            className="card"
            style={{ width: "90%", maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Invite to {group.name}</h2>
            <input
              type="text"
              placeholder="Search for users to invite..."
              value={inviteSearch}
              onChange={e => searchUsersToInvite(e.target.value)}
              autoFocus
            />
            {inviteResults.length > 0 && (
              <div style={{ marginTop: 12, maxHeight: 300, overflowY: "auto" }}>
                {inviteResults.map(u => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--alzooka-gold)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--alzooka-teal-dark)",
                          fontWeight: 700,
                          fontSize: 14,
                        }}>
                          {(u.display_name || u.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontSize: 14 }}>{u.display_name || u.username}</span>
                    </div>
                    <button
                      onClick={() => sendInvite(u.id)}
                      disabled={sendingInvite}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
            {inviteSearch.length >= 2 && inviteResults.length === 0 && (
              <p className="text-muted" style={{ textAlign: "center", padding: 20 }}>
                No users found
              </p>
            )}
            <button
              onClick={() => {
                setShowInviteModal(false);
                setInviteSearch("");
                setInviteResults([]);
              }}
              style={{
                marginTop: 16,
                width: "100%",
                background: "transparent",
                border: "1px solid rgba(240, 235, 224, 0.3)",
                color: "var(--alzooka-cream)",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Post Form (members only) */}
      {isMember && (
        <form onSubmit={handlePost} style={{ marginBottom: 24 }}>
          <textarea
            placeholder={`Share something with ${group.name}...`}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            style={{ marginBottom: 12, resize: "vertical" }}
          />
          {imagePreview && (
            <div style={{ position: "relative", marginBottom: 12, display: "inline-block" }}>
              <img src={imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} />
              <button
                type="button"
                onClick={removeSelectedImage}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "white",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "transparent",
                border: "1px solid rgba(240, 235, 224, 0.3)",
                color: "var(--alzooka-cream)",
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              📷 Photo
            </button>
            <button type="submit" disabled={posting || (!content.trim() && !selectedImage)}>
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      )}

      {/* Posts */}
      {!isMember && group.privacy === "private" ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>🔒 This is a private group</p>
          {pendingInvite ? (
            <>
              <p className="text-muted" style={{ marginBottom: 16 }}>You have been invited to join!</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={acceptInvite} style={{ background: "var(--alzooka-gold)", color: "var(--alzooka-teal-dark)" }}>
                  ✓ Accept Invite
                </button>
                <button
                  onClick={declineInvite}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(240, 235, 224, 0.3)",
                    color: "var(--alzooka-cream)",
                  }}
                >
                  ✕ Decline
                </button>
              </div>
            </>
          ) : (
            <p className="text-muted">You need an invite from a member to join.</p>
          )}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
          No posts yet. {isMember ? "Be the first to share something!" : ""}
        </p>
      ) : (
        posts.map(post => (
          <GroupPostCard
            key={post.id}
            post={post}
            user={user!}
            supabase={supabase}
            votes={votes}
            voteTotals={voteTotals}
            onVote={handleVote}
            onDelete={handleDeletePost}
            onRefresh={async () => {
              await loadPosts();
              await loadUserVotes(user!.id);
              await loadVoteTotals();
            }}
          />
        ))
      )}
    </div>
  );
}

// Simplified Post Card for Groups
function GroupPostCard({
  post,
  user,
  supabase,
  votes,
  voteTotals,
  onVote,
  onDelete,
  onRefresh,
}: {
  post: Post;
  user: User;
  supabase: ReturnType<typeof createBrowserClient>;
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const postKey = `post-${post.id}`;
  const userVote = votes[postKey]?.value || 0;
  const score = voteTotals[postKey] || 0;
  const scoreColor = score > 0 ? "var(--alzooka-gold)" : score < 0 ? "#e57373" : "var(--alzooka-cream)";

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({ content: commentText.trim(), post_id: post.id, user_id: user.id })
      .select()
      .single();

    if (!error && data) {
      await supabase.from("votes").insert({ user_id: user.id, target_type: "comment", target_id: data.id, value: 1 });
      setCommentText("");
      onRefresh();
    }
    setSubmitting(false);
  }

  const commentCount = (post.comments || []).reduce((t, c) => t + 1 + (c.replies?.length || 0), 0);

  return (
    <article className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {/* Votes */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 32 }}>
          <button
            onClick={() => onVote("post", post.id, 1)}
            style={{
              background: "transparent",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              color: userVote === 1 ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
              opacity: userVote === 1 ? 1 : 0.5,
              fontSize: 14,
            }}
          >
            ▲
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: scoreColor, opacity: score === 0 ? 0.5 : 1 }}>{score}</span>
          <button
            onClick={() => onVote("post", post.id, -1)}
            style={{
              background: "transparent",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              color: userVote === -1 ? "#e57373" : "var(--alzooka-cream)",
              opacity: userVote === -1 ? 1 : 0.5,
              fontSize: 14,
            }}
          >
            ▼
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link
              href={`/profile/${post.users?.username || "unknown"}`}
              style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
            >
              {post.users?.avatar_url ? (
                <img src={post.users.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--alzooka-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--alzooka-teal-dark)",
                  fontWeight: 700,
                  fontSize: 16,
                }}>
                  {(post.users?.display_name || post.users?.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <span style={{ fontWeight: 600, color: "var(--alzooka-cream)" }}>
                  {post.users?.display_name || post.users?.username || "Unknown"}
                </span>
                <span className="text-muted" style={{ marginLeft: 8, fontSize: 14 }}>
                  {formatTime(post.created_at)}
                </span>
              </div>
            </Link>
            {post.user_id === user.id && (
              <button
                onClick={() => onDelete(post.id)}
                style={{ background: "transparent", border: "none", color: "#e57373", fontSize: 12, cursor: "pointer", opacity: 0.7 }}
              >
                Delete
              </button>
            )}
          </div>

          {post.content && <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>{post.content}</p>}
          {post.image_url && (
            <div style={{ marginBottom: 16 }}>
              <img
                src={post.image_url}
                alt="Post image"
                style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8, cursor: "pointer" }}
                onClick={() => window.open(post.image_url!, "_blank")}
              />
            </div>
          )}

          <button
            onClick={() => setShowComments(!showComments)}
            style={{ background: "transparent", color: "var(--alzooka-cream)", padding: "4px 0", fontSize: 14, border: "none", opacity: 0.7 }}
          >
            {commentCount === 0 ? "Add comment" : `${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
          </button>

          {showComments && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(240, 235, 224, 0.1)" }}>
              {post.comments?.map(comment => (
                <div key={comment.id} style={{ marginBottom: 12, display: "flex", gap: 8 }}>
                  <Link href={`/profile/${comment.users?.username}`} style={{ flexShrink: 0 }}>
                    {comment.users?.avatar_url ? (
                      <img src={comment.users.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--alzooka-gold)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--alzooka-teal-dark)",
                        fontWeight: 700,
                        fontSize: 12,
                      }}>
                        {(comment.users?.display_name || comment.users?.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div style={{ flex: 1, paddingLeft: 8, borderLeft: "2px solid var(--alzooka-gold)" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{comment.users?.display_name || comment.users?.username}</span>
                    <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{formatTime(comment.created_at)}</span>
                    <p style={{ margin: "4px 0 0 0", fontSize: 14, lineHeight: 1.5 }}>{comment.content}</p>
                  </div>
                </div>
              ))}
              <form onSubmit={handleComment} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  style={{ flex: 1, padding: 8, fontSize: 14 }}
                />
                <button type="submit" disabled={submitting || !commentText.trim()} style={{ padding: "8px 16px", fontSize: 14 }}>
                  {submitting ? "..." : "Comment"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

