"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import { BannerCropModal } from "@/app/components/BannerCropModal";
import { GroupAvatarUpload } from "@/app/components/GroupAvatarUpload";
import { PostModal } from "@/app/components/PostModal";
import { ShareModal } from "@/app/components/ShareModal";
import { LinkPreview } from "@/app/components/LinkPreview";
import { notifyGroupInvite } from "@/lib/notifications";

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
  video_url: string | null;
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

// Instant Tooltip Component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 6,
            padding: "6px 10px",
            background: "var(--alzooka-teal-dark)",
            color: "var(--alzooka-cream)",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 4,
            whiteSpace: "nowrap",
            zIndex: 9999,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            border: "1px solid rgba(240, 235, 224, 0.2)",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// Helper function to render text with @mentions and URLs as clickable links
function renderTextWithLinksAndMentions(text: string): React.ReactNode[] {
  // Regex to match URLs (http, https, or www)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  // Regex to match @mentions
  const mentionRegex = /(@\w+)/g;
  
  // Combined regex to split by both URLs and mentions
  const combinedRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|@\w+)/gi;
  
  const parts = text.split(combinedRegex);
  
  return parts.map((part, i) => {
    if (!part) return null;
    
    // Check if it's a URL
    if (urlRegex.test(part)) {
      // Reset lastIndex after test
      urlRegex.lastIndex = 0;
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#6b9eff',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    
    // Check if it's a @mention
    if (mentionRegex.test(part)) {
      mentionRegex.lastIndex = 0;
      return (
        <span
          key={i}
          style={{
            color: 'var(--alzooka-gold)',
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    
    // Regular text
    return <span key={i}>{part}</span>;
  }).filter(Boolean);
}

// YouTube URL detection
function findYouTubeUrl(text: string): string | null {
  const urlPattern = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+)/i;
  const match = text.match(urlPattern);
  return match ? match[1] : null;
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractYouTubePlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&\s]+)/);
  return match ? match[1] : null;
}

// Spotify URL detection
function findSpotifyUrl(text: string): string | null {
  const urlPattern = /(https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+)/i;
  const match = text.match(urlPattern);
  return match ? match[1] : null;
}

