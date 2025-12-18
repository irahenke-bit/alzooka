"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { AvatarUpload } from "@/app/components/AvatarUpload";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import Header from "@/app/components/Header";
import { FriendButton } from "@/app/components/FriendButton";
import { ProfilePictureModal } from "@/app/components/ProfilePictureModal";
import { BannerCropModal } from "@/app/components/BannerCropModal";
import { PostModal } from "@/app/components/PostModal";
import { ShareModal } from "@/app/components/ShareModal";
import { YouTubeSearchModal } from "@/app/components/YouTubeSearchModal";
import { SpotifySearchModal } from "@/app/components/SpotifySearchModal";
import { EmojiButton } from "@/app/components/EmojiButton";
import { notifyWallPost } from "@/lib/notifications";

type UserProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  allow_wall_posts: boolean;
  wall_friends_only: boolean;
  is_active?: boolean;
  deactivated_at?: string | null;
  scheduled_deletion_at?: string | null;
  created_at: string;
};

type EditHistoryEntry = {
  content: string;
  edited_at: string;
};

type PostComment = {
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
  replies?: PostComment[];
};

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  image_urls?: string[] | null;
  video_url: string | null;
  video_title?: string | null;
  user_id: string;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  wall_user_id: string | null;
  wall_user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  created_at: string;
  edited_at: string | null;
  edit_history: EditHistoryEntry[];
  commentCount: number;
  voteScore: number;
  comments?: PostComment[];
  shared_from_post_id?: string | null;
  shared_from_post?: {
    id: string;
    content: string;
    image_url: string | null;
    video_url: string | null;
    user_id: string;
    users: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
    group_id?: string | null;
    groups?: {
      id: string;
      name: string;
    } | null;
  } | null;
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

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = decodeURIComponent(params.username as string);
  const router = useRouter();
  const supabase = createBrowserClient();
  const showFriendsParam = searchParams.get("showFriends");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserUsername, setCurrentUserUsername] = useState<string>("");
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
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
  const [showEditHistoryId, setShowEditHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [modalPost, setModalPost] = useState<any>(null);
  const [sharePost, setSharePost] = useState<any>(null);
  const [votes, setVotes] = useState<Record<string, { id: string; user_id: string; value: number }>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [posting, setPosting] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [bannerImageToCrop, setBannerImageToCrop] = useState<string | null>(null);
  const [allowWallPosts, setAllowWallPosts] = useState(true);
  const [wallFriendsOnly, setWallFriendsOnly] = useState(true);
  const [wallPostContent, setWallPostContent] = useState("");
  const [postingWall, setPostingWall] = useState(false);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState<{videoId: string; url: string; title: string; searchQuery?: string} | null>(null);
  const [spotifyPreview, setSpotifyPreview] = useState<{url: string; title: string; thumbnail: string; type: string; searchQuery?: string} | null>(null);
  const [wallYoutubePreview, setWallYoutubePreview] = useState<{videoId: string; url: string; title: string; searchQuery?: string} | null>(null);
  const [wallSpotifyPreview, setWallSpotifyPreview] = useState<{url: string; title: string; thumbnail: string; type: string; searchQuery?: string} | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingWallPreview, setLoadingWallPreview] = useState(false);
  const [showYouTubeSearch, setShowYouTubeSearch] = useState(false);
  const [showSpotifySearch, setShowSpotifySearch] = useState(false);
  const [showWallYouTubeSearch, setShowWallYouTubeSearch] = useState(false);
  const [showWallSpotifySearch, setShowWallSpotifySearch] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [wallSelectedImages, setWallSelectedImages] = useState<File[]>([]);
  const [wallImagePreviews, setWallImagePreviews] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isWallDraggingOver, setIsWallDraggingOver] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const wallImageInputRef = useRef<HTMLInputElement>(null);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    async function init() {
      // Get current logged in user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // PARALLEL FETCH: Get current user data and profile data at once
      const trimmedUsername = username.trim().toLowerCase();
      
      const profilePromise = (async () => {
        const { data } = await supabase.from("users").select("id, username, display_name, bio, avatar_url, banner_url, created_at, allow_wall_posts, wall_friends_only, is_active, deactivated_at, scheduled_deletion_at").ilike("username", trimmedUsername).single();
        return data;
      })();
      
      const currentUserPromise = user ? (async () => {
        const { data } = await supabase.from("users").select("username, avatar_url").eq("id", user.id).single();
        return data;
      })() : Promise.resolve(null);
      
      const [profileData, currentUserData] = await Promise.all([profilePromise, currentUserPromise]);
      
      if (currentUserData) {
        setCurrentUserUsername(currentUserData.username);
        setCurrentUserAvatarUrl(currentUserData.avatar_url);
      }

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData as UserProfile);
      setEditDisplayName(profileData.display_name || "");
      setEditBio(profileData.bio || "");
      setAllowWallPosts(profileData.allow_wall_posts ?? true);
      setWallFriendsOnly(profileData.wall_friends_only ?? true);

      // Get posts by this user with comment counts (only feed posts, not group posts)
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id, 
          user_id,
          content,
          image_url,
          image_urls,
          video_url,
          video_title,
          wall_user_id,
          created_at,
          edited_at,
          edit_history,
          shared_from_post_id,
          comments (id),
          users:users!posts_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          ),
          wall_user:users!posts_wall_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .or(`wall_user_id.eq.${profileData.id},and(user_id.eq.${profileData.id},group_id.is.null,wall_user_id.is.null)`)
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

        // Helper to count comments recursively
        const countCommentsRecursive = (comments: PostComment[]): number => {
          return comments.reduce((total, comment) => {
            return total + 1 + (comment.replies ? countCommentsRecursive(comment.replies) : 0);
          }, 0);
        };

        // Fetch original posts for shared posts
        const sharedPostIds = postsData
          .filter(p => p.shared_from_post_id)
          .map(p => p.shared_from_post_id as string);
        
        let sharedPostsMap: Record<string, { id: string; user_id: string; users: { username: string; display_name: string | null; avatar_url: string | null }; group_id?: string | null; groups?: { id: string; name: string } | null }> = {};
        
        if (sharedPostIds.length > 0) {
          const { data: sharedPostsData, error: sharedError } = await supabase
            .from("posts")
            .select(`
              id,
              user_id,
              group_id,
              users:users!posts_user_id_fkey (
                username,
                display_name,
                avatar_url
              ),
              groups:groups!posts_group_id_fkey (
                id,
                name
              )
            `)
            .in("id", sharedPostIds);
          
          if (sharedPostsData) {
            sharedPostsData.forEach(sp => {
              sharedPostsMap[sp.id] = {
                id: sp.id,
                user_id: sp.user_id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                users: Array.isArray(sp.users) ? sp.users[0] : sp.users as any,
                group_id: sp.group_id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                groups: Array.isArray(sp.groups) ? sp.groups[0] : sp.groups as any,
              };
            });
          }
        }

        // Transform posts with counts
        const postsWithCounts = postsData.map(post => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allComments = ((post as any).comments || []) as PostComment[];
          const parentComments = allComments.filter(c => !c.parent_comment_id);
          const replies = allComments.filter(c => c.parent_comment_id);
          const commentsWithReplies = parentComments.map(parent => ({
            ...parent,
            replies: replies.filter(r => r.parent_comment_id === parent.id)
          }));
          
          // Get shared post info if this is a shared post
          const sharedFrom = post.shared_from_post_id ? sharedPostsMap[post.shared_from_post_id] : null;
          
          return {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            image_url: post.image_url || null,
            video_url: post.video_url || null,
            video_title: (post as any).video_title || null,
            wall_user_id: post.wall_user_id || null,
            wall_user: Array.isArray(post.wall_user) ? post.wall_user[0] : post.wall_user || null,
            users: Array.isArray(post.users) ? post.users[0] : post.users || { username: 'unknown', display_name: null, avatar_url: null },
            created_at: post.created_at,
            edited_at: post.edited_at || null,
            edit_history: (post.edit_history as EditHistoryEntry[] | null) || [],
            commentCount: countCommentsRecursive(commentsWithReplies),
            voteScore: votesByPost[post.id] || 0,
            shared_from_post_id: post.shared_from_post_id || null,
            shared_from_post: sharedFrom ? {
              id: sharedFrom.id,
              content: '',
              image_url: null,
              video_url: null,
              user_id: sharedFrom.user_id,
              users: sharedFrom.users,
              group_id: sharedFrom.group_id,
              groups: sharedFrom.groups,
            } : null,
          };
        });

        setPosts(postsWithCounts);
        
        // Populate voteTotals state for VoteButtons component
        const postVoteTotals: Record<string, number> = {};
        postsWithCounts.forEach(p => {
          postVoteTotals[`post-${p.id}`] = p.voteScore;
        });
        setVoteTotals(prev => ({ ...prev, ...postVoteTotals }));
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

      // Determine friendship status (between viewer and profile)
      if (user) {
        const { data: friendRow } = await supabase
          .from("friendships")
          .select("id")
          .eq("status", "accepted")
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profileData.id}),and(requester_id.eq.${profileData.id},addressee_id.eq.${user.id}))`)
          .maybeSingle();
        setIsFriend(!!friendRow);
      }

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

  // Global escape key handler as a failsafe to close any stuck modal
  useEffect(() => {
    function handleGlobalEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowBannerCrop(false);
        setShowFriendsModal(false);
        setShowPictureModal(false);
      }
    }
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, []);

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

    setSaving(true);

    const { error } = await supabase
      .from("users")
      .update({
        display_name: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
      })
      .eq("id", profile.id);

    if (!error) {
      setProfile({
        ...profile,
        display_name: editDisplayName.trim() || null,
        bio: editBio.trim() || null,
      });
      setIsEditing(false);
    }

    setSaving(false);
  }

  async function handleToggleWallPosts(nextValue: boolean) {
    if (!profile || !currentUser) return;
    setAllowWallPosts(nextValue);
    await supabase.from("users").update({ allow_wall_posts: nextValue }).eq("id", profile.id);
    setProfile({ ...profile, allow_wall_posts: nextValue });
  }

  async function handleToggleWallFriendsOnly(nextValue: boolean) {
    if (!profile || !currentUser) return;
    setWallFriendsOnly(nextValue);
    await supabase.from("users").update({ wall_friends_only: nextValue }).eq("id", profile.id);
    setProfile({ ...profile, wall_friends_only: nextValue });
  }

  async function handleDeactivateAccount() {
    if (!profile || !currentUser) return;
    setShowEditMenu(false);
    
    const currentlyActive = profile.is_active ?? true;
    
    if (currentlyActive) {
      // Deactivating
      if (!confirm("Deactivate your account?\n\nYour profile will appear as 'User not found' and all your posts/comments will be hidden.\n\nYou can reactivate anytime by logging back in.")) {
        return;
      }
      
      const { error } = await supabase
        .from("users")
        .update({ 
          is_active: false,
          deactivated_at: new Date().toISOString()
        })
        .eq("id", currentUser.id);
      
      if (error) {
        alert("Failed to deactivate account. Please try again.");
        console.error("Deactivation error:", error);
      } else {
        await supabase.auth.signOut();
        router.push("/login");
      }
    } else {
      // Reactivating
      if (!confirm("Reactivate your account?")) {
        return;
      }
      
      const { error } = await supabase
        .from("users")
        .update({ 
          is_active: true,
          deactivated_at: null,
          scheduled_deletion_at: null // Also clear any deletion schedule
        })
        .eq("id", currentUser.id);
      
      if (error) {
        alert("Failed to reactivate account. Please try again.");
        console.error("Reactivation error:", error);
      } else {
        setProfile({ ...profile, is_active: true });
      }
    }
  }

  async function handleDeleteAccountPermanently() {
    if (!profile || !currentUser) return;
    setShowEditMenu(false);
    
    if (!confirm("⚠️ DELETE YOUR ACCOUNT PERMANENTLY?\n\nThis will:\n• Deactivate your account immediately\n• Schedule PERMANENT deletion in 30 days\n• Delete ALL your data after 30 days\n\nYou can cancel within 30 days by logging back in.\n\nAre you ABSOLUTELY SURE?")) {
      return;
    }
    
    if (!confirm("THIS IS YOUR FINAL WARNING!\n\nYour account will be PERMANENTLY DELETED in 30 days.\n\nContinue?")) {
      return;
    }

    const deactivationDate = new Date();
    const permanentDeletionDate = new Date(deactivationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const { error } = await supabase
      .from("users")
      .update({ 
        is_active: false,
        deactivated_at: deactivationDate.toISOString(),
        scheduled_deletion_at: permanentDeletionDate.toISOString()
      })
      .eq("id", currentUser.id);
    
    if (error) {
      alert("Failed to schedule account deletion. Please try again.");
      console.error("Delete scheduling error:", error);
    } else {
      alert(`Account deletion scheduled for ${permanentDeletionDate.toLocaleDateString()}.\n\nYou can cancel by logging in within 30 days.`);
      await supabase.auth.signOut();
      router.push("/login");
    }
  }

  async function handleWallPost() {
    if ((!wallPostContent.trim() && !wallYoutubePreview && !wallSpotifyPreview) || !currentUser || !profile) return;

    // Permission guard
    if (!profile.allow_wall_posts && !isOwnProfile) {
      alert("This user has wall posts disabled.");
      return;
    }
    if (profile.wall_friends_only && !isFriend && !isOwnProfile) {
      alert("Only friends can post on this wall.");
      return;
    }

    setPostingWall(true);

    // Use preview URL if available, otherwise detect from content
    const videoUrl = wallYoutubePreview?.url || wallSpotifyPreview?.url || findYouTubeUrl(wallPostContent);
    
    // Use the video/album title (usually contains Artist - Album)
    const videoTitle = wallYoutubePreview?.title || wallSpotifyPreview?.title || null;

    const { data: newPost, error } = await supabase
      .from("posts")
      .insert({
        user_id: currentUser.id,
        wall_user_id: profile.id,
        content: wallPostContent.trim(),
        video_url: videoUrl,
        video_title: videoTitle,
      })
      .select("id, content, image_url, video_url, wall_user_id, created_at")
      .single();

    if (!error && newPost) {
      // Auto-upvote own post (like Reddit)
      await supabase.from("votes").insert({
        user_id: currentUser.id,
        target_type: "post",
        target_id: newPost.id,
        value: 1,
      });
      
      if (profile.id !== currentUser.id) {
        notifyWallPost(supabase, profile.id, currentUserUsername, newPost.id, wallPostContent.trim());
      }
      // Refresh from DB to avoid stale/local shape issues
      const refreshed = await supabase
        .from("posts")
        .select(`
          id,
          user_id,
          content,
          image_url,
          image_urls,
          video_url,
          wall_user_id,
          created_at,
          edited_at,
          edit_history,
          users:users!posts_user_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          wall_user:users!posts_wall_user_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .or(`wall_user_id.eq.${profile.id},and(user_id.eq.${profile.id},group_id.is.null,wall_user_id.is.null)`)
        .is("group_id", null)
        .order("created_at", { ascending: false });

      if (refreshed.data) {
        const votesByPost: Record<string, number> = {};
        const ids = refreshed.data.map(p => p.id);
        const { data: votesData } = await supabase
          .from("votes")
          .select("target_id, value")
          .eq("target_type", "post")
          .in("target_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        votesData?.forEach(v => {
          votesByPost[v.target_id] = (votesByPost[v.target_id] || 0) + v.value;
        });
        setPosts(refreshed.data.map(p => ({
          id: p.id,
          user_id: p.user_id,
          content: p.content,
          image_url: p.image_url,
          image_urls: (p as any).image_urls || null,
          video_url: p.video_url,
          wall_user_id: p.wall_user_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          wall_user: Array.isArray((p as any).wall_user) ? (p as any).wall_user[0] : (p as any).wall_user || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          users: Array.isArray((p as any).users) ? (p as any).users[0] : (p as any).users || { username: 'unknown', display_name: null, avatar_url: null },
          created_at: p.created_at,
          edited_at: p.edited_at || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          edit_history: (p as any).edit_history || [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // Count all comments recursively
          commentCount: (() => {
            const countCommentsRecursive = (comments: PostComment[]): number => {
              return comments.reduce((total, comment) => {
                return total + 1 + (comment.replies ? countCommentsRecursive(comment.replies) : 0);
              }, 0);
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const allComments = ((p as any).comments || []) as PostComment[];
            const parentComments = allComments.filter((c: PostComment) => !c.parent_comment_id);
            const replies = allComments.filter((c: PostComment) => c.parent_comment_id);
            const commentsWithReplies = parentComments.map((parent: PostComment) => ({
              ...parent,
              replies: replies.filter((r: PostComment) => r.parent_comment_id === parent.id)
            }));
            return countCommentsRecursive(commentsWithReplies);
          })(),
          voteScore: votesByPost[p.id] || 0,
        })));
        
        // Update voteTotals state
        const newVoteTotals: Record<string, number> = {};
        refreshed.data.forEach(p => {
          newVoteTotals[`post-${p.id}`] = votesByPost[p.id] || 0;
        });
        setVoteTotals(prev => ({ ...prev, ...newVoteTotals }));
      }
      setWallPostContent("");
      setWallYoutubePreview(null);
      setWallSpotifyPreview(null);
    } else if (error) {
      console.error("Wall post insert failed:", error);
      alert(`Couldn't post to the wall: ${error.message}`);
    }

    setPostingWall(false);
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

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>, isWall: boolean = false) {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        alert("Please select image files only");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Max 10MB per image.`);
        continue;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    }

    if (isWall) {
      const newImages = [...wallSelectedImages, ...validFiles].slice(0, 10);
      const newPreviews = [...wallImagePreviews, ...previews].slice(0, 10);
      setWallSelectedImages(newImages);
      setWallImagePreviews(newPreviews);
    } else {
      const newImages = [...selectedImages, ...validFiles].slice(0, 10);
      const newPreviews = [...imagePreviews, ...previews].slice(0, 10);
      setSelectedImages(newImages);
      setImagePreviews(newPreviews);
    }

    e.target.value = "";
  }

  function removeImage(index: number, isWall: boolean = false) {
    if (isWall) {
      URL.revokeObjectURL(wallImagePreviews[index]);
      setWallSelectedImages(wallSelectedImages.filter((_, i) => i !== index));
      setWallImagePreviews(wallImagePreviews.filter((_, i) => i !== index));
    } else {
      URL.revokeObjectURL(imagePreviews[index]);
      setSelectedImages(selectedImages.filter((_, i) => i !== index));
      setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    }
  }

  function handleDrop(e: React.DragEvent, isWall: boolean = false) {
    e.preventDefault();
    if (isWall) {
      setIsWallDraggingOver(false);
    } else {
      setIsDraggingOver(false);
    }
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Max 10MB per image.`);
        continue;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    }

    if (isWall) {
      const newImages = [...wallSelectedImages, ...validFiles].slice(0, 10);
      const newPreviews = [...wallImagePreviews, ...previews].slice(0, 10);
      setWallSelectedImages(newImages);
      setWallImagePreviews(newPreviews);
    } else {
      const newImages = [...selectedImages, ...validFiles].slice(0, 10);
      const newPreviews = [...imagePreviews, ...previews].slice(0, 10);
      setSelectedImages(newImages);
      setImagePreviews(newPreviews);
    }
  }

  async function handlePost() {
    if ((!newPostContent.trim() && !youtubePreview && !spotifyPreview && selectedImages.length === 0) || !currentUser || !profile) return;

    setPosting(true);

    // Upload ALL images
    const uploadedUrls: string[] = [];
    for (const file of selectedImages) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      
      if (uploadError) {
        alert("Failed to upload image. Please try again.");
        setPosting(false);
        return;
      }
      
      const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(filePath);
      uploadedUrls.push(publicUrl);
    }

    // Use preview URL if available, otherwise detect from content
    const videoUrl = youtubePreview?.url || spotifyPreview?.url || findYouTubeUrl(newPostContent);
    
    // Use the video/album title (usually contains Artist - Album)
    const videoTitle = youtubePreview?.title || spotifyPreview?.title || null;

    const { data: newPost, error } = await supabase
      .from("posts")
      .insert({
        user_id: currentUser.id,
        content: newPostContent.trim(),
        image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        video_url: videoUrl,
        video_title: videoTitle,
      })
      .select()
      .single();

    if (!error && newPost) {
      // Auto-upvote own post (like Reddit)
      await supabase.from("votes").insert({
        user_id: currentUser.id,
        target_type: "post",
        target_id: newPost.id,
        value: 1,
      });
      
      // Add the new post to the top of the list
      setPosts([
        {
          id: newPost.id,
          user_id: currentUser.id,
          content: newPost.content,
          image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : null,
          image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
          video_url: videoUrl,
          wall_user_id: null,
          wall_user: null,
          created_at: newPost.created_at,
          edited_at: null,
          edit_history: [],
          commentCount: 0,
          voteScore: 1,
          users: {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          },
        },
        ...posts,
      ]);
      
      // Update voteTotals state for the new post
      setVoteTotals(prev => ({ ...prev, [`post-${newPost.id}`]: 1 }));
      
      setNewPostContent("");
      setYoutubePreview(null);
      setSpotifyPreview(null);
      // Clear images
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setSelectedImages([]);
      setImagePreviews([]);
      setActiveTab("posts"); // Switch to posts tab to show new post
    }

    setPosting(false);
  }

  async function loadUserVotes(userId: string) {
    const { data } = await supabase
      .from("votes")
      .select("*")
      .eq("user_id", userId);

    if (data) {
      const voteMap: Record<string, { id: string; user_id: string; value: number }> = {};
      data.forEach((vote) => {
        const key = `${vote.target_type}-${vote.target_id}`;
        voteMap[key] = vote;
      });
      setVotes(voteMap);
    }
  }

  async function loadVoteTotals(targetPosts: Post[]) {
    const postIds = targetPosts.map(p => p.id);
    const commentIds: string[] = [];
    targetPosts.forEach(p => {
      (p.comments || []).forEach(c => {
        commentIds.push(c.id);
        (c.replies || []).forEach(r => commentIds.push(r.id));
      });
    });

    const safePostIds = postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"];
    const safeCommentIds = commentIds.length ? commentIds : ["00000000-0000-0000-0000-000000000000"];

    const { data: postVotes } = await supabase
      .from("votes")
      .select("target_id, value")
      .eq("target_type", "post")
      .in("target_id", safePostIds);

    const { data: commentVotes } = await supabase
      .from("votes")
      .select("target_id, value")
      .eq("target_type", "comment")
      .in("target_id", safeCommentIds);

    const totals: Record<string, number> = {};
    postVotes?.forEach(v => {
      const key = `post-${v.target_id}`;
      totals[key] = (totals[key] || 0) + v.value;
    });
    commentVotes?.forEach(v => {
      const key = `comment-${v.target_id}`;
      totals[key] = (totals[key] || 0) + v.value;
    });

    setVoteTotals(totals);
  }

  async function handleVote(targetType: "post" | "comment", targetId: string, value: number) {
    if (!currentUser) return;

    const key = `${targetType}-${targetId}`;
    const currentVote = votes[key];
    const currentTotal = voteTotals[key] || 0;
    let newTotal = currentTotal;

    if (currentVote) {
      if (currentVote.value === value) {
        // Remove vote
        await supabase.from("votes").delete().eq("id", currentVote.id);
        const { [key]: removed, ...rest } = votes;
        setVotes(rest);
        newTotal = currentTotal - value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      } else {
        // Change vote
        await supabase.from("votes").update({ value }).eq("id", currentVote.id);
        setVotes({ ...votes, [key]: { ...currentVote, value } });
        newTotal = currentTotal - currentVote.value + value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      }
    } else {
      // New vote
      const { data } = await supabase
        .from("votes")
        .insert({ user_id: currentUser.id, target_type: targetType, target_id: targetId, value })
        .select()
        .single();

      if (data) {
        setVotes({ ...votes, [key]: data });
        newTotal = currentTotal + value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      }
    }
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
      <Header
        user={currentUser}
        userUsername={currentUserUsername}
        currentPage="profile"
        userAvatarUrl={currentUserAvatarUrl}
      />

      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>
      {/* Profile Card with Banner - unified like groups */}
      <div 
        style={{ 
          marginBottom: 32, 
          borderRadius: 12, 
          overflow: "visible",
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
        {/* Background with rounded corners for clipping */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: 12,
          overflow: "hidden",
          background: "inherit",
          zIndex: -1,
        }} />

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

        {/* Edit menu button */}
        {isOwnProfile && (
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
                      minWidth: 220,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      zIndex: 100,
                    }}
                  >
                  <button
                    onClick={() => {
                      setShowEditMenu(false);
                      setIsEditing(true);
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
                    ✏️ Edit Profile
                  </button>
                  
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
                  
                  {profile.banner_url && (
                    <button
                      onClick={() => {
                        setShowEditMenu(false);
                        setBannerImageToCrop(profile.banner_url);
                        setShowBannerCrop(true);
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
                      handleToggleWallPosts(!allowWallPosts);
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
                    {allowWallPosts ? "🚫 Disable Wall Posts" : "📝 Allow Wall Posts"}
                  </button>
                  
                  {allowWallPosts && (
                    <button
                      onClick={() => {
                        setShowEditMenu(false);
                        handleToggleWallFriendsOnly(!wallFriendsOnly);
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
                      {wallFriendsOnly ? "🌐 Allow All to Post" : "👥 Friends Only"}
                    </button>
                  )}
                  
                  <button
                    onClick={handleDeactivateAccount}
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
                    💤 {profile.is_active ?? true ? "Deactivate Account" : "Reactivate Account"}
                  </button>
                  
                  {/* Separator line */}
                  <div style={{
                    height: 1,
                    background: "rgba(240, 235, 224, 0.2)",
                    margin: "4px 0",
                  }} />
                  
                  <button
                    onClick={handleDeleteAccountPermanently}
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
                    🗑️ Delete Account Permanently
                  </button>
                </div>
                </>
              )}
            </div>
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
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditDisplayName(profile.display_name || "");
                      setEditBio(profile.bio || "");
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
                <h1 style={{ fontSize: 24, margin: 0, marginBottom: 6, fontWeight: 400 }}>
                  {profile.display_name || profile.username}
                </h1>
                
                {/* Friend Button (only show on other people's profiles) */}
                {currentUser && !isOwnProfile && (
                  <div style={{ marginBottom: 12 }}>
                    <FriendButton
                      currentUserId={currentUser.id}
                      currentUsername={currentUserUsername}
                      targetUserId={profile.id}
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
          {/* Input container with avatar inside */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 16px",
              background: "var(--alzooka-teal-dark)",
              borderRadius: 12,
              border: isDraggingOver ? "2px solid var(--alzooka-gold)" : "1px solid rgba(240, 235, 224, 0.15)",
              marginBottom: 12,
              position: "relative",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setIsDraggingOver(true)}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setIsDraggingOver(false);
            }}
            onDrop={(e) => handleDrop(e, false)}
          >
            {/* Left column - Avatar, Emoji, Quote */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {currentUserAvatarUrl ? (
                <img
                  src={currentUserAvatarUrl}
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
                  {currentUserUsername?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              
              {/* Emoji Button */}
              <EmojiButton
                direction="down"
                buttonSize={28}
                onEmojiSelect={(emoji) => {
                  const textarea = postTextareaRef.current;
                  if (textarea) {
                    const start = textarea.selectionStart || 0;
                    const end = textarea.selectionEnd || 0;
                    const newContent = newPostContent.slice(0, start) + emoji + newPostContent.slice(end);
                    setNewPostContent(newContent);
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                    }, 0);
                  } else {
                    setNewPostContent(newPostContent + emoji);
                  }
                }}
              />
              
              {/* Quote Button */}
              <button
                type="button"
                title="Insert quote"
                onClick={() => {
                  const textarea = postTextareaRef.current;
                  if (!textarea) return;
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  if (start !== end) {
                    const selectedText = newPostContent.substring(start, end);
                    const newText = newPostContent.substring(0, start) + `"${selectedText}"` + newPostContent.substring(end);
                    setNewPostContent(newText);
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(end + 2, end + 2);
                    }, 0);
                  } else {
                    const newText = newPostContent.substring(0, start) + '""' + newPostContent.substring(start);
                    setNewPostContent(newText);
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(start + 1, start + 1);
                    }, 0);
                  }
                }}
                style={{
                  background: "var(--alzooka-gold)",
                  border: "none",
                  color: "var(--alzooka-teal-dark)",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.75,
                }}
              >
                "
              </button>
            </div>
            
            {/* Textarea */}
            <textarea
              ref={postTextareaRef}
              value={newPostContent}
              onChange={async (e) => {
                const newContent = e.target.value;
                setNewPostContent(newContent);
                
                // Detect YouTube URL
                if (!youtubePreview && !loadingPreview) {
                  const youtubeUrl = findYouTubeUrl(newContent);
                  if (youtubeUrl) {
                    const videoId = extractYouTubeVideoId(youtubeUrl);
                    if (videoId) {
                      setLoadingPreview(true);
                      try {
                        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(youtubeUrl)}`);
                        const data = await response.json();
                        const title = data.title || "YouTube Video";
                        setYoutubePreview({ videoId, url: youtubeUrl, title });
                      } catch {
                        setYoutubePreview({ videoId, url: youtubeUrl, title: "YouTube Video" });
                      }
                      setLoadingPreview(false);
                    }
                  }
                }
              }}
              placeholder="What's on your mind? Paste a YouTube or Spotify link to share"
              rows={3}
              maxLength={500}
              style={{ 
                flex: 1,
                resize: "vertical",
                border: "none",
                background: "transparent",
                color: "var(--alzooka-cream)",
                fontSize: 14,
                lineHeight: 1.5,
                outline: "none",
                minHeight: 60,
              }}
            />
            
            {isDraggingOver && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(201, 162, 92, 0.15)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <span style={{ 
                  background: "var(--alzooka-gold)", 
                  color: "var(--alzooka-teal-dark)",
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontWeight: 600,
                  fontSize: 14,
                }}>
                  📷 Drop images here
                </span>
              </div>
            )}
          </div>

          {/* Image Previews */}
          {imagePreviews.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {imagePreviews.map((preview, index) => (
                <div key={index} style={{ position: "relative" }}>
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index, false)}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#e57373",
                      border: "none",
                      color: "white",
                      cursor: "pointer",
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {imagePreviews.length < 10 && (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 8,
                    border: "2px dashed rgba(240, 235, 224, 0.3)",
                    background: "transparent",
                    color: "var(--alzooka-cream)",
                    cursor: "pointer",
                    fontSize: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  +
                </button>
              )}
            </div>
          )}
          
          {/* YouTube Preview */}
          {loadingPreview && (
            <div style={{ marginBottom: 12, padding: 12, background: "rgba(240, 235, 224, 0.05)", borderRadius: 8 }}>
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
                <div style={{ padding: "10px 12px" }}>
                  <p style={{ margin: 0, fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>
                    YouTube.com
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                    {youtubePreview.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setYoutubePreview(null)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0, 0, 0, 0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "white",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
          )}
          
          {spotifyPreview && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <div style={{
                background: "var(--alzooka-teal-dark)",
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid rgba(240, 235, 224, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
              }}>
                <img
                  src={spotifyPreview.thumbnail}
                  alt=""
                  style={{ width: 80, height: 80, borderRadius: 4, objectFit: "cover" }}
                />
                <div>
                  <p style={{ margin: 0, fontSize: 11, opacity: 0.6, color: "#1DB954" }}>
                    SPOTIFY
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                    {spotifyPreview.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSpotifyPreview(null)}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0, 0, 0, 0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "white",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
          )}
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.5 }}>
              {newPostContent.length}/500
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setShowYouTubeSearch(true)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  color: "var(--alzooka-cream)",
                  padding: "8px 16px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#ff0000" }}>▶</span> YouTube
              </button>
              <button
                type="button"
                onClick={() => setShowSpotifySearch(true)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(240, 235, 224, 0.3)",
                  color: "var(--alzooka-cream)",
                  padding: "8px 16px",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#1DB954" }}>●</span> Spotify
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
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
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageSelect(e, false)}
                style={{ display: "none" }}
              />
              <button
                onClick={handlePost}
                disabled={posting || (!newPostContent.trim() && !youtubePreview && !spotifyPreview && selectedImages.length === 0)}
                style={{
                  opacity: (!newPostContent.trim() && !youtubePreview && !spotifyPreview && selectedImages.length === 0) ? 0.5 : 1,
                }}
              >
                {posting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wall Post Form (on someone else's profile, if allowed) */}
      {!isOwnProfile && profile && (
        (() => {
          const canPost =
            profile.allow_wall_posts &&
            (!profile.wall_friends_only || isFriend || currentUser?.id === profile.id);
          if (!canPost) return null;
          return (
            <div className="card" style={{ marginBottom: 24 }}>
              <textarea
                value={wallPostContent}
                onChange={async (e) => {
                  const newContent = e.target.value;
                  setWallPostContent(newContent);
                  
                  // Detect YouTube URL
                  if (!wallYoutubePreview && !loadingWallPreview) {
                    const youtubeUrl = findYouTubeUrl(newContent);
                    if (youtubeUrl) {
                      const videoId = extractYouTubeVideoId(youtubeUrl);
                      if (videoId) {
                        setLoadingWallPreview(true);
                        try {
                          const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(youtubeUrl)}`);
                          const data = await response.json();
                          const title = data.title || "YouTube Video";
                          setWallYoutubePreview({ videoId, url: youtubeUrl, title });
                        } catch {
                          setWallYoutubePreview({ videoId, url: youtubeUrl, title: "YouTube Video" });
                        }
                        setLoadingWallPreview(false);
                      }
                    }
                  }
                }}
                placeholder={`Post on ${profile.display_name || profile.username}'s wall... Paste a YouTube link to share`}
                rows={3}
                maxLength={500}
                style={{ marginBottom: 12, resize: "vertical" }}
              />
              
              {/* YouTube Preview */}
              {loadingWallPreview && (
                <div style={{ marginBottom: 12, padding: 12, background: "rgba(240, 235, 224, 0.05)", borderRadius: 8 }}>
                  <p style={{ margin: 0, opacity: 0.6 }}>Loading video preview...</p>
                </div>
              )}
              {wallYoutubePreview && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <div style={{
                    background: "var(--alzooka-teal-dark)",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(240, 235, 224, 0.2)"
                  }}>
                    <img
                      src={`https://img.youtube.com/vi/${wallYoutubePreview.videoId}/hqdefault.jpg`}
                      alt="YouTube thumbnail"
                      style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                    />
                    <div style={{ padding: "10px 12px" }}>
                      <p style={{ margin: 0, fontSize: 11, opacity: 0.6, textTransform: "uppercase" }}>
                        YouTube.com
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                        {wallYoutubePreview.title}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setWallYoutubePreview(null)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "rgba(0, 0, 0, 0.7)",
                      border: "none",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "white",
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {wallSpotifyPreview && (
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <div style={{
                    background: "var(--alzooka-teal-dark)",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(240, 235, 224, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                  }}>
                    <img
                      src={wallSpotifyPreview.thumbnail}
                      alt=""
                      style={{ width: 80, height: 80, borderRadius: 4, objectFit: "cover" }}
                    />
                    <div>
                      <p style={{ margin: 0, fontSize: 11, opacity: 0.6, color: "#1DB954" }}>
                        SPOTIFY
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                        {wallSpotifyPreview.title}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setWallSpotifyPreview(null)}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "rgba(0, 0, 0, 0.7)",
                      border: "none",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "white",
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.5 }}>
                  {wallPostContent.length}/500
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowWallYouTubeSearch(true)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                      padding: "8px 16px",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ color: "#ff0000" }}>▶</span> YouTube
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWallSpotifySearch(true)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(240, 235, 224, 0.3)",
                      color: "var(--alzooka-cream)",
                      padding: "8px 16px",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ color: "#1DB954" }}>●</span> Spotify
                  </button>
                  <button
                    onClick={handleWallPost}
                    disabled={postingWall || (!wallPostContent.trim() && !wallYoutubePreview && !wallSpotifyPreview)}
                    style={{
                      opacity: (!wallPostContent.trim() && !wallYoutubePreview && !wallSpotifyPreview) ? 0.5 : 1,
                    }}
                  >
                    {postingWall ? "Posting..." : "Post to wall"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()
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
                ? "You haven&apos;t posted anything yet." 
                : `@${profile.username} hasn&apos;t posted anything yet.`}
            </p>
          ) : (
            posts.map((post) => {
              // For shared posts, use the original post's content
              // Content is always on the post itself (shared posts copy the content)
              // shared_from_post is only used for attribution
              let displayContent = post.content;
              const videoUrl = post.video_url;
              const imageUrl = post.image_url;
              const imageUrls = post.image_urls || (imageUrl ? [imageUrl] : []);
              
              // Strip YouTube/Spotify URLs if video exists
              if (videoUrl && displayContent) {
                displayContent = displayContent
                  .replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+/gi, '')
                  .replace(/https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+/gi, '')
                  .trim();
              }
              
              // Strip ALL URLs when no image/video (link preview will show instead)
              if (!imageUrl && !videoUrl && displayContent) {
                displayContent = displayContent
                  .replace(/https?:\/\/[^\s]+/gi, '')
                  .trim();
              }

              const videoId = videoUrl ? (() => {
                const patterns = [
                  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
                  /youtube\.com\/shorts\/([^&\s?]+)/,
                ];
                for (const pattern of patterns) {
                  const match = videoUrl.match(pattern);
                  if (match) return match[1];
                }
                return null;
              })() : null;

              const playlistId = videoUrl ? (() => {
                const match = videoUrl.match(/[?&]list=([^&\s]+)/);
                return match ? match[1] : null;
              })() : null;

              return (
                <article key={post.id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {/* Vote Buttons */}
                    <VoteButtons
                      targetType="post"
                      targetId={post.id}
                      votes={votes}
                      voteTotals={voteTotals}
                      onVote={handleVote}
                    />

                    <div style={{ flex: 1 }}>
                      {/* Header: avatar, name, time, edit/delete */}
                      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Link href={`/profile/${encodeURIComponent(post.users?.username || "unknown")}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                          {post.users?.avatar_url ? (
                            <img src={post.users.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--alzooka-gold)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--alzooka-teal-dark)", fontWeight: 700 }}>{(post.users?.display_name || post.users?.username || "?").charAt(0).toUpperCase()}</div>
                          )}
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--alzooka-cream)" }}>{post.users?.display_name || post.users?.username || "Unknown"}</span>
                            <span className="text-muted" style={{ marginLeft: 8, fontSize: 14 }}>{formatTime(post.created_at)}</span>
                          </div>
                        </Link>

                        {currentUser && post && post.id && (
                          <div style={{ display: "flex", gap: 8 }}>
                            {/* Share button - visible to everyone */}
                            <button
                              onClick={() => setSharePost(post)}
                              style={{ background: "transparent", border: "none", color: "var(--alzooka-cream)", fontSize: 12, cursor: "pointer", opacity: 0.8 }}
                              title="Share post"
                            >
                              Share
                            </button>
                            {currentUser.id === post.user_id && (
                              <button
                                onClick={() => {
                                  setEditingPostId(post.id);
                                  setEditingContent(post.content || "");
                                }}
                                style={{ background: "transparent", border: "none", color: "var(--alzooka-cream)", fontSize: 12, cursor: "pointer", opacity: 0.8 }}
                                title="Edit post"
                              >
                                Edit
                              </button>
                            )}
                            {(currentUser.id === post.user_id || post.wall_user_id === currentUser.id) && (
                              <button
                                onClick={async () => {
                                  if (!confirm("Delete this post?")) return;
                                  await supabase.from("posts").delete().eq("id", post.id);
                                  setPosts(prev => prev.filter(p => p.id !== post.id));
                                }}
                                style={{ background: "transparent", border: "none", color: "#e57373", fontSize: 12, cursor: "pointer", opacity: 0.9 }}
                                title="Delete post"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Wall post attribution */}
                      {post.wall_user_id && post.wall_user && post.wall_user.username !== profile.username && (
                        <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.75 }}>
                          Posted on{" "}
                          <Link href={`/profile/${encodeURIComponent(post.wall_user.username)}`} style={{ color: "var(--alzooka-gold)" }}>
                            {post.wall_user.display_name || post.wall_user.username}
                          </Link>
                          &apos;s wall
                        </div>
                      )}

                      {/* Shared from attribution */}
                      {post.shared_from_post && (
                        <div style={{ 
                          marginBottom: 12, 
                          padding: "8px 12px",
                          background: "rgba(212, 168, 75, 0.1)",
                          borderRadius: 8,
                          borderLeft: "3px solid var(--alzooka-gold)",
                          fontSize: 13,
                        }}>
                          <span style={{ opacity: 0.7 }}>Shared from </span>
                          <Link 
                            href={`/profile/${post.shared_from_post.users?.username}`} 
                            style={{ color: "var(--alzooka-gold)", fontWeight: 600 }}
                          >
                            {post.shared_from_post.users?.display_name || post.shared_from_post.users?.username}
                          </Link>
                          <span style={{ opacity: 0.7 }}>&apos;s post</span>
                          {post.shared_from_post.groups && (
                            <>
                              <span style={{ opacity: 0.7 }}> in </span>
                              <Link 
                                href={`/groups/${post.shared_from_post.groups.id}`} 
                                style={{ color: "var(--alzooka-gold)", fontWeight: 600 }}
                              >
                                {post.shared_from_post.groups.name}
                              </Link>
                            </>
                          )}
                        </div>
                      )}

                      {/* Edit mode */}
                      {editingPostId === post.id ? (
                        <div style={{ marginBottom: 12 }}>
                          <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={3} style={{ marginBottom: 8, width: "100%", resize: "vertical" }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                      onClick={async () => {
                        if (!editingContent.trim()) return;
                        const updatedAt = new Date().toISOString();

                        // Preserve edit history like the feed page
                        const newHistoryEntry: EditHistoryEntry = {
                          content: post.content,
                          edited_at: updatedAt,
                        };
                        const updatedHistory = [
                          ...(post.edit_history || []),
                          newHistoryEntry,
                        ];

                        await supabase
                          .from("posts")
                          .update({ 
                            content: editingContent.trim(), 
                            edited_at: updatedAt,
                            edit_history: updatedHistory,
                          })
                          .eq("id", post.id);

                        setPosts(prev => prev.map(p => 
                          p.id === post.id 
                            ? { 
                                ...p, 
                                content: editingContent.trim(), 
                                edited_at: updatedAt,
                                edit_history: updatedHistory,
                              } 
                            : p
                        ));
                        setEditingPostId(null);
                        setEditingContent("");
                      }}
                            >Save</button>
                            <button onClick={() => { setEditingPostId(null); setEditingContent(""); }} style={{ background: "transparent", border: "1px solid rgba(240, 235, 224, 0.3)", color: "var(--alzooka-cream)" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {displayContent && <p style={{ margin: "0 0 12px 0", lineHeight: 1.6 }}>{renderTextWithQuotes(displayContent)}</p>}

                          {/* Post Images Gallery */}
                          {imageUrls.length > 0 && (
                            imageUrls.length === 1 ? (
                              <img src={imageUrls[0]} alt="" style={{ maxWidth: "100%", maxHeight: 500, borderRadius: 8, marginBottom: 12, cursor: "pointer" }} onClick={() => setModalPost(post)} />
                            ) : (
                              <div style={{ 
                                display: "grid", 
                                gridTemplateColumns: imageUrls.length === 2 ? "1fr 1fr" : "repeat(3, 1fr)",
                                gap: 4,
                                marginBottom: 12,
                                borderRadius: 8,
                                overflow: "hidden",
                              }}>
                                {imageUrls.slice(0, 6).map((url, idx) => (
                                  <div key={idx} style={{ position: "relative", paddingTop: "100%" }}>
                                    <img 
                                      src={url} 
                                      alt={`Image ${idx + 1}`}
                                      style={{ 
                                        position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                                        objectFit: "cover", cursor: "pointer",
                                      }}
                                      onClick={() => setModalPost(post)}
                                    />
                                    {idx === 5 && imageUrls.length > 6 && (
                                      <div 
                                        style={{
                                          position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                          color: "white", fontSize: 24, fontWeight: 600, cursor: "pointer",
                                        }}
                                        onClick={() => setModalPost(post)}
                                      >
                                        +{imageUrls.length - 6}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )
                          )}

                      {/* Edited indicator and history */}
                      {post.edited_at && (
                        <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.7 }}>
                          <span>Edited {formatTime(post.edited_at)}</span>
                          {post.edit_history && post.edit_history.length > 0 && (
                            <button
                              onClick={() => setShowEditHistoryId(showEditHistoryId === post.id ? null : post.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--alzooka-gold)",
                                fontSize: 12,
                                cursor: "pointer",
                                marginLeft: 8,
                                textDecoration: "underline",
                                padding: 0,
                              }}
                            >
                              {showEditHistoryId === post.id ? "Hide edits" : "See edits"}
                            </button>
                          )}
                        </div>
                      )}

                      {(() => {
                        const history = post.edit_history ?? [];
                        if (showEditHistoryId !== post.id || history.length === 0) return null;
                        return (
                          <div
                            style={{
                              marginBottom: 12,
                              padding: 10,
                              background: "rgba(0, 0, 0, 0.15)",
                              borderRadius: 8,
                              fontSize: 13,
                            }}
                          >
                            <p style={{ margin: "0 0 6px 0", fontWeight: 600, fontSize: 12, opacity: 0.75 }}>
                              Edit History
                            </p>
                            {history.map((entry, index) => (
                              <div
                                key={index}
                                style={{
                                  marginBottom: index < history.length - 1 ? 8 : 0,
                                  paddingBottom: index < history.length - 1 ? 8 : 0,
                                  borderBottom: index < history.length - 1 ? "1px solid rgba(240, 235, 224, 0.08)" : "none",
                                }}
                              >
                                <span style={{ fontSize: 11, opacity: 0.6 }}>{formatTime(entry.edited_at)}</span>
                                <p style={{ margin: "4px 0 0 0", opacity: 0.8, fontStyle: "italic" }}>
                                  {entry.content || "(no text)"}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                          {videoId && (
                            <div style={{ marginBottom: 12 }}>
                              {/* Always show header for YouTube videos */}
                              {playlistId ? (
                                /* For playlists, use the PlaylistTitle component which fetches album name */
                                <PlaylistTitle videoUrl={videoUrl!} playlistId={playlistId} />
                              ) : post.video_title ? (
                                /* For single videos, show the saved video_title */
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "10px 12px",
                                  background: "rgba(240, 235, 224, 0.05)",
                                  borderRadius: "8px 8px 0 0",
                                  borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                                }}>
                                  <span style={{ fontSize: 18 }}>🎵</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "var(--alzooka-gold)" }}>
                                      {post.video_title}
                                    </p>
                                  </div>
                                </div>
                              ) : null}
                              <div style={{
                                position: "relative",
                                paddingBottom: "56.25%",
                                height: 0,
                                overflow: "hidden",
                                borderRadius: (playlistId || post.video_title) ? "0 0 8px 8px" : "8px",
                                background: "#000",
                              }}>
                                <iframe
                                  src={playlistId
                                    ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0`
                                    : `https://www.youtube.com/embed/${videoId}?rel=0`}
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
                          )}
                          
                          {/* Spotify embed */}
                          {!videoId && videoUrl && videoUrl.includes('spotify.com') && (() => {
                            const match = videoUrl.match(/spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
                            if (match) {
                              const [, type, id] = match;
                              return (
                                <div style={{ marginBottom: 12 }}>
                                  {post.video_title && (
                                    <div style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "10px 12px",
                                      background: "rgba(240, 235, 224, 0.05)",
                                      borderRadius: "8px 8px 0 0",
                                      borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
                                    }}>
                                      <span style={{ fontSize: 18, color: "#1DB954" }}>●</span>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "var(--alzooka-gold)" }}>
                                          {post.video_title}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  <iframe
                                    style={{ 
                                      borderRadius: post.video_title ? "0 0 12px 12px" : 12, 
                                      width: "100%", 
                                      height: type === "track" || type === "episode" ? 152 : 380 
                                    }}
                                    src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator`}
                                    frameBorder="0"
                                    allowFullScreen
                                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                    loading="lazy"
                                  />
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <span className="text-muted" style={{ fontSize: 14 }}>{formatTime(post.created_at)}</span>
                            <button
                              onClick={async () => {
                                // Fetch full post data with comments
                                const { data: fullPost } = await supabase
                                  .from("posts")
                                  .select(`
                                    id,
                                    content,
                                    image_url,
          image_urls,
                                    video_url,
                                    created_at,
                                    edited_at,
                                    edit_history,
                                    user_id,
                                    wall_user_id,
                                    users!posts_user_id_fkey (
                                      username,
                                      display_name,
                                      avatar_url
                                    ),
                                    wall_user:users!posts_wall_user_id_fkey (
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
                                  .eq("id", post.id)
                                  .single();

                                if (fullPost) {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const allComments = ((fullPost as any).comments || []) as PostComment[];
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

                                  setModalPost({
                                    ...(fullPost as any),
                                    comments: commentsWithReplies,
                                    edit_history: (fullPost as any).edit_history || []
                                  });

                                  // Load votes
                                  if (currentUser) {
                                    await loadUserVotes(currentUser.id);
                                    await loadVoteTotals([{ ...(fullPost as any), comments: commentsWithReplies }]);
                                  }
                                }
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                opacity: 0.6,
                                background: "transparent",
                                border: "none",
                                color: "var(--alzooka-cream)",
                                cursor: "pointer",
                                padding: "4px 8px",
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
                            >
                              <span style={{ fontSize: 14 }}>💬</span>
                              <span style={{ fontSize: 14 }}>
                                {(post.commentCount ?? 0) === 0
                                  ? "Comment"
                                  : `${post.commentCount ?? 0} comment${(post.commentCount ?? 0) !== 1 ? "s" : ""}`}
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )
        ) : (
          /* Comments Tab */
          comments.length === 0 ? (
            <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
              {isOwnProfile 
                ? "You haven&apos;t commented on anything yet." 
                : `@${profile.username} hasn&apos;t commented on anything yet.`}
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
                      &quot;{comment.posts?.content?.slice(0, 80)}{comment.posts?.content?.length > 80 ? "..." : ""}&quot;
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

      {/* Post Modal for Comments */}
      {modalPost && currentUser && (
        <PostModal
          post={modalPost}
          user={currentUser}
          supabase={supabase}
          votes={votes}
          voteTotals={voteTotals}
          onVote={handleVote}
          onClose={() => setModalPost(null)}
          onCommentAdded={async () => {
            // Fetch fresh post data for the modal
            const { data: freshPost } = await supabase
              .from("posts")
              .select(`
                id,
                content,
                image_url,
          image_urls,
                video_url,
                created_at,
                edited_at,
                edit_history,
                user_id,
                wall_user_id,
                users!posts_user_id_fkey (
                  username,
                  display_name,
                  avatar_url
                ),
                wall_user:users!posts_wall_user_id_fkey (
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
              .eq("id", modalPost.id)
              .single();

            if (freshPost) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const allComments = ((freshPost as any).comments || []) as PostComment[];
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

              setModalPost({
                ...(freshPost as any),
                comments: commentsWithReplies,
                edit_history: (freshPost as any).edit_history || []
              });

              // Reload votes
              if (currentUser) {
                await loadUserVotes(currentUser.id);
                await loadVoteTotals([{ ...(freshPost as any), comments: commentsWithReplies }]);
              }
            }
          }}
          onUserAvatarUpdated={(newUrl) => {
            setCurrentUserAvatarUrl(newUrl);
            // Also update profile if viewing own profile
            if (profile && currentUser && profile.id === currentUser.id) {
              setProfile({ ...profile, avatar_url: newUrl });
            }
          }}
          onUserBannerUpdated={(newUrl) => {
            // Update profile if viewing own profile
            if (profile && currentUser && profile.id === currentUser.id) {
              setProfile({ ...profile, banner_url: newUrl });
            }
          }}
        />
      )}

      {/* Share Modal */}
      {sharePost && currentUser && (
        <ShareModal
          postId={sharePost.id}
          postContent={sharePost.content || ""}
          postImageUrl={sharePost.image_url}
          postVideoUrl={sharePost.video_url}
          originalPosterName={sharePost.users?.display_name || sharePost.users?.username || "Unknown"}
          supabase={supabase}
          userId={currentUser.id}
          onClose={() => setSharePost(null)}
          onShared={() => {
            // Reload page to get properly formatted data
            window.location.reload();
          }}
        />
      )}

      {/* YouTube Search Modal (own profile) */}
      {showYouTubeSearch && (
        <YouTubeSearchModal
          onClose={() => setShowYouTubeSearch(false)}
          onSelect={(video, searchQuery) => {
            const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
            setYoutubePreview({
              videoId: video.videoId,
              url: youtubeUrl,
              title: video.title,
              searchQuery: searchQuery,
            });
            setShowYouTubeSearch(false);
          }}
          onDirectPost={async (video) => {
            if (!currentUser || !profile) return;
            
            const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
            
            // Use the video title from YouTube (usually contains Artist - Album)
            const videoTitle = video.title;
            
            const { data, error } = await supabase
              .from("posts")
              .insert({
                content: "",
                image_url: null,
                video_url: youtubeUrl,
                video_title: videoTitle,
                user_id: currentUser.id,
              })
              .select()
              .single();
            
            if (!error && data) {
              await supabase.from("votes").insert({
                user_id: currentUser.id,
                target_type: "post",
                target_id: data.id,
                value: 1,
              });
              window.location.reload();
            }
          }}
        />
      )}

      {/* Spotify Search Modal (own profile) */}
      {showSpotifySearch && (
        <SpotifySearchModal
          onClose={() => setShowSpotifySearch(false)}
          onSelect={(result, searchQuery) => {
            const spotifyUrl = `https://open.spotify.com/${result.type}/${result.id}`;
            const displayTitle = result.artist 
              ? `${result.artist} - ${result.name}`
              : result.name;
            setSpotifyPreview({
              url: spotifyUrl,
              title: displayTitle,
              thumbnail: result.image,
              type: result.type,
              searchQuery: searchQuery,
            });
            setShowSpotifySearch(false);
          }}
          onDirectPost={async (result, searchQuery) => {
            if (!currentUser || !profile) return;
            
            const spotifyUrl = `https://open.spotify.com/${result.type}/${result.id}`;
            const displayTitle = result.artist 
              ? `${result.artist} - ${result.name}`
              : result.name;
            
            let videoTitle = displayTitle;
            if (searchQuery && !videoTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
              videoTitle = `${searchQuery} - ${videoTitle}`;
            }
            
            const { data, error } = await supabase
              .from("posts")
              .insert({
                content: "",
                image_url: null,
                video_url: spotifyUrl,
                video_title: videoTitle,
                user_id: currentUser.id,
              })
              .select()
              .single();
            
            if (!error && data) {
              await supabase.from("votes").insert({
                user_id: currentUser.id,
                target_type: "post",
                target_id: data.id,
                value: 1,
              });
              window.location.reload();
            }
          }}
        />
      )}

      {/* YouTube Search Modal (wall post) */}
      {showWallYouTubeSearch && (
        <YouTubeSearchModal
          onClose={() => setShowWallYouTubeSearch(false)}
          onSelect={(video) => {
            const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
            setWallYoutubePreview({
              videoId: video.videoId,
              url: youtubeUrl,
              title: video.title,
            });
            setShowWallYouTubeSearch(false);
          }}
          onDirectPost={async (video) => {
            if (!currentUser || !profile) return;
            
            const youtubeUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
            
            // Use the video title from YouTube (usually contains Artist - Album)
            const videoTitle = video.title;
            
            const { data, error } = await supabase
              .from("posts")
              .insert({
                content: "",
                image_url: null,
                video_url: youtubeUrl,
                video_title: videoTitle,
                user_id: currentUser.id,
                wall_user_id: profile.id,
              })
              .select()
              .single();
            
            if (!error && data) {
              await supabase.from("votes").insert({
                user_id: currentUser.id,
                target_type: "post",
                target_id: data.id,
                value: 1,
              });
              if (profile.id !== currentUser.id) {
                notifyWallPost(supabase, profile.id, currentUserUsername, data.id, "");
              }
              window.location.reload();
            }
          }}
        />
      )}

      {/* Spotify Search Modal (wall post) */}
      {showWallSpotifySearch && (
        <SpotifySearchModal
          onClose={() => setShowWallSpotifySearch(false)}
          onSelect={(result, searchQuery) => {
            const spotifyUrl = `https://open.spotify.com/${result.type}/${result.id}`;
            const displayTitle = result.artist 
              ? `${result.artist} - ${result.name}`
              : result.name;
            setWallSpotifyPreview({
              url: spotifyUrl,
              title: displayTitle,
              thumbnail: result.image,
              type: result.type,
              searchQuery: searchQuery,
            });
            setShowWallSpotifySearch(false);
          }}
          onDirectPost={async (result, searchQuery) => {
            if (!currentUser || !profile) return;
            
            const spotifyUrl = `https://open.spotify.com/${result.type}/${result.id}`;
            const displayTitle = result.artist 
              ? `${result.artist} - ${result.name}`
              : result.name;
            
            let videoTitle = displayTitle;
            if (searchQuery && !videoTitle.toLowerCase().includes(searchQuery.toLowerCase())) {
              videoTitle = `${searchQuery} - ${videoTitle}`;
            }
            
            const { data, error } = await supabase
              .from("posts")
              .insert({
                content: "",
                image_url: null,
                video_url: spotifyUrl,
                video_title: videoTitle,
                user_id: currentUser.id,
                wall_user_id: profile.id,
              })
              .select()
              .single();
            
            if (!error && data) {
              await supabase.from("votes").insert({
                user_id: currentUser.id,
                target_type: "post",
                target_id: data.id,
                value: 1,
              });
              if (profile.id !== currentUser.id) {
                notifyWallPost(supabase, profile.id, currentUserUsername, data.id, "");
              }
              window.location.reload();
            }
          }}
        />
      )}
      </div>
    </>
  );
}

// Helper function to render text with curly quotes styled as italics
function renderTextWithQuotes(text: string): React.ReactNode[] {
  const quoteRegex = /"([^"]+)"/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;
  
  while ((match = quoteRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={keyIndex++}>{text.substring(lastIndex, match.index)}</span>);
    }
    const quotedText = match[1];
    parts.push(
      <span key={keyIndex++} style={{ fontStyle: "italic" }}>
        "{quotedText}"
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={keyIndex++}>{text.substring(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
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

// Vote Buttons Component
function VoteButtons({
  targetType,
  targetId,
  votes,
  voteTotals,
  onVote,
}: {
  targetType: "post" | "comment";
  targetId: string;
  votes: Record<string, { id: string; user_id: string; value: number }>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
}) {
  const key = `${targetType}-${targetId}`;
  const userVote = votes[key]?.value || 0;
  const score = voteTotals[key] || 0;

  const scoreColor = score > 0 
    ? "var(--alzooka-gold)" 
    : score < 0 
      ? "#e57373" 
      : "var(--alzooka-cream)";
  
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, minWidth: 32 }}>
      <button
        onClick={() => onVote(targetType, targetId, 1)}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 8px",
          cursor: "pointer",
          color: userVote === 1 ? "var(--alzooka-gold)" : "var(--alzooka-cream)",
          opacity: userVote === 1 ? 1 : 0.5,
          fontSize: 14,
          lineHeight: 1,
        }}
        title="Upvote"
      >
        ▲
      </button>
      <span style={{ 
        fontSize: 14, 
        fontWeight: 600, 
        color: scoreColor,
        opacity: score === 0 ? 0.5 : 1,
      }}>
        {score}
      </span>
      <button
        onClick={() => onVote(targetType, targetId, -1)}
        style={{
          background: "transparent",
          border: "none",
          padding: "4px 8px",
          cursor: "pointer",
          color: userVote === -1 ? "#e57373" : "var(--alzooka-cream)",
          opacity: userVote === -1 ? 1 : 0.5,
          fontSize: 14,
          lineHeight: 1,
        }}
        title="Downvote"
      >
        ▼
      </button>
    </div>
  );
}
