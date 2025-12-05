"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { profileSchema, getFirstZodError } from "@/lib/validation";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { AvatarUpload } from "@/app/components/AvatarUpload";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import { FriendButton } from "@/app/components/FriendButton";
import { ProfilePictureModal } from "@/app/components/ProfilePictureModal";
import { BannerCropModal } from "@/app/components/BannerCropModal";

type UserProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  created_at: string;
};

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  commentCount: number;
  voteScore: number;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  posts: {
    content: string;
  };
  voteScore: number;
};

type VoteStats = {
  upvotesReceived: number;
  downvotesReceived: number;
};

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = decodeURIComponent(params.username as string);
  const router = useRouter();
  const supabase = createBrowserClient();
  const showFriendsParam = searchParams.get("showFriends");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserUsername, setCurrentUserUsername] = useState<string>("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [voteStats, setVoteStats] = useState<VoteStats>({
    upvotesReceived: 0,
    downvotesReceived: 0,
  });
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsList, setFriendsList] = useState<{id: string; username: string; display_name: string | null; avatar_url: string | null}[]>([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [bannerImageToCrop, setBannerImageToCrop] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    async function init() {
      // Get current logged in user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Get current user's username from the users table
      if (user) {
        const { data: currentUserData } = await supabase
          .from("users")
          .select("username")
          .eq("id", user.id)
          .single();
        if (currentUserData) {
          setCurrentUserUsername(currentUserData.username);
        }
      }

      // Get profile for the username in the URL
      // Query all users and find match (handles spaces and case issues)
      const { data: allUsers } = await supabase
        .from("users")
        .select("id, username, display_name, bio, avatar_url, banner_url, created_at");
      
      const profileData = allUsers?.find(
        u => u.username.trim().toLowerCase() === username.trim().toLowerCase()
      );

      if (!profileData) {
        console.log("Profile lookup failed. Looking for:", username);
        console.log("Available usernames:", allUsers?.map(u => u.username));
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setEditDisplayName(profileData.display_name || "");
      setEditBio(profileData.bio || "");

      // Get posts by this user with comment counts (only feed posts, not group posts)
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id, 
          content,
          image_url,
          video_url,
          created_at,
          comments (id)
        `)
        .eq("user_id", profileData.id)
        .is("group_id", null)
        .order("created_at", { ascending: false });

      if (postsData) {
        // Get vote scores for all posts
        const postIds = postsData.map(p => p.id);
        const { data: postVotesData } = await supabase
          .from("votes")
          .select("target_id, value")
          .eq("target_type", "post")
          .in("target_id", postIds);

        // Calculate vote totals per post
        const votesByPost: Record<string, number> = {};
        postVotesData?.forEach(v => {
          votesByPost[v.target_id] = (votesByPost[v.target_id] || 0) + v.value;
        });

        // Transform posts with counts
        const postsWithCounts = postsData.map(post => ({
          id: post.id,
          content: post.content,
          image_url: post.image_url || null,
          video_url: post.video_url || null,
          created_at: post.created_at,
          commentCount: (post.comments as unknown[])?.length || 0,
          voteScore: votesByPost[post.id] || 0,
        }));

        setPosts(postsWithCounts);
      }

      // Get comments by this user
      const { data: commentsData } = await supabase
        .from("comments")
        .select(`
          id,
          content,
          created_at,
          post_id,
          posts (
            content
          )
        `)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      if (commentsData) {
        // Get vote scores for all comments
        const commentIdsForVotes = commentsData.map(c => c.id);
        const { data: commentVotesData } = await supabase
          .from("votes")
          .select("target_id, value")
          .eq("target_type", "comment")
          .in("target_id", commentIdsForVotes);

        // Calculate vote totals per comment
        const votesByComment: Record<string, number> = {};
        commentVotesData?.forEach(v => {
          votesByComment[v.target_id] = (votesByComment[v.target_id] || 0) + v.value;
        });

        // Transform comments with vote scores
        const commentsWithVotes = commentsData.map(comment => ({
          ...comment,
          voteScore: votesByComment[comment.id] || 0,
        }));

        setComments(commentsWithVotes as unknown as Comment[]);
      }

      // Get vote stats - votes received on user's posts
      const postIdsForStats = postsData?.map(p => p.id) || [];
      const commentIds = commentsData?.map(c => c.id) || [];

      let upvotesReceived = 0;
      let downvotesReceived = 0;

      if (postIdsForStats.length > 0) {
        const { data: postVotes } = await supabase
          .from("votes")
          .select("value")
          .eq("target_type", "post")
          .in("target_id", postIdsForStats);

        if (postVotes) {
          postVotes.forEach(v => {
            if (v.value > 0) upvotesReceived += v.value;
            else downvotesReceived += Math.abs(v.value);
          });
        }
      }

      if (commentIds.length > 0) {
        const { data: commentVotes } = await supabase
          .from("votes")
          .select("value")
          .eq("target_type", "comment")
          .in("target_id", commentIds);

        if (commentVotes) {
          commentVotes.forEach(v => {
            if (v.value > 0) upvotesReceived += v.value;
            else downvotesReceived += Math.abs(v.value);
          });
        }
      }

      setVoteStats({
        upvotesReceived,
        downvotesReceived,
      });

      // Get friends count
      const { count: friendsCountData } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${profileData.id},addressee_id.eq.${profileData.id}`);
      
      setFriendsCount(friendsCountData || 0);

      setLoading(false);

      // Auto-open friends modal if showFriends param is set
      if (showFriendsParam === "true" && user) {
        setLoadingFriends(true);
        const { data: friendships } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
        
        if (friendships && friendships.length > 0) {
          const friendIds = friendships.map(f => 
            f.requester_id === user.id ? f.addressee_id : f.requester_id
          );
          const { data: friendsData } = await supabase
            .from("users")
            .select("id, username, display_name, avatar_url")
            .in("id", friendIds);
          setFriendsList(friendsData || []);
        } else {
          setFriendsList([]);
        }
        setLoadingFriends(false);
        setShowFriendsModal(true);
      }
    }

    init();
  }, [username, showFriendsParam]);

  async function loadFriends() {
    if (!profile) return;
    setLoadingFriends(true);
    setShowFriendsModal(true);

    // Get friendships where this user is either requester or addressee
    const { data: friendships } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);

    if (friendships && friendships.length > 0) {
      // Get the friend IDs (the other person in each friendship)
      const friendIds = friendships.map(f => 
        f.requester_id === profile.id ? f.addressee_id : f.requester_id
      );

      // Fetch friend profiles
      const { data: friends } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url")
        .in("id", friendIds);

      setFriendsList(friends || []);
    } else {
      setFriendsList([]);
    }
    setLoadingFriends(false);
  }

  async function handleSaveProfile() {
    if (!profile || !currentUser) return;
    setEditError("");

    // Validate form data with Zod
    const result = profileSchema.safeParse({
      displayName: editDisplayName,
      bio: editBio,
    });

    if (!result.success) {
      setEditError(getFirstZodError(result.error));
      return;
    }

    const { displayName: validatedDisplayName, bio: validatedBio } = result.data;

    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        display_name: validatedDisplayName || null,
        bio: validatedBio || null,
      })
      .eq("id", profile.id);

    if (!error) {
      setProfile({
        ...profile,
        display_name: validatedDisplayName || null,
        bio: validatedBio || null,
      });
      setIsEditing(false);
      setEditError("");
    } else {
      setEditError("Failed to save profile. Please try again.");
    }

    setSaving(false);
  }

  function handleAvatarUpdate(newUrl: string) {
    if (profile) {
      setProfile({ ...profile, avatar_url: newUrl });
    }
  }

  function handleBannerSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile || !currentUser) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be less than 10MB");
      return;
    }

    // Create a preview URL and show crop modal
    const reader = new FileReader();
    reader.onload = () => {
      setBannerImageToCrop(reader.result as string);
      setShowBannerCrop(true);
    };
    reader.readAsDataURL(file);
    
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }

  async function handleBannerCropSave(croppedBlob: Blob) {
    if (!profile || !currentUser) return;

    setUploadingBanner(true);
    setShowBannerCrop(false);
    setBannerImageToCrop(null);

    const fileName = `${profile.id}-banner-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, croppedBlob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      alert("Failed to upload banner");
      setUploadingBanner(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("users")
      .update({ banner_url: publicUrl })
      .eq("id", profile.id);

    if (updateError) {
      console.error("Update error:", updateError);
      alert("Failed to save banner");
    } else {
      setProfile({ ...profile, banner_url: publicUrl });
    }

    setUploadingBanner(false);
  }

  function handleBannerCropCancel() {
    setShowBannerCrop(false);
    setBannerImageToCrop(null);
  }

  async function handlePost() {
    if (!newPostContent.trim() || !currentUser || !profile) return;

    setPosting(true);

    const { data: newPost, error } = await supabase
      .from("posts")
      .insert({
        user_id: currentUser.id,
        content: newPostContent.trim(),
      })
      .select()
      .single();

    if (!error && newPost) {
      // Add the new post to the top of the list
      setPosts([
        {
          id: newPost.id,
          content: newPost.content,
          image_url: null,
          video_url: null,
          created_at: newPost.created_at,
          commentCount: 0,
          voteScore: 0,
        },
        ...posts,
      ]);
      setNewPostContent("");
      setActiveTab("posts"); // Switch to posts tab to show new post
    }

    setPosting(false);
  }

  if (loading) {
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

  if (!profile) {
    return (
      <div className="container" style={{ paddingTop: 40, textAlign: "center" }}>
        <h1 style={{ marginBottom: 16 }}>User not found</h1>
        <p className="text-muted" style={{ marginBottom: 24 }}>
          No user with the username @{username} exists.
        </p>
        <Link href="/">← Back to feed</Link>
      </div>
    );
  }

  const joinDate = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      {/* Header - Centered */}
      <header style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center",
        gap: 24,
        padding: "20px 40px",
        borderBottom: "1px solid rgba(240, 235, 224, 0.2)"
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo size={32} />
          <span style={{ fontSize: 24, fontWeight: 400, color: "var(--alzooka-cream)" }}>
            Alzooka
          </span>
        </Link>
        <UserSearch />
        <Link 
          href="/groups"
          style={{ 
            color: "var(--alzooka-cream)",
            textDecoration: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            opacity: 0.85,
          }}
        >
          <span style={{ fontSize: 18 }}>👥</span>
          <span style={{ fontSize: 10, letterSpacing: 0.5 }}>Groups</span>
        </Link>
        {currentUser && (
          <button
            onClick={async () => {
              setLoadingFriends(true);
              // Load current user's friends
              const { data: friendships } = await supabase
                .from("friendships")
                .select("requester_id, addressee_id")
                .eq("status", "accepted")
                .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);
              
              if (friendships && friendships.length > 0) {
                const friendIds = friendships.map(f => 
                  f.requester_id === currentUser.id ? f.addressee_id : f.requester_id
                );
                const { data: friendsData } = await supabase
                  .from("users")
                  .select("id, username, display_name, avatar_url")
                  .in("id", friendIds);
                setFriendsList(friendsData || []);
              } else {
                setFriendsList([]);
              }
              setLoadingFriends(false);
              setShowFriendsModal(true);
            }}
            style={{ 
              background: "transparent",
              border: "none",
              color: "var(--alzooka-cream)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              opacity: 0.85,
              padding: 0,
            }}
          >
            <span style={{ fontSize: 18 }}>🧑‍🤝‍🧑</span>
            <span style={{ fontSize: 10, letterSpacing: 0.5 }}>Friends</span>
          </button>
        )}
        {currentUser && <NotificationBell userId={currentUser.id} currentUsername={currentUserUsername} />}
          {currentUser && !isOwnProfile && currentUserUsername && (
            <Link 
              href={`/profile/${encodeURIComponent(currentUserUsername)}`}
              style={{ 
                color: "var(--alzooka-cream)",
                fontSize: 14,
                textDecoration: "none",
                opacity: 0.8,
                whiteSpace: "nowrap",
              }}
            >
              My Profile
            </Link>
          )}
          <Link 
            href="/"
            style={{ 
              color: "var(--alzooka-cream)",
              fontSize: 14,
              textDecoration: "none",
              opacity: 0.8,
              whiteSpace: "nowrap",
            }}
          >
            ← Back to Feed
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
      </header>

      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>
      {/* Profile Card with Banner - unified like groups */}
      <div 
        style={{ 
          marginBottom: 32, 
          borderRadius: 12, 
          overflow: "hidden",
          background: profile.banner_url 
            ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(26,58,74,0.95) 60%), url(${profile.banner_url}) center/cover`
            : "linear-gradient(135deg, var(--alzooka-teal-dark) 0%, var(--alzooka-teal) 100%)",
          position: "relative",
          padding: "24px",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {/* Banner upload button */}
        {isOwnProfile && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
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
              📷 {uploadingBanner ? "Uploading..." : profile.banner_url ? "Change Banner" : "Add Banner"}
            </button>
          </>
        )}

        {/* Profile Info - overlaid on banner */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            {isOwnProfile ? (
              <div style={{ position: "relative" }}>
                <AvatarUpload
                  currentAvatarUrl={profile.avatar_url}
                  userId={profile.id}
                  onUpload={handleAvatarUpdate}
                />
                {/* View button overlay for own profile */}
                {profile.avatar_url && (
                  <button
                    onClick={() => setShowPictureModal(true)}
                    style={{
                      position: "absolute",
                      bottom: -8,
                      right: -8,
                      background: "var(--alzooka-gold)",
                      border: "none",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      color: "var(--alzooka-teal-dark)",
                    }}
                    title="View profile picture"
                  >
                    🔍
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowPictureModal(true)}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: profile.avatar_url 
                    ? `url(${profile.avatar_url}) center/cover`
                    : "var(--alzooka-teal-dark)",
                  border: "3px solid var(--alzooka-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  color: "var(--alzooka-gold)",
                  cursor: "pointer",
                  padding: 0,
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(212, 175, 55, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title="View profile picture"
              >
                {!profile.avatar_url && profile.username[0].toUpperCase()}
              </button>
            )}
          </div>

          {/* Profile Info */}
          <div style={{ flex: 1 }}>
            {isEditing ? (
              /* Edit Mode */
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    placeholder="Your display name"
                    maxLength={50}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
                    Bio
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    maxLength={160}
                    style={{ resize: "vertical" }}
                  />
                  <span style={{ fontSize: 12, opacity: 0.5 }}>
                    {editBio.length}/160
                  </span>
                </div>
                {editError && (
                  <p style={{ color: "#e57373", marginBottom: 16, fontSize: 14 }}>
                    {editError}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditDisplayName(profile.display_name || "");
                      setEditBio(profile.bio || "");
                      setEditError("");
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--alzooka-cream)",
                      color: "var(--alzooka-cream)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <h1 style={{ fontSize: 24, margin: 0, fontWeight: 400 }}>
                    {profile.display_name || profile.username}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditing(true)}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(240, 235, 224, 0.3)",
                        color: "var(--alzooka-cream)",
                        padding: "6px 12px",
                        fontSize: 12,
                      }}
                    >
                      Edit Profile
                    </button>
                  )}
                </div>
                <p className="text-gold" style={{ margin: "0 0 12px 0", fontSize: 16 }}>
                  @{profile.username}
                </p>
                
                {/* Friend Button (only show on other people's profiles) */}
                {currentUser && !isOwnProfile && (
                  <div style={{ marginBottom: 12 }}>
                    <FriendButton
                      currentUserId={currentUser.id}
                      currentUsername={currentUserUsername}
                      targetUserId={profile.id}
                      targetUsername={profile.username}
                    />
                  </div>
                )}
                {profile.bio && (
                  <p style={{ margin: "0 0 12px 0", lineHeight: 1.5 }}>
                    {profile.bio}
                  </p>
                )}
                <p className="text-muted" style={{ margin: "0 0 16px 0", fontSize: 14 }}>
                  Joined {joinDate}
                </p>

                {/* Friends & Vote Stats */}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <button
                    onClick={loadFriends}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "inherit",
                    }}
                    title="View friends"
                  >
                    <span style={{ fontSize: 16 }}>👥</span>
                    <span style={{ fontWeight: 600 }}>{friendsCount}</span>
                    <span className="text-muted" style={{ fontSize: 13 }}>{friendsCount === 1 ? "friend" : "friends"}</span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "var(--alzooka-gold)", fontSize: 18 }}>▲</span>
                    <span style={{ fontWeight: 600 }}>{voteStats.upvotesReceived}</span>
                    <span className="text-muted" style={{ fontSize: 13 }}>received</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#e57373", fontSize: 18 }}>▼</span>
                    <span style={{ fontWeight: 600 }}>{voteStats.downvotesReceived}</span>
                    <span className="text-muted" style={{ fontSize: 13 }}>received</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Post Form (only on own profile) */}
      {isOwnProfile && (
        <div className="card" style={{ marginBottom: 24 }}>
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            maxLength={500}
            style={{ marginBottom: 12, resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.5 }}>
              {newPostContent.length}/500
            </span>
            <button
              onClick={handlePost}
              disabled={posting || !newPostContent.trim()}
              style={{
                opacity: !newPostContent.trim() ? 0.5 : 1,
              }}
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab("posts")}
          style={{
            background: activeTab === "posts" ? "var(--alzooka-gold)" : "transparent",
            color: activeTab === "posts" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
            border: activeTab === "posts" ? "none" : "1px solid rgba(240, 235, 224, 0.3)",
            padding: "8px 16px",
            fontSize: 14,
          }}
        >
          Posts ({posts.length})
        </button>
        <button
          onClick={() => setActiveTab("comments")}
          style={{
            background: activeTab === "comments" ? "var(--alzooka-gold)" : "transparent",
            color: activeTab === "comments" ? "var(--alzooka-teal-dark)" : "var(--alzooka-cream)",
            border: activeTab === "comments" ? "none" : "1px solid rgba(240, 235, 224, 0.3)",
            padding: "8px 16px",
            fontSize: 14,
          }}
        >
          Comments ({comments.length})
        </button>
      </div>

      {/* Content Section */}
      <div>
        {activeTab === "posts" ? (
          /* Posts Tab */
          posts.length === 0 ? (
            <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
              {isOwnProfile 
                ? "You haven't posted anything yet." 
                : `@${profile.username} hasn't posted anything yet.`}
            </p>
          ) : (
            posts.map((post) => {
              // Strip YouTube URL from content if video is embedded
              let displayContent = post.content;
              if (post.video_url && displayContent) {
                displayContent = displayContent
                  .replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+/gi, '')
                  .trim();
              }
              // Extract video ID for thumbnail
              const videoId = post.video_url ? (() => {
                const patterns = [
                  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
                  /youtube\.com\/shorts\/([^&\s?]+)/,
                ];
                for (const pattern of patterns) {
                  const match = post.video_url!.match(pattern);
                  if (match) return match[1];
                }
                return null;
              })() : null;

              return (
              <Link 
                key={post.id} 
                href={`/?post=${post.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <article className="card" style={{ cursor: "pointer", transition: "opacity 0.2s" }}>
                  {displayContent && (
                    <p style={{ margin: "0 0 12px 0", lineHeight: 1.6 }}>
                      {displayContent}
                    </p>
                  )}
                  {post.image_url && (
                    <img 
                      src={post.image_url} 
                      alt="" 
                      style={{ 
                        maxWidth: "100%", 
                        maxHeight: 500,
                        borderRadius: 8, 
                        marginBottom: 12,
                      }} 
                    />
                  )}
                  {videoId && (
                    <div style={{ 
                      position: "relative", 
                      marginBottom: 12,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}>
                      <img 
                        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                        alt="Video thumbnail"
                        style={{ 
                          width: "100%", 
                          maxHeight: 300,
                          objectFit: "cover",
                          display: "block",
                        }} 
                      />
                      <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 60,
                        height: 42,
                        background: "rgba(255, 0, 0, 0.9)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <div style={{
                          width: 0,
                          height: 0,
                          borderTop: "8px solid transparent",
                          borderBottom: "8px solid transparent",
                          borderLeft: "14px solid white",
                          marginLeft: 3,
                        }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="text-muted" style={{ fontSize: 14 }}>
                      {formatTime(post.created_at)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ 
                        color: post.voteScore > 0 ? "var(--alzooka-gold)" : post.voteScore < 0 ? "#e57373" : "inherit",
                        opacity: post.voteScore === 0 ? 0.5 : 1,
                        fontSize: 14,
                      }}>
                        {post.voteScore > 0 ? "▲" : post.voteScore < 0 ? "▼" : "▲"}
                      </span>
                      <span style={{ 
                        fontSize: 14,
                        color: post.voteScore > 0 ? "var(--alzooka-gold)" : post.voteScore < 0 ? "#e57373" : "inherit",
                        opacity: post.voteScore === 0 ? 0.5 : 1,
                      }}>
                        {post.voteScore}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: 0.6 }}>
                      <span style={{ fontSize: 14 }}>💬</span>
                      <span style={{ fontSize: 14 }}>{post.commentCount}</span>
                    </div>
                  </div>
                </article>
              </Link>
              );
            })
          )
        ) : (
          /* Comments Tab */
          comments.length === 0 ? (
            <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
              {isOwnProfile 
                ? "You haven't commented on anything yet." 
                : `@${profile.username} hasn't commented on anything yet.`}
            </p>
          ) : (
            comments.map((comment) => (
              <Link 
                key={comment.id} 
                href={`/?post=${comment.post_id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <article className="card" style={{ cursor: "pointer", transition: "opacity 0.2s" }}>
                  {/* Original post context */}
                  <div 
                    style={{ 
                      fontSize: 13, 
                      opacity: 0.6, 
                      marginBottom: 12,
                      paddingBottom: 12,
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    <span className="text-muted">Replying to: </span>
                    <span style={{ fontStyle: "italic" }}>
                      "{comment.posts?.content?.slice(0, 80)}{comment.posts?.content?.length > 80 ? "..." : ""}"
                    </span>
                  </div>
                  {/* Comment content */}
                  <p style={{ margin: "0 0 12px 0", lineHeight: 1.6 }}>
                    {comment.content}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="text-muted" style={{ fontSize: 14 }}>
                      {formatTime(comment.created_at)}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ 
                        color: comment.voteScore > 0 ? "var(--alzooka-gold)" : comment.voteScore < 0 ? "#e57373" : "inherit",
                        opacity: comment.voteScore === 0 ? 0.5 : 1,
                        fontSize: 14,
                      }}>
                        {comment.voteScore > 0 ? "▲" : comment.voteScore < 0 ? "▼" : "▲"}
                      </span>
                      <span style={{ 
                        fontSize: 14,
                        color: comment.voteScore > 0 ? "var(--alzooka-gold)" : comment.voteScore < 0 ? "#e57373" : "inherit",
                        opacity: comment.voteScore === 0 ? 0.5 : 1,
                      }}>
                        {comment.voteScore}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            ))
          )
        )}
      </div>

      {/* Profile Picture Modal */}
      <ProfilePictureModal
        isOpen={showPictureModal}
        onClose={() => setShowPictureModal(false)}
        avatarUrl={profile.avatar_url}
        profileOwnerId={profile.id}
        profileOwnerName={profile.display_name || profile.username}
        profileOwnerUsername={profile.username}
        currentUserId={currentUser?.id || null}
      />

      {/* Banner Crop Modal */}
      {showBannerCrop && bannerImageToCrop && (
        <BannerCropModal
          imageSrc={bannerImageToCrop}
          onCancel={handleBannerCropCancel}
          onSave={handleBannerCropSave}
        />
      )}

      {/* Friends List Modal */}
      {showFriendsModal && (
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
          onClick={() => setShowFriendsModal(false)}
        >
          <div
            className="card"
            style={{
              width: "90%",
              maxWidth: 400,
              maxHeight: "70vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
            }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {profile?.display_name || profile?.username}&apos;s Friends
              </h3>
              <button
                onClick={() => setShowFriendsModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--alzooka-cream)",
                  fontSize: 24,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {loadingFriends ? (
                <p style={{ textAlign: "center", opacity: 0.6 }}>Loading...</p>
              ) : friendsList.length === 0 ? (
                <p style={{ textAlign: "center", opacity: 0.6 }}>No friends yet</p>
              ) : (
                friendsList.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile/${encodeURIComponent(friend.username)}`}
                    onClick={() => setShowFriendsModal(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 0",
                      borderBottom: "1px solid rgba(240, 235, 224, 0.05)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    {friend.avatar_url ? (
                      <img
                        src={friend.avatar_url}
                        alt=""
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
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
                        }}
                      >
                        {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {friend.display_name || friend.username}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
                        @{friend.username}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
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