function getSpotifyType(url: string): string | null {
  const match = url.match(/spotify\.com\/(track|album|playlist|episode|show)\//);
  return match ? match[1] : null;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [modalPost, setModalPost] = useState<any>(null);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [changingPrivacy, setChangingPrivacy] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<GroupInvite | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteResults, setInviteResults] = useState<Array<{id: string; username: string; display_name: string | null; avatar_url: string | null; hasPendingInvite?: boolean}>>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState<{videoId: string; url: string; title: string; playlistId?: string; playlistTitle?: string} | null>(null);
  const [loadingYoutubePreview, setLoadingYoutubePreview] = useState(false);
  const [spotifyPreview, setSpotifyPreview] = useState<{url: string; title: string; thumbnail: string; type: string} | null>(null);
  const [loadingSpotifyPreview, setLoadingSpotifyPreview] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [bannerImageToCrop, setBannerImageToCrop] = useState<string | null>(null);
  const [showDeleteText, setShowDeleteText] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [bannedUsers, setBannedUsers] = useState<Array<{id: string; user_id: string; users: {username: string; display_name: string | null; avatar_url: string | null}}>>([]);
  const [isUserBanned, setIsUserBanned] = useState(false);
  const [showBannedModal, setShowBannedModal] = useState(false);
  const [userFriendships, setUserFriendships] = useState<Record<string, string>>({}); // user_id -> friendship status
  const [pendingFriendActions, setPendingFriendActions] = useState<Record<string, boolean>>({});
  
  // Feed preferences state (default to include in feed when joining)
  const [showFeedPrefsModal, setShowFeedPrefsModal] = useState(false);
  const [feedPrefs, setFeedPrefs] = useState({
    include_in_feed: true,
    max_posts_per_day: 3,
    whitelist_members: [] as string[],
    mute_members: [] as string[],
    friends_only: false,
  });
  const [savingFeedPrefs, setSavingFeedPrefs] = useState(false);

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

      // Check if user is banned from this group
      const { data: banCheck } = await supabase
        .from("group_bans")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();
      
      const userIsBanned = !!banCheck;
      setIsUserBanned(userIsBanned);

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
        // eslint-disable-next-line react-hooks/immutability
        await loadFriendships(user.id);
      }

      // Load banned users if admin
      if (membership?.role === "admin") {
        // eslint-disable-next-line react-hooks/immutability
        await loadBannedUsers();
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

      // Load feed preferences if member
      if (membership) {
        const { data: prefs } = await supabase
          .from("user_group_preferences")
          .select("*")
          .eq("user_id", user.id)
          .eq("group_id", groupId)
          .single();
        
        if (prefs) {
          setFeedPrefs({
            include_in_feed: prefs.include_in_feed ?? false,
            max_posts_per_day: prefs.max_posts_per_day ?? 3,
            whitelist_members: prefs.whitelist_members ?? [],
            mute_members: prefs.mute_members ?? [],
            friends_only: prefs.friends_only ?? false,
          });
        }
      }

      setLoading(false);
    }

    init();
  }, [groupId]);

  // Realtime subscription for bans - instantly notify user when they are banned
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`group_bans_${groupId}_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_bans",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          // Check if the banned user is the current user
          if (payload.new && payload.new.user_id === user.id) {
            setIsUserBanned(true);
          }
          // Reload banned users list for admins
          if (userRole === "admin") {
            loadBannedUsers();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "group_bans",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          // Check if the unbanned user is the current user
          if (payload.old && payload.old.user_id === user.id) {
            setIsUserBanned(false);
          }
          // Reload banned users list for admins
          if (userRole === "admin") {
            loadBannedUsers();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, groupId, userRole]);

  // Realtime subscription for posts - new posts appear instantly
  useEffect(() => {
    if (!user || !isMember) return;

    const channel = supabase
      .channel(`group_posts_${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadPosts();
          loadVoteTotals();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "posts",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadPosts();
          loadVoteTotals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, groupId, isMember]);

  // Broadcast subscription for post deletions - more reliable than postgres_changes DELETE
  useEffect(() => {
    if (!user || !isMember) return;

    const channel = supabase
      .channel(`group_${groupId}_updates`)
      .on("broadcast", { event: "post_deleted" }, () => {
        loadPosts();
        loadVoteTotals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, groupId, isMember]);

  // Realtime subscription for comments - new comments appear instantly
  useEffect(() => {
    if (!user || !isMember) return;

    const channel = supabase
      .channel(`group_comments_${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        async (payload) => {
          // Check if the comment belongs to a post in this group
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
          if (postId) {
            // Check if this post belongs to this group
            const postInGroup = posts.some(p => p.id === postId);
            if (postInGroup) {
              await loadPosts();
              await loadVoteTotals();
              // Also refresh modal if open
              if (modalPost && modalPost.id === postId) {
                const freshPost = posts.find(p => p.id === postId);
                if (freshPost) {
                  setModalPost(freshPost);
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, groupId, isMember, posts, modalPost]);

  // Global escape key handler as a failsafe to close any stuck modal/overlay
  useEffect(() => {
    function handleGlobalEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModalPost(null);
        setShowMembers(false);
        setShowMembersModal(false);
        setShowBannedModal(false);
        setShowInviteModal(false);
        setShowBannerCrop(false);
        setShowEditMenu(false);
        setEditingInfo(false);
      }
    }
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, []);

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

  async function loadBannedUsers() {
    const { data, error } = await supabase
      .from("group_bans")
      .select(`
        id,
        user_id
      `)
      .eq("group_id", groupId);

    if (error) {
      console.error("Error loading banned users:", error);
      return;
    }

    if (!data || data.length === 0) {
      setBannedUsers([]);
      return;
    }

    // Fetch user details separately
    const userIds = data.map(ban => ban.user_id);
    const { data: usersData } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);

    const usersMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {};
    (usersData || []).forEach((u: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => {
      usersMap[u.id] = { username: u.username, display_name: u.display_name, avatar_url: u.avatar_url };
    });

    const formatted = data.map(ban => ({
      id: ban.id,
      user_id: ban.user_id,
      users: usersMap[ban.user_id] || { username: "Unknown", display_name: null, avatar_url: null },
    }));
    setBannedUsers(formatted);
  }

  async function checkIfUserBanned(userId: string) {
    const { data } = await supabase
      .from("group_bans")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .single();
    
    setIsUserBanned(!!data);
    return !!data;
  }

  async function loadFriendships(userId: string) {
    // Get all friendships for current user
    const { data } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    
    if (data) {
      const friendMap: Record<string, string> = {};
      data.forEach((f: { user_id: string; friend_id: string; status: string }) => {
        const otherUserId = f.user_id === userId ? f.friend_id : f.user_id;
        friendMap[otherUserId] = f.status;
      });
      setUserFriendships(friendMap);
    }
  }

  async function handleBanUser(userId: string) {
    if (!user || !confirm("Ban this user from the group? They will no longer be able to view or interact with this group.")) return;
    
    // Insert ban record
    const { error: banError } = await supabase
      .from("group_bans")
      .insert({ group_id: groupId, user_id: userId, banned_by: user.id });
    
    if (banError) {
      alert("Failed to ban user: " + banError.message);
      return;
    }
    
    // Remove from group members
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    
    await loadMembers();
    await loadBannedUsers();
  }

  async function handleUnbanUser(odLid: string) {
    if (!confirm("Unban this user? They will be able to rejoin the group.")) return;
    
    await supabase
      .from("group_bans")
      .delete()
      .eq("id", odLid);
    
    await loadBannedUsers();
  }

  async function handleMakeAdmin(memberId: string, userId: string) {
    if (!confirm("Make this user an admin? They will have full control over the group.")) return;
    
    const { error } = await supabase
      .from("group_members")
      .update({ role: "admin" })
      .eq("id", memberId);
    
    if (error) {
      alert("Failed to update role: " + error.message);
    } else {
      await loadMembers();
    }
  }

  async function handleRemoveAdmin(memberId: string) {
    if (!confirm("Remove admin privileges from this user?")) return;
    
    const { error } = await supabase
      .from("group_members")
      .update({ role: "member" })
      .eq("id", memberId);
    
    if (error) {
      alert("Failed to update role: " + error.message);
    } else {
      await loadMembers();
    }
  }

  async function handleAddFriend(friendId: string) {
    if (!user) return;
    
    setPendingFriendActions(prev => ({ ...prev, [friendId]: true }));
    
    const { error } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id: friendId, status: "pending" });
    
    if (!error) {
      setUserFriendships(prev => ({ ...prev, [friendId]: "pending" }));
    }
    
    setPendingFriendActions(prev => ({ ...prev, [friendId]: false }));
  }

  async function loadPosts() {
    const { data } = await supabase
      .from("posts")
      .select(`
        id,
        content,
        image_url,
        video_url,
        created_at,
        edited_at,
        user_id,
        users!posts_user_id_fkey (
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
          users!comments_user_id_fkey (
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

    // Check if user is banned
    if (isUserBanned) {
      alert("You have been banned from interacting with this group.");
      return;
    }

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

  function removeYoutubePreview() {
    setYoutubePreview(null);
  }

  function removeSpotifyPreview() {
    setSpotifyPreview(null);
  }

  async function handleContentChange(newContent: string) {
    setContent(newContent);
    
    // Check for YouTube URL if we don't already have a preview
    if (!youtubePreview && !spotifyPreview && !loadingYoutubePreview && !loadingSpotifyPreview) {
      const youtubeUrl = findYouTubeUrl(newContent);
      if (youtubeUrl) {
        const videoId = extractYouTubeVideoId(youtubeUrl);
        const playlistId = extractYouTubePlaylistId(youtubeUrl);
        if (videoId) {
          setLoadingYoutubePreview(true);
          try {
            const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(youtubeUrl)}`);
            const data = await response.json();
            
            // If playlist ID exists, try to fetch playlist title from the page
            let playlistTitle = undefined;
            if (playlistId) {
              try {
                const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
                const playlistResponse = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(playlistUrl)}`);
                const playlistData = await playlistResponse.json();
                playlistTitle = playlistData.title || undefined;
              } catch {
                // Ignore playlist title fetch errors
              }
            }
            
            setYoutubePreview({
              videoId,
              url: youtubeUrl,
              title: data.title || "YouTube Video",
              playlistId: playlistId || undefined,
              playlistTitle,
            });
          } catch {
            setYoutubePreview({
              videoId,
              url: youtubeUrl,
              title: "YouTube Video",
              playlistId: playlistId || undefined,
            });
          }
          setLoadingYoutubePreview(false);
        }
        return;
      }

      // Check for Spotify URL if no YouTube URL found
      const spotifyUrl = findSpotifyUrl(newContent);
      if (spotifyUrl) {
        const spotifyType = getSpotifyType(spotifyUrl);
        if (spotifyType) {
          setLoadingSpotifyPreview(true);
          try {
            const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
            const data = await response.json();
            setSpotifyPreview({
              url: spotifyUrl,
              title: data.title || "Spotify",
              thumbnail: data.thumbnail_url || "",
              type: spotifyType,
            });
          } catch {
            setSpotifyPreview({
              url: spotifyUrl,
              title: `Spotify ${spotifyType.charAt(0).toUpperCase() + spotifyType.slice(1)}`,
              thumbnail: "",
              type: spotifyType,
            });
          }
          setLoadingSpotifyPreview(false);
        }
      }
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if ((!content.trim() && !selectedImage && !youtubePreview && !spotifyPreview) || !user) return;

    // Check if user is banned
    if (isUserBanned) {
      alert("You have been banned from interacting with this group.");
      return;
    }

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
        video_url: youtubePreview?.url || spotifyPreview?.url || null,
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
      setYoutubePreview(null);
      setSpotifyPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadPosts();
      await loadUserVotes(user.id);
      await loadVoteTotals();
    }

    setPosting(false);
  }

  async function handleJoin() {
    if (!user) return;

    // Check if user is banned
    if (isUserBanned) {
      alert("You have been banned from interacting with this group.");
      return;
    }

    const { error } = await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: user.id,
      role: "member",
    });

    if (error) {
      alert("Unable to join group. You may have been banned.");
      return;
    }

    // Auto-create feed preferences with include_in_feed = true
    await supabase.from("user_group_preferences").upsert({
      user_id: user.id,
      group_id: groupId,
      include_in_feed: true,
      max_posts_per_day: 3,
      whitelist_members: [],
      mute_members: [],
      friends_only: false,
    }, { onConflict: "user_id,group_id" });

    setFeedPrefs({
      include_in_feed: true,
      max_posts_per_day: 3,
      whitelist_members: [],
      mute_members: [],
      friends_only: false,
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

  async function saveFeedPreferences() {
    if (!user) return;
    setSavingFeedPrefs(true);
    
    await supabase
      .from("user_group_preferences")
      .upsert({
        user_id: user.id,
        group_id: groupId,
        include_in_feed: feedPrefs.include_in_feed,
        max_posts_per_day: feedPrefs.max_posts_per_day,
        whitelist_members: feedPrefs.whitelist_members,
        mute_members: feedPrefs.mute_members,
        friends_only: feedPrefs.friends_only,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,group_id",
      });
    
    setSavingFeedPrefs(false);
    setShowFeedPrefsModal(false);
  }

  function toggleWhitelist(userId: string) {
    setFeedPrefs(prev => {
      const isWhitelisted = prev.whitelist_members.includes(userId);
      // Remove from mute if adding to whitelist
      const newMute = isWhitelisted ? prev.mute_members : prev.mute_members.filter(id => id !== userId);
      return {
        ...prev,
        whitelist_members: isWhitelisted 
          ? prev.whitelist_members.filter(id => id !== userId)
          : [...prev.whitelist_members, userId],
        mute_members: newMute,
      };
    });
  }

  function toggleMute(userId: string) {
    setFeedPrefs(prev => {
      const isMuted = prev.mute_members.includes(userId);
      // Remove from whitelist if adding to mute
      const newWhitelist = isMuted ? prev.whitelist_members : prev.whitelist_members.filter(id => id !== userId);
      return {
        ...prev,
        mute_members: isMuted 
          ? prev.mute_members.filter(id => id !== userId)
          : [...prev.mute_members, userId],
        whitelist_members: newWhitelist,
      };
    });
  }

  async function handleBannerSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !group) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be less than 10MB");
      return;
    }

    // Upload directly without cropping
    setUploadingBanner(true);
    
    const fileName = `group-${groupId}-banner-${Date.now()}.${file.name.split('.').pop()}`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

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

  function handleCropExistingBanner() {
    if (!group?.banner_url) return;
    setBannerImageToCrop(group.banner_url);
    setShowBannerCrop(true);
  }

  async function handleBannerCropSave(croppedBlob: Blob) {
    if (!user || !group) return;

    setUploadingBanner(true);
    setShowBannerCrop(false);
    setBannerImageToCrop(null);

    const fileName = `group-${groupId}-banner-${Date.now()}.jpg`;
    const filePath = `banners/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, croppedBlob, { cacheControl: "3600", upsert: true, contentType: "image/jpeg" });

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
  }

  function handleBannerCropCancel() {
    setShowBannerCrop(false);
    setBannerImageToCrop(null);
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

    // Auto-create feed preferences with include_in_feed = true
    await supabase.from("user_group_preferences").upsert({
      user_id: user.id,
      group_id: groupId,
      include_in_feed: true,
      max_posts_per_day: 3,
      whitelist_members: [],
      mute_members: [],
      friends_only: false,
    }, { onConflict: "user_id,group_id" });

    setFeedPrefs({
      include_in_feed: true,
      max_posts_per_day: 3,
      whitelist_members: [],
      mute_members: [],
      friends_only: false,
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

    if (data && data.length > 0) {
      // Check which users already have pending invites
      const userIds = data.map(u => u.id);
      const { data: existingInvites } = await supabase
        .from("group_invites")
        .select("invited_user_id")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .in("invited_user_id", userIds);

      const pendingUserIds = new Set((existingInvites || []).map(i => i.invited_user_id));
      
      // Add hasPendingInvite flag to results
      const resultsWithPending = data.map(u => ({
        ...u,
        hasPendingInvite: pendingUserIds.has(u.id),
      }));
      
      setInviteResults(resultsWithPending);
    } else {
      setInviteResults([]);
    }
  }

  async function sendInvite(invitedUserId: string) {
    if (!user || !group) return;

    setSendingInvite(true);

    const { error } = await supabase.from("group_invites").insert({
      group_id: groupId,
      invited_user_id: invitedUserId,
      invited_by: user.id,
    });

    if (!error) {
      // Send notification to invited user
      await notifyGroupInvite(
        supabase,
        invitedUserId,
        userUsername || "Someone",
        groupId,
        group.name
      );
      
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
    
    // Broadcast to other clients that a post was deleted
    const channel = supabase.channel(`group_${groupId}_updates`);
    await channel.send({
      type: "broadcast",
      event: "post_deleted",
      payload: { postId },
    });
    supabase.removeChannel(channel);
  }

  async function handleDeleteGroup() {
    setShowEditMenu(false);
    if (!confirm(`Are you sure you want to delete ${group?.name}? This action cannot be undone and will delete all posts and data associated with this group.`)) return;
    
    if (!confirm("This is your final warning. Are you ABSOLUTELY sure?")) return;

    try {
      // Delete all related data first
      // 1. Delete all posts in this group
      await supabase.from("posts").delete().eq("group_id", groupId);
      
      // 2. Delete all group invites
      await supabase.from("group_invites").delete().eq("group_id", groupId);
      
      // 3. Delete all group members
      await supabase.from("group_members").delete().eq("group_id", groupId);
      
      // 4. Finally delete the group itself
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);

      if (error) {
        alert("Failed to delete group: " + error.message);
        console.error("Delete error:", error);
      } else {
        router.push("/groups");
      }
    } catch (err) {
      alert("An error occurred while deleting the group");
      console.error("Delete error:", err);
    }
  }

  async function handleEditInfo() {
    if (!newGroupName.trim() || !group) return;
    
    const { error } = await supabase
      .from("groups")
      .update({ 
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null
      })
      .eq("id", groupId);
    
    if (!error) {
      setGroup({ 
        ...group, 
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null
      });
      setEditingInfo(false);
      setNewGroupName("");
      setNewGroupDescription("");
    } else {
      alert("Failed to update group info");
    }
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
        justifyContent: "center", 
        alignItems: "center",
        gap: 24,
        padding: "20px 40px",
        marginBottom: 32,
        borderBottom: "1px solid rgba(240, 235, 224, 0.2)"
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo size={32} />
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 400, color: "var(--alzooka-cream)" }}>Alzooka</h1>
        </Link>
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
      </header>

      {/* Group Header - Banner with overlay content */}
      <div
        style={{
          marginBottom: 24,
          borderRadius: 12,
          overflow: "hidden",
          background: group.banner_url
            ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(26,58,74,0.95) 70%), url(${group.banner_url}) center/cover`
            : "linear-gradient(135deg, var(--alzooka-teal-dark) 0%, var(--alzooka-teal) 100%)",
          position: "relative",
          padding: "24px",
          minHeight: 300,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {/* Post Count - Upper Left */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            textAlign: "center",
            background: "rgba(0, 0, 0, 0.5)",
            padding: "8px 14px",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--alzooka-gold)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total Posts
          </div>
          <div style={{ fontSize: 20, color: "var(--alzooka-gold)", fontWeight: 700 }}>
            {posts.length}
          </div>
        </div>

        {/* Admin Edit button for banner */}
        {userRole === "admin" && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerSelect}
              style={{ display: "none" }}
            />
            <div style={{ position: "absolute", top: 12, right: 12 }}>
              <button
                onClick={() => setShowEditMenu(!showEditMenu)}
                style={{
                  background: "rgba(0, 0, 0, 0.7)",
                  border: "none",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                }}
              >
                ⚙️ Edit
              </button>
              
              {/* Dropdown Menu */}
              {showEditMenu && (
                <>
                  {/* Invisible overlay to close dropdown when clicking outside */}
                  <div
                    onClick={() => setShowEditMenu(false)}
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 99,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      background: "var(--alzooka-teal-dark)",
                      border: "1px solid rgba(240, 235, 224, 0.2)",
                      borderRadius: 8,
                      minWidth: 200,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      zIndex: 100,
                    }}
                  >
                  <button
                    onClick={() => {
                      setShowEditMenu(false);
                      bannerInputRef.current?.click();
                    }}
                    disabled={uploadingBanner}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "var(--alzooka-cream)",
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 14,
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    📷 {uploadingBanner ? "Uploading..." : "Change Banner"}
                  </button>
                  
                  {group.banner_url && (
                    <button
                      onClick={() => {
                        setShowEditMenu(false);
                        handleCropExistingBanner();
                      }}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        color: "var(--alzooka-cream)",
                        padding: "12px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 14,
                        borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                      }}
                    >
                      ✂️ Crop Banner
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowEditMenu(false);
                      setNewGroupName(group.name);
                      setNewGroupDescription(group.description || "");
                      setEditingInfo(true);
                    }}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "var(--alzooka-cream)",
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 14,
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    ✏️ Edit Info
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowEditMenu(false);
                      togglePrivacy();
                    }}
                    disabled={changingPrivacy}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "var(--alzooka-cream)",
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 14,
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    {group.privacy === "public" ? "🔒 Make Private" : "🌐 Make Public"}
                  </button>
                  
                  {group.privacy === "private" && (
                    <button
                      onClick={() => {
                        setShowEditMenu(false);
                        toggleMemberInvites();
                      }}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        color: "var(--alzooka-cream)",
                        padding: "12px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: 14,
                        borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                      }}
                    >
                      {group.allow_member_invites ? "🚫 Disable Member Invites" : "✅ Allow Member Invites"}
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setShowEditMenu(false);
                      setShowBannedModal(true);
                    }}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "var(--alzooka-cream)",
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 14,
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                    }}
                  >
                    🚫 Banned Users {bannedUsers.length > 0 && `(${bannedUsers.length})`}
                  </button>
                  
                  <button
                    onClick={handleDeleteGroup}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: "#ff6b6b",
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    🗑️ Delete Group
                  </button>
                </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Group Info - overlaid on banner */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "nowrap" }}>
          {/* Avatar - editable for admins, static for others */}
          {userRole === "admin" ? (
            <GroupAvatarUpload
              currentAvatarUrl={group.avatar_url}
              groupId={groupId}
              groupName={group.name}
              onUpload={(url) => setGroup({ ...group, avatar_url: url })}
            />
          ) : group.avatar_url ? (
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setShowMembersModal(true)}
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
              <span style={{ fontSize: 14, color: "var(--alzooka-cream)" }}>
                {group.privacy === "public" ? "🌐 Public" : "🔒 Private"}
              </span>
              {/* Spacer to push buttons to the right */}
              <div style={{ flex: 1 }} />
              {/* Buttons */}
              {isMember ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setShowFeedPrefsModal(true)}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                    }}
                    title="Feed Settings"
                  >
                    ⚙️ Feed
                  </button>
                  {(group.privacy === "public" || (group.privacy === "private" && (userRole === "admin" || group.allow_member_invites))) && (
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
                </div>
              ) : isUserBanned ? (
                <span style={{ fontSize: 14, color: "#e57373", opacity: 0.9 }}>
                  🚫 Banned
                </span>
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
        </div>

        {/* Description */}
        {group.description && (
          <p style={{ margin: "12px 0 0 0", opacity: 0.9, lineHeight: 1.5, fontSize: 14 }}>{group.description}</p>
        )}

      </div>

      {/* Members Modal */}
      {showMembersModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setShowMembersModal(false);
            setMemberSearch("");
          }}
        >
          <div
            className="card"
            style={{ 
              width: "90%", 
              maxWidth: 480, 
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Members ({members.length})</h2>
              <button
                onClick={() => {
                  setShowMembersModal(false);
                  setMemberSearch("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--alzooka-cream)",
                  fontSize: 24,
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                ×
              </button>
            </div>
            
            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search members..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            
            {/* Scrollable Members List */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", maxHeight: 400 }}>
              {members
                .filter(m => {
                  if (!memberSearch) return true;
                  const search = memberSearch.toLowerCase();
                  return (
                    m.users.username.toLowerCase().includes(search) ||
                    (m.users.display_name?.toLowerCase().includes(search))
                  );
                })
                .map(member => {
                  const friendStatus = userFriendships[member.user_id];
                  const isCurrentUser = member.user_id === user?.id;
                  const isPending = pendingFriendActions[member.user_id];
                  
                  return (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 0",
                        borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                        gap: 12,
                      }}
                    >
                      {/* Avatar */}
                      <Link href={`/profile/${encodeURIComponent(member.users.username)}`} onClick={() => setShowMembersModal(false)}>
                        {member.users.avatar_url ? (
                          <img src={member.users.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            background: "var(--alzooka-gold)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--alzooka-teal-dark)",
                            fontWeight: 700,
                            fontSize: 16,
                          }}>
                            {(member.users.display_name || member.users.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Link>
                      
                      {/* Name & Role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link 
                          href={`/profile/${encodeURIComponent(member.users.username)}`} 
                          onClick={() => setShowMembersModal(false)}
                          style={{ textDecoration: "none" }}
                        >
                          <div style={{ fontWeight: 600, color: "var(--alzooka-cream)" }}>
                            {member.users.display_name || member.users.username}
                          </div>
                        </Link>
                        {member.role === "admin" && (
                          <span style={{ fontSize: 12, color: "var(--alzooka-gold)" }}>Admin</span>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {/* Friend Button - not for self */}
                        {!isCurrentUser && (
                          friendStatus === "accepted" ? (
                            <span style={{ fontSize: 12, color: "var(--alzooka-gold)", padding: "6px 10px" }}>✓ Friends</span>
                          ) : friendStatus === "pending" ? (
                            <span style={{ fontSize: 12, opacity: 0.6, padding: "6px 10px" }}>Pending</span>
                          ) : (
                            <button
                              onClick={() => handleAddFriend(member.user_id)}
                              disabled={isPending}
                              style={{
                                background: "transparent",
                                border: "1px solid var(--alzooka-gold)",
                                color: "var(--alzooka-gold)",
                                fontSize: 12,
                                padding: "6px 10px",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              {isPending ? "..." : "Add Friend"}
                            </button>
                          )
                        )}
                        
                        {/* Admin Controls */}
                        {userRole === "admin" && !isCurrentUser && (
                          <>
                            {member.role !== "admin" ? (
                              <Tooltip text="Make Admin">
                                <button
                                  onClick={() => handleMakeAdmin(member.id, member.user_id)}
                                  style={{
                                    background: "transparent",
                                    border: "1px solid rgba(240, 235, 224, 0.3)",
                                    color: "var(--alzooka-cream)",
                                    fontSize: 11,
                                    padding: "6px 8px",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  👑
                                </button>
                              </Tooltip>
                            ) : (
                              <Tooltip text="Remove Admin">
                                <button
                                  onClick={() => handleRemoveAdmin(member.id)}
                                  style={{
                                    background: "transparent",
                                    border: "1px solid rgba(240, 235, 224, 0.3)",
                                    color: "var(--alzooka-cream)",
                                    fontSize: 11,
                                    padding: "6px 8px",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                  }}
                                >
                                  👤
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip text="Ban User">
                              <button
                                onClick={() => handleBanUser(member.user_id)}
                                style={{
                                  background: "transparent",
                                  border: "1px solid #e57373",
                                  color: "#e57373",
                                  fontSize: 11,
                                  padding: "6px 8px",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                }}
                              >
                                🚫
                              </button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            
            <button
              onClick={() => {
                setShowMembersModal(false);
                setMemberSearch("");
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

      {/* Banned Users Modal */}
      {showBannedModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowBannedModal(false)}
        >
          <div
            className="card"
            style={{ 
              width: "90%", 
              maxWidth: 480, 
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Banned Users ({bannedUsers.length})</h2>
              <button
                onClick={() => setShowBannedModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--alzooka-cream)",
                  fontSize: 24,
                  cursor: "pointer",
                  padding: "0 8px",
                }}
              >
                ×
              </button>
            </div>
            
            {/* Banned Users List */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 400 }}>
              {bannedUsers.length === 0 ? (
                <p className="text-muted" style={{ textAlign: "center", padding: 20 }}>
                  No banned users
                </p>
              ) : (
                bannedUsers.map(ban => (
                  <div
                    key={ban.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                      gap: 12,
                    }}
                  >
                    {/* Avatar */}
                    {ban.users?.avatar_url ? (
                      <img src={ban.users.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "#666",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 16,
                      }}>
                        {(ban.users?.display_name || ban.users?.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--alzooka-cream)" }}>
                        {ban.users?.display_name || ban.users?.username || "Unknown"}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.6 }}>Banned</div>
                    </div>
                    
                    {/* Unban Button */}
                    <button
                      onClick={() => handleUnbanUser(ban.id)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--alzooka-gold)",
                        color: "var(--alzooka-gold)",
                        fontSize: 12,
                        padding: "6px 12px",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Unban
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <button
              onClick={() => setShowBannedModal(false)}
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

      {/* Feed Preferences Modal */}
      {showFeedPrefsModal && (
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
          onClick={() => setShowFeedPrefsModal(false)}
        >
          <div
            className="card"
            style={{ width: "90%", maxWidth: 500, maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Feed Settings for {group?.name}</h2>
            
            {/* Include in Feed Toggle */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={feedPrefs.include_in_feed}
                  onChange={e => setFeedPrefs(prev => ({ ...prev, include_in_feed: e.target.checked }))}
                  style={{ width: 20, height: 20 }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>Include posts in my feed</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Show posts from this group in your main newsfeed</div>
                </div>
              </label>
            </div>

            {feedPrefs.include_in_feed && (
              <>
                {/* Max Posts Per Day */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Max posts per day: {feedPrefs.max_posts_per_day}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={feedPrefs.max_posts_per_day}
                    onChange={e => setFeedPrefs(prev => ({ ...prev, max_posts_per_day: parseInt(e.target.value) }))}
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.5 }}>
                    <span>1</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Friends Only Toggle */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={feedPrefs.friends_only}
                      onChange={e => setFeedPrefs(prev => ({ ...prev, friends_only: e.target.checked }))}
                      style={{ width: 20, height: 20 }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>Friends only</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Only show posts from your friends in this group</div>
                    </div>
                  </label>
                </div>

                {/* Member Controls */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Member Controls</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                    Prioritize or mute specific members
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {members.map(member => (
                      <div
                        key={member.user_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                          <span style={{ fontSize: 14 }}>{member.users.display_name || member.users.username}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => toggleWhitelist(member.user_id)}
                            style={{
                              background: feedPrefs.whitelist_members.includes(member.user_id) ? "var(--alzooka-gold)" : "transparent",
                              border: "1px solid var(--alzooka-gold)",
                              color: feedPrefs.whitelist_members.includes(member.user_id) ? "var(--alzooka-teal-dark)" : "var(--alzooka-gold)",
                              padding: "4px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                            title="Prioritize posts from this member"
                          >
                            ⭐
                          </button>
                          <button
                            onClick={() => toggleMute(member.user_id)}
                            style={{
                              background: feedPrefs.mute_members.includes(member.user_id) ? "#e57373" : "transparent",
                              border: "1px solid #e57373",
                              color: feedPrefs.mute_members.includes(member.user_id) ? "white" : "#e57373",
                              padding: "4px 8px",
                              fontSize: 11,
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                            title="Mute posts from this member"
                          >
                            🔇
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Save/Cancel Buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                onClick={saveFeedPreferences}
                disabled={savingFeedPrefs}
                style={{ flex: 1 }}
              >
                {savingFeedPrefs ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => setShowFeedPrefsModal(false)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  color: "var(--alzooka-cream)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {u.hasPendingInvite ? (
                      <span
                        style={{
                          padding: "6px 12px",
                          fontSize: 13,
                          color: "var(--alzooka-gold)",
                          opacity: 0.7,
                        }}
                      >
                        Pending
                      </span>
                    ) : (
                      <button
                        onClick={() => sendInvite(u.id)}
                        disabled={sendingInvite}
                        style={{ padding: "6px 12px", fontSize: 13 }}
                      >
                        Invite
                      </button>
                    )}
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

      {/* Edit Info Modal */}
      {editingInfo && (
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
            setEditingInfo(false);
            setNewGroupName("");
            setNewGroupDescription("");
          }}
        >
          <div
            className="card"
            style={{ width: "90%", maxWidth: 500 }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Edit Group Info</h2>
            
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
              Group Name
            </label>
            <input
              type="text"
              placeholder="Group name"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              autoFocus
              maxLength={100}
              style={{ marginBottom: 16 }}
            />
            
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
              Description (optional)
            </label>
            <textarea
              placeholder="Describe what this group is about..."
              value={newGroupDescription}
              onChange={e => setNewGroupDescription(e.target.value)}
              rows={3}
              maxLength={500}
              style={{ marginBottom: 16, resize: "vertical" }}
            />
            
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={handleEditInfo}
                disabled={!newGroupName.trim() || (newGroupName.trim() === group.name && newGroupDescription.trim() === (group.description || ""))}
                style={{ flex: 1 }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingInfo(false);
                  setNewGroupName("");
                  setNewGroupDescription("");
                }}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  color: "var(--alzooka-cream)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banned User Message */}
      {isUserBanned && (
        <div className="card" style={{ marginBottom: 24, textAlign: "center", padding: 20, background: "rgba(229, 115, 115, 0.1)", border: "1px solid rgba(229, 115, 115, 0.3)" }}>
          <p style={{ margin: 0, color: "#e57373" }}>🚫 You have been banned from interacting with this group.</p>
        </div>
      )}

      {/* Post Form (members only, not banned) */}
      {isMember && !isUserBanned && (
        <form onSubmit={handlePost} style={{ marginBottom: 24 }}>
          <textarea
            placeholder={`Share something with ${group.name}... Paste a YouTube or Spotify link to share`}
            value={content}
            onChange={e => handleContentChange(e.target.value)}
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
          {loadingYoutubePreview && (
            <div style={{ marginBottom: 12, padding: 16, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
              <p style={{ margin: 0, opacity: 0.6 }}>Loading video preview...</p>
            </div>
          )}
          {youtubePreview && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ 
                background: "var(--alzooka-teal-dark)", 
                borderRadius: 8, 
                overflow: "hidden",
                border: "1px solid rgba(240, 235, 224, 0.2)"
              }}>
                <img 
                  src={`https://img.youtube.com/vi/${youtubePreview.videoId}/hqdefault.jpg`}
                  alt="YouTube thumbnail"
                  style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: "12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
                    YouTube.com
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                    {youtubePreview.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeYoutubePreview}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0, 0, 0, 0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "white",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          )}
          {loadingSpotifyPreview && (
            <div style={{ marginBottom: 12, padding: 16, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
              <p style={{ margin: 0, opacity: 0.6 }}>Loading Spotify preview...</p>
            </div>
          )}
          {spotifyPreview && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{ 
                background: "var(--alzooka-teal-dark)", 
                borderRadius: 8, 
                overflow: "hidden",
                border: "1px solid rgba(240, 235, 224, 0.2)"
              }}>
                {spotifyPreview.thumbnail && (
                  <img 
                    src={spotifyPreview.thumbnail}
                    alt="Spotify artwork"
                    style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                  />
                )}
                <div style={{ padding: "12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
                    🎵 Spotify.com
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                    {spotifyPreview.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeSpotifyPreview}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0, 0, 0, 0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "white",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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
            <button type="submit" disabled={posting || (!content.trim() && !selectedImage && !youtubePreview && !spotifyPreview)}>
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
            onOpenModal={() => setModalPost(post)}
            onRefresh={async () => {
              await loadPosts();
              await loadUserVotes(user!.id);
              await loadVoteTotals();
            }}
            userRole={userRole}
            members={members}
            onBanUser={userRole === "admin" ? handleBanUser : undefined}
          />
        ))
      )}

      {/* Banner Crop Modal */}
      {showBannerCrop && bannerImageToCrop && (
        <BannerCropModal
          imageSrc={bannerImageToCrop}
          onCancel={handleBannerCropCancel}
          onSave={handleBannerCropSave}
        />
      )}

      {/* Post Modal for Comments */}
      {modalPost && user && (
        <PostModal
          post={modalPost}
          user={user}
          supabase={supabase}
          votes={votes}
          voteTotals={voteTotals}
          onVote={handleVote}
          onClose={() => setModalPost(null)}
          onCommentAdded={async () => {
            await loadPosts();
            await loadUserVotes(user.id);
            await loadVoteTotals();

            // Refresh the modal post data
            const freshData = posts.find(p => p.id === modalPost.id);
            if (freshData) {
              setModalPost(freshData);
            }
          }}
          groupMembers={members.map(m => ({ user_id: m.user_id, role: m.role }))}
          isUserGroupAdmin={userRole === "admin"}
          isUserBanned={isUserBanned}
          onBanUser={userRole === "admin" ? handleBanUser : undefined}
        />
      )}
    </div>
  );
}

// Playlist Title Component - fetches and displays YouTube playlist title
function PlaylistTitle({ videoUrl, playlistId }: { videoUrl: string; playlistId: string }) {
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlaylistTitle() {
      try {
        // Try YouTube's oEmbed API first (works for playlists)
        const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(playlistUrl)}&format=json`);
        
        if (response.ok) {
          const data = await response.json();
          setTitle(data.title || null);
        } else {
          // Fallback: try to get it from the video URL with list parameter
          const response2 = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(videoUrl)}`);
          const data2 = await response2.json();
          // Extract playlist title from video title if it contains indicators
          if (data2.title) {
            const title = data2.title;
            // Look for common playlist/album patterns in the title
            if (title.toLowerCase().includes('full album') || 
                title.toLowerCase().includes('playlist') ||
                title.match(/\(.*(?:album|playlist|mix).*\)/i)) {
              setTitle(title);
            } else {
              setTitle(null);
            }
          } else {
            setTitle(null);
          }
        }
      } catch {
        setTitle(null);
      }
      setLoading(false);
    }

    fetchPlaylistTitle();
  }, [playlistId, videoUrl]);

  if (loading) {
    return (
      <div style={{
        marginBottom: 12,
        padding: "12px 16px",
        background: "rgba(217, 171, 92, 0.1)",
        borderRadius: 8,
        borderLeft: "4px solid var(--alzooka-gold)",
      }}>
        <div style={{ fontSize: 14, color: "var(--alzooka-cream)", opacity: 0.7 }}>
          Loading playlist info...
        </div>
      </div>
    );
  }

  if (!title) {
    return (
      <div style={{
        marginBottom: 12,
        padding: "12px 16px",
        background: "rgba(217, 171, 92, 0.1)",
        borderRadius: 8,
        borderLeft: "4px solid var(--alzooka-gold)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--alzooka-gold)" }}>
          📀 Full Album/Playlist
        </div>
        <div style={{ fontSize: 13, color: "var(--alzooka-cream)", opacity: 0.7, marginTop: 4 }}>
          This will autoplay through all tracks
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 12,
      padding: "12px 16px",
      background: "rgba(217, 171, 92, 0.1)",
      borderRadius: 8,
      borderLeft: "4px solid var(--alzooka-gold)",
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--alzooka-gold)" }}>
        📀 {title}
      </div>
      <div style={{ fontSize: 13, color: "var(--alzooka-cream)", opacity: 0.7, marginTop: 4 }}>
        This will autoplay through all tracks
      </div>
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
  onOpenModal,
  onRefresh,
  userRole,
  members,
  onBanUser,
}: {
  post: Post;
  user: User;
  supabase: ReturnType<typeof createBrowserClient>;
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
  onDelete: (id: string) => void;
  onOpenModal: () => void;
  onRefresh: () => void;
  userRole: string | null;
  members: Member[];
  onBanUser?: (userId: string) => void;
}) {
  // Check if the post author is an admin
  const isPostAuthorAdmin = members.some(m => m.user_id === post.user_id && m.role === "admin");
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Count all comments recursively (unlimited depth)
  const countCommentsRecursive = (comments: Comment[]): number => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies ? countCommentsRecursive(comment.replies) : 0);
    }, 0);
  };

  const commentCount = countCommentsRecursive(post.comments || []);

  const postKey = `post-${post.id}`;
  const userVote = votes[postKey]?.value || 0;
  const score = voteTotals[postKey] || 0;
  const scoreColor = score > 0 ? "var(--alzooka-gold)" : score < 0 ? "#e57373" : "var(--alzooka-cream)";

  async function handleSaveEdit() {
    if (!editContent.trim() && !post.image_url && !post.video_url) return;
    
    setSaving(true);

    const { error } = await supabase
      .from("posts")
      .update({
        content: editContent.trim(),
        edited_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (!error) {
      setIsEditing(false);
      onRefresh();
    } else {
      alert("Failed to update post");
    }

    setSaving(false);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditContent(post.content);
  }

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
                {isPostAuthorAdmin && (
                  <span style={{ 
                    marginLeft: 8, 
                    fontSize: 11, 
                    color: "var(--alzooka-gold)",
                    background: "rgba(201, 165, 92, 0.15)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontWeight: 600,
                  }}>
                    Admin
                  </span>
                )}
                <span className="text-muted" style={{ marginLeft: 8, fontSize: 14 }}>
                  {formatTime(post.created_at)}
                </span>
              </div>
            </Link>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Share button - visible to everyone */}
              <button
                onClick={() => setShowShareModal(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--alzooka-cream)",
                  fontSize: 12,
                  cursor: "pointer",
                  opacity: 0.7,
                  padding: "4px 8px",
                }}
                title="Share post"
              >
                Share
              </button>
              {/* Edit - visible to owner only */}
              {post.user_id === user.id && (
                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--alzooka-cream)",
                    fontSize: 12,
                    cursor: "pointer",
                    opacity: 0.7,
                    padding: "4px 8px",
                  }}
                  title="Edit post"
                >
                  Edit
                </button>
              )}
              {/* Delete - visible to owner OR group admin */}
              {(post.user_id === user.id || userRole === "admin") && (
                <button
                  onClick={() => onDelete(post.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#e57373",
                    fontSize: 12,
                    cursor: "pointer",
                    opacity: 0.7,
                    padding: "4px 8px",
                  }}
                  title="Delete post"
                >
                  Delete
                </button>
              )}
              {/* Ban User - visible to admin, not on own posts */}
              {userRole === "admin" && post.user_id !== user.id && onBanUser && (
                <Tooltip text="Ban User">
                  <button
                    onClick={() => onBanUser(post.user_id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#e57373",
                      fontSize: 14,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    🚫
                  </button>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Post Content - Edit Mode or View Mode */}
          {isEditing ? (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                style={{ marginBottom: 12, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSaveEdit} disabled={saving} style={{ padding: "8px 16px", fontSize: 14 }}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: "8px 16px",
                    fontSize: 14,
                    background: "transparent",
                    border: "1px solid rgba(240, 235, 224, 0.3)",
                    color: "var(--alzooka-cream)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            post.content && (() => {
              // Strip YouTube or Spotify URL from displayed content if video exists
              let displayContent = post.content;
              if (post.video_url && displayContent) {
                displayContent = displayContent
                  .replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+/gi, '')
                  .replace(/https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+/gi, '')
                  .trim();
              }
              // Also strip URLs that will have link previews (non-YouTube/Spotify URLs when no image/video)
              if (!post.image_url && !post.video_url && displayContent) {
                displayContent = displayContent
                  .replace(/https?:\/\/(?!(?:www\.)?(?:youtube\.com|youtu\.be|open\.spotify\.com))[^\s]+/gi, '')
                  .trim();
              }
              return displayContent ? <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>{renderTextWithLinksAndMentions(displayContent)}</p> : null;
            })()
          )}
          {/* Link Preview for non-YouTube/Spotify URLs */}
          {!post.image_url && !post.video_url && post.content && (() => {
            // Find URLs that are not YouTube or Spotify
            const urlRegex = /https?:\/\/[^\s]+/gi;
            const urls = post.content.match(urlRegex) || [];
            const previewUrl = urls.find(url => 
              !url.match(/youtube\.com|youtu\.be|spotify\.com/i)
            );
            return previewUrl ? <LinkPreview url={previewUrl} /> : null;
          })()}
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
          {post.video_url && (() => {
            // Check if it's a YouTube URL
            const videoId = extractYouTubeVideoId(post.video_url);
            if (videoId) {
              const playlistId = extractYouTubePlaylistId(post.video_url);
              const embedUrl = playlistId
                ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0`
                : `https://www.youtube.com/embed/${videoId}?rel=0`;

              return (
                <div style={{ marginBottom: 16 }}>
                  {playlistId && (
                    <PlaylistTitle videoUrl={post.video_url} playlistId={playlistId} />
                  )}
                  <div style={{
                    position: "relative",
                    paddingBottom: "56.25%",
                    height: 0,
                    overflow: "hidden",
                    borderRadius: 8,
                    background: "#000",
                  }}>
                    <iframe
                      src={embedUrl}
                      title="YouTube video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                      }}
                    />
                  </div>
                </div>
              );
            }
            
            // Check if it's a Spotify URL
            const spotifyUrl = findSpotifyUrl(post.video_url);
            if (spotifyUrl) {
              // Extract Spotify URI for embed
              const match = spotifyUrl.match(/spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
              if (match) {
                const [, type, id] = match;
                return (
                  <div style={{ marginBottom: 16 }}>
                    <iframe
                      style={{ borderRadius: 12, width: "100%", height: type === "track" || type === "episode" ? 152 : 380 }}
                      src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator`}
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                    />
                  </div>
                );
              }
            }
            
            return null;
          })()}

          <button
            onClick={onOpenModal}
            style={{
              background: "transparent",
              color: "var(--alzooka-cream)",
              padding: "4px 0",
              fontSize: 14,
              border: "none",
              opacity: 0.7,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
          >
            <span style={{ fontSize: 14 }}>💬</span>
            <span style={{ fontSize: 14 }}>
              {commentCount === 0
                ? "Comment"
                : `${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
            </span>
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          postId={post.id}
          postContent={post.content}
          postImageUrl={post.image_url}
          postVideoUrl={post.video_url}
          originalPosterName={post.users?.display_name || post.users?.username || "Unknown"}
          supabase={supabase}
          userId={user.id}
          onClose={() => setShowShareModal(false)}
          onShared={onRefresh}
        />
      )}
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

