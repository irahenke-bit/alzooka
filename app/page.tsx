"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import Header from "@/app/components/Header";
import { usePostModals } from "@/app/contexts/PostModalsContext";
import { ShareModal } from "@/app/components/ShareModal";
import { LinkPreview } from "@/app/components/LinkPreview";
import { EmojiButton } from "@/app/components/EmojiButton";
import { ReactionPicker, ReactionType, Reaction } from "@/app/components/ReactionPicker";
import { 
  notifyNewComment, 
  notifyNewReply, 
  notifyMention, 
  checkVoteMilestones,
  parseMentions,
  getUserIdsByUsernames 
} from "@/lib/notifications";


export default function FeedPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><p>Loading...</p></div>}>
      <FeedContent />
    </Suspense>
  );
}

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

type EditHistoryEntry = {
  content: string;
  edited_at: string;
};

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  image_urls?: string[] | null;
  video_url: string | null;
  wall_user_id: string | null;
  wall_user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  show_in_feed?: boolean;
  created_at: string;
  edited_at: string | null;
  edit_history: EditHistoryEntry[];
  user_id: string;
  users: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  comments: Comment[];
  // Group fields
  group_id?: string | null;
  groups?: {
    id: string;
    name: string;
  } | null;
  // Sharing fields
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

type GroupPreference = {
  group_id: string;
  include_in_feed: boolean;
  max_posts_per_day: number;
  whitelist_members: string[];
  mute_members: string[];
  friends_only: boolean;
};

// YouTube URL detection and parsing
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

function findYouTubeUrl(text: string): string | null {
  const urlPattern = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+)/i;
  const match = text.match(urlPattern);
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

// Helper function to check if post content matches any filtered words (case-insensitive, partial match)
function postMatchesFilter(post: Post, filteredWords: string[]): boolean {
  if (filteredWords.length === 0) return false;
  const contentLower = (post.content || "").toLowerCase();
  return filteredWords.some(word => contentLower.includes(word.toLowerCase()));
}

function FeedContent() {
  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState<string>("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [allowWallPosts, setAllowWallPosts] = useState<boolean>(true);
  const [wallFriendsOnly, setWallFriendsOnly] = useState<boolean>(true);
  const [filteredWords, setFilteredWords] = useState<string[]>([]);
  const [feedShowAllProfiles, setFeedShowAllProfiles] = useState<boolean>(true);
  const [feedShowAllGroups, setFeedShowAllGroups] = useState<boolean>(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const POSTS_PER_PAGE = 10;
  const [userFriends, setUserFriends] = useState<string[]>([]);
  const [groupPreferences, setGroupPreferences] = useState<GroupPreference[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [youtubePreview, setYoutubePreview] = useState<{videoId: string; url: string; title: string; playlistId?: string; playlistTitle?: string} | null>(null);
  const [loadingYoutubePreview, setLoadingYoutubePreview] = useState(false);
  const [spotifyPreview, setSpotifyPreview] = useState<{url: string; title: string; thumbnail: string; type: string} | null>(null);
  const [loadingSpotifyPreview, setLoadingSpotifyPreview] = useState(false);
  const [linkPreview, setLinkPreview] = useState<{url: string; title?: string; description?: string; image?: string; domain: string} | null>(null);
  const [loadingLinkPreview, setLoadingLinkPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const postModals = usePostModals();
  
  // Helper to open a post in a modal window (handled globally by GlobalModalsRenderer)
  const openPostModal = (post: Post) => {
    postModals.openModal(post.id);
  };
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightPostId = searchParams.get("post");
  const highlightCommentId = searchParams.get("comment");
  const notificationTimestamp = searchParams.get("t"); // Timestamp to force re-trigger on same notification

  console.log("URL params - post:", highlightPostId, "comment:", highlightCommentId);
  const supabase = createBrowserClient();

  // Helper function to build recursive comment tree (handles replies to replies)
  function buildCommentTreeRecursive(comments: Comment[]): Comment[] {
    const parentComments = comments.filter(c => !c.parent_comment_id);
    
    const attachReplies = (parent: Comment): Comment => {
      const directReplies = comments.filter(c => c.parent_comment_id === parent.id);
      return {
        ...parent,
        replies: directReplies.length > 0 
          ? directReplies.map(attachReplies).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          : undefined
      };
    };
    
    return parentComments
      .map(attachReplies)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  useEffect(() => {
    let postsSubscription: ReturnType<typeof supabase.channel> | null = null;
    let commentsSubscription: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let visibilityHandler: (() => void) | null = null;

    async function init() {
      // Check for OAuth callback tokens in URL hash (implicit flow)
      const hash = window.location.hash;
      if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
        // Give Supabase client time to process the hash tokens
        await new Promise(resolve => setTimeout(resolve, 500));
        // Clear the hash from URL
        window.history.replaceState({}, '', '/');
      }
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }
      
      const user = session.user;
      
      setUser(user);
      
      // PARALLEL FETCH: Get user data, friendships, and group prefs all at once
      const [userDataResult, friendshipsResult, prefsResult] = await Promise.all([
        supabase.from("users").select("username, avatar_url, allow_wall_posts, wall_friends_only, filtered_words, feed_show_all_profiles, feed_show_all_groups").eq("id", user.id).single(),
        supabase.from("friendships").select("requester_id, addressee_id").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq("status", "accepted"),
        supabase.from("user_group_preferences").select("*").eq("user_id", user.id).eq("include_in_feed", true),
      ]);
      
      const userData = userDataResult.data;
      const friendships = friendshipsResult.data;
      const prefs = prefsResult.data;
      
      if (!userData) {
        // User is authenticated but has no profile - redirect to no-profile page
        router.push(`/auth/no-profile?email=${encodeURIComponent(user.email || "")}`);
        return;
      }
      
      setUserUsername(userData.username);
      setUserAvatarUrl(userData.avatar_url);
      setAllowWallPosts(userData.allow_wall_posts ?? true);
      setWallFriendsOnly(userData.wall_friends_only ?? true);
      setFilteredWords(userData.filtered_words || []);
      setFeedShowAllProfiles(userData.feed_show_all_profiles ?? true);
      setFeedShowAllGroups(userData.feed_show_all_groups ?? true);
      
      const friendIds = (friendships || []).map(f =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );
      setUserFriends(friendIds);
      
      setGroupPreferences((prefs || []) as GroupPreference[]);
      
      // Load posts first - pass user.id and feed prefs since state isn't set yet
      const loadedPosts = await loadPosts(
        friendIds, 
        (prefs || []) as GroupPreference[], 
        user.id,
        userData.feed_show_all_profiles ?? true,
        userData.feed_show_all_groups ?? true
      );
      
      // Load votes in parallel
      await Promise.all([
        loadUserVotes(user.id),
        loadVoteTotals(loadedPosts),
        loadReactions(loadedPosts),
      ]);
      
      setLoading(false);

      // Fallback: poll periodically in case realtime misses an event (every 15s)
      pollInterval = setInterval(async () => {
        try {
          // Re-fetch current group preferences to ensure we have fresh data
          const { data: freshPrefs } = await supabase
            .from("user_group_preferences")
            .select("*")
            .eq("user_id", user.id)
            .eq("include_in_feed", true);
          
          const refreshedPosts = await loadPosts(friendIds, (freshPrefs || []) as GroupPreference[], user.id);
          if (refreshedPosts && refreshedPosts.length > 0) {
            await loadUserVotes(user.id);
            await loadVoteTotals(refreshedPosts);
            await loadReactions(refreshedPosts);
          }
        } catch (err) {
          console.error("Error in poll interval:", err);
        }
      }, 15000);

      // Also refresh when the tab becomes visible again
      visibilityHandler = async () => {
        try {
          if (document.visibilityState === "visible") {
            // Re-fetch current group preferences to ensure we have fresh data
            const { data: freshPrefs } = await supabase
              .from("user_group_preferences")
              .select("*")
              .eq("user_id", user.id)
              .eq("include_in_feed", true);
            
            const refreshedPosts = await loadPosts(friendIds, (freshPrefs || []) as GroupPreference[], user.id);
            if (refreshedPosts && refreshedPosts.length > 0) {
              await loadUserVotes(user.id);
              await loadVoteTotals(refreshedPosts);
              await loadReactions(refreshedPosts);
            }
          }
        } catch (err) {
          console.error("Error in visibility handler:", err);
        }
      };
      document.addEventListener("visibilitychange", visibilityHandler);

      // Subscribe to new posts in real-time
      postsSubscription = supabase
        .channel('feed-posts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'posts',
          },
          async (payload) => {
            try {
              // Don't add if it's our own post (we already added it optimistically)
              if (payload.new.user_id === user.id) return;
              
              // Skip group posts - only show feed posts
              if (payload.new.group_id) return;
              
              // Only show posts from friends
              if (!friendIds.includes(payload.new.user_id)) return;

              // Fetch the full post with user data
              const { data: newPost } = await supabase
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
                    parent_comment_id
                  )
                `)
                .eq("id", payload.new.id)
                .single();

              if (newPost) {
                // Fetch user data for comment authors separately
                const commentUserIds = new Set<string>();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((newPost as any).comments || []).forEach((c: any) => {
                  if (c.user_id) commentUserIds.add(c.user_id);
                });
                
                const commentUserMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
                if (commentUserIds.size > 0) {
                  const { data: commentUsers } = await supabase
                    .from("users")
                    .select("id, username, display_name, avatar_url, is_active")
                    .in("id", Array.from(commentUserIds));
                  if (commentUsers) {
                    commentUsers.forEach(u => {
                      // Only add active users - deactivated users show as [Deleted User]
                      if (u.is_active !== false) {
                        commentUserMap.set(u.id, { username: u.username, display_name: u.display_name, avatar_url: u.avatar_url });
                      }
                    });
                  }
                }
                
                // Process comments recursively (handles replies to replies)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const allComments = ((newPost as any).comments || []).map((c: any) => ({
                  ...c,
                  users: commentUserMap.get(c.user_id) || null // null for deleted users
                })) as unknown as Comment[];
                const commentsWithReplies = buildCommentTreeRecursive(allComments);

                const processedPost = {
                  ...newPost,
                  comments: commentsWithReplies
                } as unknown as Post;

                // Add to top of posts list
                let updatedPosts: Post[] = [];
                setPosts(currentPosts => {
                  // Check if post already exists
                  if (currentPosts.some(p => p.id === processedPost.id)) {
                    updatedPosts = currentPosts;
                    return currentPosts;
                  }
                  updatedPosts = [processedPost, ...currentPosts];
                  return updatedPosts;
                });

                // Load vote totals and reactions for the new post using the fresh list
                await loadVoteTotals(updatedPosts);
                await loadReactions(updatedPosts);
              }
            } catch (err) {
              console.error("Error in posts subscription:", err);
            }
          }
        )
        .subscribe();

      // Subscribe to new comments in real-time
      commentsSubscription = supabase
        .channel('feed-comments')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'comments',
          },
          async (payload) => {
            try {
              // Don't add if it's our own comment (we already added it optimistically)
              if (payload.new.user_id === user.id) return;

              // Fetch the full comment with user data
              const { data: commentData } = await supabase
                .from("comments")
                .select(`
                  id,
                  content,
                  created_at,
                  user_id,
                  post_id,
                  parent_comment_id
                `)
                .eq("id", payload.new.id)
                .single();

              if (commentData) {
                // Fetch user data separately to handle deleted users
                let commentUser = null;
                if (commentData.user_id) {
                  const { data: userData } = await supabase
                    .from("users")
                    .select("username, display_name, avatar_url")
                    .eq("id", commentData.user_id)
                    .single();
                  commentUser = userData;
                }
                const newComment = { ...commentData, users: commentUser };
                const postId = newComment.post_id;
                const commentId = newComment.id;
                
                // Update the post in the main feed
                setPosts(currentPosts => {
                  return currentPosts.map(post => {
                    if (post.id !== postId) return post;
                    
                    // Check if comment already exists (prevent duplicates from optimistic updates)
                    const commentExists = (comments: Comment[]): boolean => {
                      for (const c of comments) {
                        if (c.id === commentId) return true;
                        if (c.replies && commentExists(c.replies)) return true;
                      }
                      return false;
                    };
                    if (commentExists(post.comments || [])) return post;
                    
                    const typedComment = newComment as unknown as Comment;
                    
                    if (typedComment.parent_comment_id) {
                      // It's a reply - add to parent's replies
                      const addReplyToParent = (comments: Comment[]): Comment[] => {
                        return comments.map(c => {
                          if (c.id === typedComment.parent_comment_id) {
                            return {
                              ...c,
                              replies: [...(c.replies || []), typedComment]
                            };
                          }
                          if (c.replies && c.replies.length > 0) {
                            return { ...c, replies: addReplyToParent(c.replies) };
                          }
                          return c;
                        });
                      };
                      return { ...post, comments: addReplyToParent(post.comments || []) };
                    } else {
                      // Top-level comment
                      return { ...post, comments: [...(post.comments || []), typedComment] };
                    }
                  });
                });

                // Note: Modal windows are now updated by GlobalModalsRenderer
              }
            } catch (err) {
              console.error("Error in comments subscription:", err);
            }
          }
        )
        .subscribe();

      // Auto-open modal if comment is highlighted, scroll to post if only post is highlighted
      if (highlightCommentId && highlightPostId) {
        // Find the post containing the highlighted comment and open modal
        const { data: postsData } = await supabase
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
              parent_comment_id
            )
          `)
          .eq("id", highlightPostId)
          .single();
          
        if (postsData) {
          // Fetch user data for comment authors separately
          const commentUserIds = new Set<string>();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((postsData as any).comments || []).forEach((c: any) => {
            if (c.user_id) commentUserIds.add(c.user_id);
          });
          
          const commentUserMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
          if (commentUserIds.size > 0) {
            const { data: commentUsers } = await supabase
              .from("users")
              .select("id, username, display_name, avatar_url, is_active")
              .in("id", Array.from(commentUserIds));
            if (commentUsers) {
              commentUsers.forEach(u => {
                if (u.is_active !== false) {
                  commentUserMap.set(u.id, { username: u.username, display_name: u.display_name, avatar_url: u.avatar_url });
                }
              });
            }
          }
          
          // Process comments recursively (handles replies to replies)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allComments = ((postsData as any).comments || []).map((c: any) => ({
            ...c,
            users: commentUserMap.get(c.user_id) || null // null for deleted users
          })) as unknown as Comment[];
          const commentsWithReplies = buildCommentTreeRecursive(allComments);
          
          openPostModal({
            ...postsData,
            comments: commentsWithReplies
          } as unknown as Post);
          
          // Clear URL params so refresh doesn't re-trigger
          router.replace("/", { scroll: false });
        }
      } else if (highlightPostId) {
        setTimeout(() => {
          const element = document.getElementById(`post-${highlightPostId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          // Clear URL params so refresh doesn't re-trigger
          router.replace("/", { scroll: false });
        }, 100);
      }
    }
    
    init();

    // Cleanup subscription on unmount
    return () => {
      if (postsSubscription) {
        supabase.removeChannel(postsSubscription);
      }
      if (commentsSubscription) {
        supabase.removeChannel(commentsSubscription);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
  }, []);

  // Note: Global escape key handling is now done in GlobalModalsRenderer

  // Handle URL param changes for comment highlighting (e.g., from notification clicks)
  useEffect(() => {
    async function openModalForComment() {
      if (highlightCommentId && highlightPostId && !loading) {
        // Fetch the post and open modal
        const { data: postsData } = await supabase
          .from("posts")
          .select(`
            id,
            content,
            image_url,
            video_url,
            wall_user_id,
            created_at,
            edited_at,
            edit_history,
            user_id,
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
              parent_comment_id
            )
          `)
          .eq("id", highlightPostId)
          .single();

        if (postsData) {
          // Fetch user data for comment authors separately
          const commentUserIds = new Set<string>();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((postsData as any).comments || []).forEach((c: any) => {
            if (c.user_id) commentUserIds.add(c.user_id);
          });
          
          const commentUserMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
          if (commentUserIds.size > 0) {
            const { data: commentUsers } = await supabase
              .from("users")
              .select("id, username, display_name, avatar_url, is_active")
              .in("id", Array.from(commentUserIds));
            if (commentUsers) {
              commentUsers.forEach(u => {
                if (u.is_active !== false) {
                  commentUserMap.set(u.id, { username: u.username, display_name: u.display_name, avatar_url: u.avatar_url });
                }
              });
            }
          }
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allComments = ((postsData as any).comments || []).map((c: any) => ({
            ...c,
            users: commentUserMap.get(c.user_id) || null // null for deleted users
          })) as unknown as Comment[];
          const commentsWithReplies = buildCommentTreeRecursive(allComments);

          openPostModal({
            ...postsData,
            comments: commentsWithReplies
          } as unknown as Post);
          
          // Scroll to the highlighted comment after modal renders
          setTimeout(() => {
            const commentElement = document.getElementById(`modal-comment-${highlightCommentId}`);
            if (commentElement) {
              commentElement.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 150);
          
          // Clear URL params after opening modal so refresh doesn't re-trigger
          router.replace("/", { scroll: false });
        }
      }
    }
    
    openModalForComment();
  }, [highlightCommentId, highlightPostId, notificationTimestamp, loading, router]);

  // Infinite scroll observer - load more posts when scrolling near bottom
  useEffect(() => {
    if (!loadMoreRef.current || loading) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePosts && !loadingMorePosts) {
          loadMorePosts();
        }
      },
      { rootMargin: "400px" } // Start loading 400px before reaching the end
    );
    
    observer.observe(loadMoreRef.current);
    
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMorePosts, loadingMorePosts, loading]);

  async function loadPosts(
    friends: string[] = userFriends,
    prefs: GroupPreference[] = groupPreferences,
    currentUserId?: string,
    showAllProfiles: boolean = feedShowAllProfiles,
    showAllGroups: boolean = feedShowAllGroups,
    reset: boolean = true // If true, start from beginning; if false, load more
  ): Promise<Post[]> {
    // Calculate offset for pagination
    const offset = reset ? 0 : posts.length;
    
    // 1. Load regular feed posts (non-group posts)
    // If showAllProfiles is true, load from everyone; otherwise, only from friends + self
    const userId = currentUserId || user?.id;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let feedPosts: any[] | null = [];
    
    const feedQuery = supabase
        .from("posts")
        .select(`
          id,
          content,
          image_url,
          image_urls,
          video_url,
          wall_user_id,
        show_in_feed,
          created_at,
          edited_at,
          edit_history,
          user_id,
          group_id,
          shared_from_post_id,
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
          groups:groups!posts_group_id_fkey (
            id,
            name
          ),
          comments (
            id,
            content,
            created_at,
            user_id,
            parent_comment_id
          )
        `)
        .is("group_id", null)
        .order("created_at", { ascending: false })
        .range(offset, offset + POSTS_PER_PAGE - 1);
      
    if (showAllProfiles) {
      // World view: show all posts (but filter wall posts by show_in_feed later)
      const { data } = await feedQuery;
      feedPosts = data;
    } else {
      // Friends only view: filter by allowed user IDs
      const allowedUserIds = userId ? [userId, ...friends] : friends;
      if (allowedUserIds.length > 0) {
        const { data } = await feedQuery.in("user_id", allowedUserIds);
      feedPosts = data;
    }
    }
    
    // Filter out wall posts that have show_in_feed = false (unless it's on our wall or we made it)
    if (feedPosts) {
      feedPosts = feedPosts.filter(post => {
        // If it's not a wall post, always show
        if (!post.wall_user_id) return true;
        // If show_in_feed is true (or null/undefined for backwards compat), show it
        if (post.show_in_feed !== false) return true;
        // If it's on our wall, show it
        if (post.wall_user_id === userId) return true;
        // If we made the post, show it
        if (post.user_id === userId) return true;
        // Otherwise, hide it
        return false;
      });
    }

    // 2. Load group posts based on user preferences or all groups if showAllGroups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let groupPosts: any[] = [];
    
    if (showAllGroups) {
      // Load posts from all groups the user is a member of
      const { data: userMemberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);
      
      const memberGroupIds = (userMemberships || []).map(m => m.group_id);
      
      if (memberGroupIds.length > 0) {
        const { data: allGroupPostsData } = await supabase
          .from("posts")
          .select(`
            id,
            content,
            image_url,
            image_urls,
            video_url,
            wall_user_id,
            created_at,
            edited_at,
            edit_history,
            user_id,
            group_id,
            shared_from_post_id,
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
            groups:groups!posts_group_id_fkey (
              id,
              name
            ),
            comments (
              id,
              content,
              created_at,
              user_id,
              parent_comment_id
            )
          `)
          .in("group_id", memberGroupIds)
          .order("created_at", { ascending: false })
          .range(offset, offset + POSTS_PER_PAGE - 1);
        
        groupPosts = allGroupPostsData || [];
      }
    } else if (prefs.length > 0) {
      // Original behavior: load from followed groups with filters
      const groupIds = prefs.map(p => p.group_id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: rawGroupPostsData } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          image_url,
          image_urls,
          video_url,
          wall_user_id,
          created_at,
          edited_at,
          edit_history,
          user_id,
          group_id,
          shared_from_post_id,
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
          groups:groups!posts_group_id_fkey (
            id,
            name
          ),
          comments (
            id,
            content,
            created_at,
            user_id,
            parent_comment_id
          )
        `)
        .in("group_id", groupIds)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(50); // Limit for performance, filtered posts will be further reduced
      
      // Apply filters per group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredGroupPosts: any[] = [];
      const groupPostCounts: Record<string, number> = {};
      
      for (const post of rawGroupPostsData || []) {
        const pref = prefs.find(p => p.group_id === post.group_id);
        if (!pref) continue;
        
        // Initialize count for this group
        if (!groupPostCounts[post.group_id!]) {
          groupPostCounts[post.group_id!] = 0;
        }
        
        // Check max_posts_per_day limit
        if (groupPostCounts[post.group_id!] >= pref.max_posts_per_day) {
          continue;
        }
        
        // Check mute_members filter
        if (pref.mute_members.includes(post.user_id)) {
          continue;
        }
        
        // Check friends_only filter
        if (pref.friends_only && !friends.includes(post.user_id)) {
          continue;
        }
        
        // Post passes all filters
        groupPostCounts[post.group_id!]++;
        
        // Prioritize whitelisted members by boosting them (we'll sort later)
        const isWhitelisted = pref.whitelist_members.includes(post.user_id);
        filteredGroupPosts.push({ ...post, _whitelisted: isWhitelisted } as typeof post);
      }
      
      groupPosts = filteredGroupPosts;
    }

    // 3. Merge feed posts and group posts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allRawPosts = [...(feedPosts || []), ...(groupPosts || [])] as any[];
    
    // 3.25 Filter out posts from deactivated users
    const postUserIds = [...new Set(allRawPosts.map((p: { user_id: string }) => p.user_id))];
    if (postUserIds.length > 0) {
      const { data: activeUsers } = await supabase
        .from("users")
        .select("id")
        .in("id", postUserIds)
        .neq("is_active", false);
      
      const activeUserIds = new Set((activeUsers || []).map(u => u.id));
      allRawPosts = allRawPosts.filter((p: { user_id: string }) => activeUserIds.has(p.user_id));
    }
    
    // 3.5 Fetch user data for all comment authors
    const allCommentUserIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allRawPosts.forEach((post: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (post.comments || []).forEach((c: any) => {
        if (c.user_id) allCommentUserIds.add(c.user_id);
      });
    });
    
    const commentUserMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
    if (allCommentUserIds.size > 0) {
      const { data: commentUsers } = await supabase
        .from("users")
        .select("id, username, display_name, avatar_url, is_active")
        .in("id", Array.from(allCommentUserIds));
      if (commentUsers) {
        commentUsers.forEach(u => {
          if (u.is_active !== false) {
            commentUserMap.set(u.id, { username: u.username, display_name: u.display_name, avatar_url: u.avatar_url });
          }
        });
      }
    }
    
    // Add users to comments (null for deleted users)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allRawPosts.forEach((post: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      post.comments = (post.comments || []).map((c: any) => ({
        ...c,
        users: commentUserMap.get(c.user_id) || null
      }));
    });

    // Fetch original posts for shared posts
    const sharedPostIds = allRawPosts
      .filter((p: { shared_from_post_id?: string | null }) => p.shared_from_post_id)
      .map((p: { shared_from_post_id: string }) => p.shared_from_post_id);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sharedPostsMap: Record<string, any> = {};
    
    if (sharedPostIds.length > 0) {
      const { data: sharedPostsData } = await supabase
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
        sharedPostsData.forEach((sp: { id: string; user_id: string; group_id?: string | null; users: unknown; groups: unknown }) => {
          sharedPostsMap[sp.id] = {
            id: sp.id,
            user_id: sp.user_id,
            users: Array.isArray(sp.users) ? sp.users[0] : sp.users,
            group_id: sp.group_id,
            groups: Array.isArray(sp.groups) ? sp.groups[0] : sp.groups,
          };
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postsWithNestedComments: Post[] = allRawPosts.map((post: any) => {
      const allComments = (post.comments || []) as Comment[];
      const commentsWithReplies = buildCommentTreeRecursive(allComments);
      
      // Get shared post info if this is a shared post
      const sharedFrom = post.shared_from_post_id ? sharedPostsMap[post.shared_from_post_id] : null;
      
      return {
        ...post,
        groups: Array.isArray(post.groups) ? post.groups[0] : post.groups,
        comments: commentsWithReplies,
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
      } as Post;
    });

    // Sort by created_at descending (whitelisted posts could be boosted here if needed)
    postsWithNestedComments.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Determine if there are more posts to load
    // If we got fewer posts than requested, we've reached the end
    const totalNewPosts = (feedPosts?.length || 0) + groupPosts.length;
    setHasMorePosts(totalNewPosts >= POSTS_PER_PAGE);

    if (reset) {
      setPosts(postsWithNestedComments);
    } else {
      // Append new posts, avoiding duplicates
      setPosts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = postsWithNestedComments.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
    }
    
    return postsWithNestedComments;
  }

  // Load more posts for infinite scroll
  async function loadMorePosts() {
    if (loadingMorePosts || !hasMorePosts) return;
    
    setLoadingMorePosts(true);
    try {
      const newPosts = await loadPosts(
        userFriends,
        groupPreferences,
        user?.id,
        feedShowAllProfiles,
        feedShowAllGroups,
        false // reset = false means append
      );
      
      if (newPosts.length > 0) {
        await loadVoteTotals(newPosts);
        await loadReactions(newPosts);
      }
    } finally {
      setLoadingMorePosts(false);
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

  async function loadVoteTotals(targetPosts?: Post[]) {
    const sourcePosts = targetPosts ?? posts;

    const postIds = sourcePosts.map(p => p.id);
    const commentIds: string[] = [];
    sourcePosts.forEach(p => {
      (p.comments || []).forEach(c => {
        commentIds.push(c.id);
        (c.replies || []).forEach(r => commentIds.push(r.id));
      });
    });

    // Guard against empty lists (Supabase .in needs at least one item)
    const safePostIds = postIds.length ? postIds : ["00000000-0000-0000-0000-000000000000"];
    const safeCommentIds = commentIds.length ? commentIds : ["00000000-0000-0000-0000-000000000000"];

    const [{ data: postVotes }, { data: commentVotes }] = await Promise.all([
      supabase
        .from("votes")
        .select("target_id, value")
        .eq("target_type", "post")
        .in("target_id", safePostIds),
      supabase
        .from("votes")
        .select("target_id, value")
        .eq("target_type", "comment")
        .in("target_id", safeCommentIds),
    ]);

    const totals: Record<string, number> = {};

    (postVotes || []).forEach((vote) => {
      const key = `post-${vote.target_id}`;
      totals[key] = (totals[key] || 0) + vote.value;
    });

    (commentVotes || []).forEach((vote) => {
      const key = `comment-${vote.target_id}`;
      totals[key] = (totals[key] || 0) + vote.value;
    });

    setVoteTotals(totals);
  }

  async function loadReactions(targetPosts?: Post[]) {
    const sourcePosts = targetPosts ?? posts;
    const postIds = sourcePosts.map(p => p.id);
    
    if (postIds.length === 0) return;

    const { data: reactionsData } = await supabase
      .from("reactions")
      .select(`
        id, user_id, post_id, reaction_type, created_at,
        users (username, display_name, avatar_url)
      `)
      .in("post_id", postIds);

    if (reactionsData) {
      const reactionsByPost: Record<string, Reaction[]> = {};
      reactionsData.forEach((r) => {
        if (!reactionsByPost[r.post_id]) {
          reactionsByPost[r.post_id] = [];
        }
        // Handle users being returned as array by Supabase
        const normalizedReaction = {
          ...r,
          users: Array.isArray(r.users) ? r.users[0] : r.users,
        } as Reaction;
        reactionsByPost[r.post_id].push(normalizedReaction);
      });
      setReactions(reactionsByPost);
    }
  }

  function handleReactionsChange(postId: string, newReactions: Reaction[]) {
    setReactions(prev => ({
      ...prev,
      [postId]: newReactions,
    }));
  }

  async function handleVote(targetType: "post" | "comment", targetId: string, value: number) {
    if (!user) return;

    const key = `${targetType}-${targetId}`;
    const existingVote = votes[key];
    const currentTotal = voteTotals[key] || 0;
    let newTotal = currentTotal;

    if (existingVote) {
      if (existingVote.value === value) {
        // Same vote - remove it
        await supabase.from("votes").delete().eq("id", existingVote.id);
        const newVotes = { ...votes };
        delete newVotes[key];
        setVotes(newVotes);
        newTotal = currentTotal - existingVote.value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      } else {
        // Different vote - update it
        await supabase.from("votes").update({ value }).eq("id", existingVote.id);
        setVotes({ ...votes, [key]: { ...existingVote, value } });
        // Remove old vote value, add new vote value
        newTotal = currentTotal - existingVote.value + value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      }
    } else {
      // New vote
      const { data } = await supabase
        .from("votes")
        .insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
          value,
        })
        .select()
        .single();

      if (data) {
        setVotes({ ...votes, [key]: data });
        newTotal = currentTotal + value;
        setVoteTotals({ ...voteTotals, [key]: newTotal });
      }
    }

    // Check for vote milestones (only if vote changed the total positively)
    if (newTotal !== currentTotal) {
      // Get owner of the post/comment
      let ownerId: string | null = null;
      
      if (targetType === "post") {
        const post = posts.find(p => p.id === targetId);
        ownerId = post?.user_id || null;
      } else {
        // Find comment in posts
        for (const post of posts) {
          const comment = post.comments?.find(c => c.id === targetId);
          if (comment) {
            ownerId = comment.user_id;
            break;
          }
          // Check replies too
          for (const c of post.comments || []) {
            const reply = c.replies?.find(r => r.id === targetId);
            if (reply) {
              ownerId = reply.user_id;
              break;
            }
          }
        }
      }

      if (ownerId && ownerId !== user.id) {
        checkVoteMilestones(supabase, ownerId, targetType, targetId, newTotal, currentTotal);
      }
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
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

    const newImages = [...selectedImages, ...validFiles].slice(0, 10);
    const newPreviews = [...imagePreviews, ...previews].slice(0, 10);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
    e.target.value = "";
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    
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

    const newImages = [...selectedImages, ...validFiles].slice(0, 10);
    const newPreviews = [...imagePreviews, ...previews].slice(0, 10);
    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  }

  function removeYoutubePreview() {
    setYoutubePreview(null);
  }

  function removeSpotifyPreview() {
    setSpotifyPreview(null);
  }

  function removeLinkPreview() {
    setLinkPreview(null);
  }

  async function handleContentChange(newContent: string) {
    setContent(newContent);
    
    // Check for YouTube URL if we don't already have a preview
    if (!youtubePreview && !spotifyPreview && !linkPreview && !loadingYoutubePreview && !loadingSpotifyPreview && !loadingLinkPreview) {
      const youtubeUrl = findYouTubeUrl(newContent);
      if (youtubeUrl) {
        const videoId = extractYouTubeVideoId(youtubeUrl);
        const playlistId = extractYouTubePlaylistId(youtubeUrl);
        if (videoId) {
          setLoadingYoutubePreview(true);
          try {
            // Fetch video title using noembed (no API key needed)
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
            // If fetch fails, still show preview with generic title
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
          return;
        }
      }

      // Check for any other URL for link preview
      if (!linkPreview && !loadingLinkPreview) {
        const urlMatch = newContent.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
          const url = urlMatch[0];
          // Don't create link preview for YouTube or Spotify URLs
          if (!url.includes("youtube.com") && !url.includes("youtu.be") && !url.includes("spotify.com")) {
            setLoadingLinkPreview(true);
            try {
              const domain = new URL(url).hostname.replace("www.", "");
              
              // Fetch link metadata using microlink.io
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const response = await fetch(
                `https://api.microlink.io?url=${encodeURIComponent(url)}`,
                { signal: controller.signal }
              );
              clearTimeout(timeoutId);
              
              const result = await response.json();
              
              if (result.status === "success" && result.data) {
                // Check if title looks like a captcha/bot check page
                const badTitles = ["just a moment", "verifying", "checking your browser", "access denied"];
                const isBadTitle = badTitles.some(bad => 
                  result.data.title?.toLowerCase().includes(bad)
                );
                
                setLinkPreview({
                  url,
                  title: isBadTitle ? undefined : result.data.title,
                  description: isBadTitle ? undefined : result.data.description,
                  image: result.data.image?.url,
                  domain,
                });
              } else {
                // Still show preview with just domain
                setLinkPreview({ url, domain });
              }
            } catch {
              // Show basic preview on error
              try {
                const domain = new URL(url).hostname.replace("www.", "");
                setLinkPreview({ url, domain });
              } catch {
                // Invalid URL, skip
              }
            }
            setLoadingLinkPreview(false);
          }
        }
      }
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    // Allow posting if there's content, image, YouTube video, Spotify, or link preview
    if ((!content.trim() && selectedImages.length === 0 && !youtubePreview && !spotifyPreview && !linkPreview) || !user) return;

    setPosting(true);

    // Upload ALL images
    const uploadedUrls: string[] = [];
    for (const file of selectedImages) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Failed to upload image. Please try again.");
        setPosting(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        content: content.trim(),
        image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : null, // Keep first for backwards compat
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : null, // All images
        video_url: youtubePreview?.url || spotifyPreview?.url || null,
        user_id: user.id,
        wall_user_id: null,
      })
      .select()
      .single();

    if (!error && data) {
      // Auto-upvote own post (like Reddit)
      await supabase.from("votes").insert({
        user_id: user.id,
        target_type: "post",
        target_id: data.id,
        value: 1,
      });
      
      setContent("");
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setSelectedImages([]);
      setImagePreviews([]);
      setYoutubePreview(null);
      setSpotifyPreview(null);
      setLinkPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      const refreshedPosts = await loadPosts();
      await loadUserVotes(user.id);
      await loadVoteTotals(refreshedPosts);
      await loadReactions(refreshedPosts);
    }

    setPosting(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
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

  return (
    <>
      <Header
        user={user}
        userUsername={userUsername}
        currentPage="feed"
        userAvatarUrl={userAvatarUrl}
      />

      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>

      {/* New Post Form */}
      <form onSubmit={handlePost} style={{ marginBottom: 32 }}>
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
          onDrop={handleDrop}
        >
          {/* Left column - Avatar, Emoji, Quote */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
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
                {userUsername?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            
            {/* Emoji Button */}
            <EmojiButton
              direction="down"
              buttonSize={28}
              onEmojiSelect={(emoji) => {
                const textarea = textareaRef.current;
                if (textarea) {
                  const start = textarea.selectionStart || 0;
                  const end = textarea.selectionEnd || 0;
                  const newContent = content.slice(0, start) + emoji + content.slice(end);
                  setContent(newContent);
                  setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + emoji.length, start + emoji.length);
                  }, 0);
                } else {
                  setContent(content + emoji);
                }
              }}
            />
            
            {/* Quote Button */}
            <button
              type="button"
              title="Insert quote"
              onClick={() => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                const start = textarea.selectionStart || 0;
                const end = textarea.selectionEnd || 0;
                if (start !== end) {
                  const selectedText = content.substring(start, end);
                  const newText = content.substring(0, start) + `"${selectedText}"` + content.substring(end);
                  setContent(newText);
                  setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(end + 2, end + 2);
                  }, 0);
                } else {
                  const newText = content.substring(0, start) + '""' + content.substring(start);
                  setContent(newText);
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
            ref={textareaRef}
            placeholder="What's on your mind? Paste a YouTube or Spotify link to share..."
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={3}
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
                  onClick={() => removeImage(index)}
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
                onClick={() => fileInputRef.current?.click()}
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

        {/* Spotify Preview */}
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

        {/* Link Preview */}
        {linkPreview && (
          <div style={{ position: "relative", marginBottom: 12 }}>
            <div style={{
              background: "var(--alzooka-teal-dark)",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid rgba(240, 235, 224, 0.2)"
            }}>
              {linkPreview.image && (
                <img
                  src={linkPreview.image}
                  alt=""
                  style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }}
                />
              )}
              <div style={{ padding: "12px 16px" }}>
                <p style={{ margin: 0, fontSize: 11, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>
                  🔗 {linkPreview.domain}
                </p>
                {linkPreview.title && (
                  <p style={{ margin: "4px 0 0 0", fontSize: 14, fontWeight: 600 }}>
                    {linkPreview.title}
                  </p>
                )}
                {linkPreview.description && (
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, opacity: 0.7, lineHeight: 1.4 }}>
                    {linkPreview.description.substring(0, 150)}{linkPreview.description.length > 150 ? "..." : ""}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={removeLinkPreview}
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

        {/* Loading indicator for link preview */}
        {loadingLinkPreview && (
          <div style={{ marginBottom: 12, padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>Loading link preview...</p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
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
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📷 Photo
          </button>
          <button type="submit" disabled={posting || (!content.trim() && selectedImages.length === 0 && !youtubePreview && !spotifyPreview && !linkPreview)}>
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>

      {/* Posts Feed */}
      <div>
        {(() => {
          // Filter posts: exclude posts matching filtered words, but always show own posts
          const visiblePosts = posts.filter(post => 
            post.user_id === user?.id || !postMatchesFilter(post, filteredWords)
          );
          
          return visiblePosts.length === 0 ? (
            <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
              No posts yet. Be the first to share something.
            </p>
          ) : (
            <>
              {visiblePosts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  user={user!} 
                  supabase={supabase}
                  votes={votes}
                  voteTotals={voteTotals}
                  onVote={handleVote}
                  isHighlighted={post.id === highlightPostId}
                  onOpenModal={() => openPostModal(post)}
                  onCommentAdded={async () => {
                    const refreshedPosts = await loadPosts();
                    await loadUserVotes(user!.id);
                    await loadVoteTotals(refreshedPosts);
                    await loadReactions(refreshedPosts);
                  }}
                  reactions={reactions[post.id] || []}
                  onReactionsChange={(newReactions) => handleReactionsChange(post.id, newReactions)}
                />
              ))}
              
              {/* Load more sentinel for infinite scroll */}
              <div ref={loadMoreRef} style={{ height: 1 }} />
              
              {/* Loading indicator */}
              {loadingMorePosts && (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <p className="text-muted">Loading more posts...</p>
                </div>
              )}
              
              {/* End of feed indicator */}
              {!hasMorePosts && posts.length > 0 && (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <p className="text-muted">You&apos;ve reached the end!</p>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Note: Post modals are now rendered globally by GlobalModalsRenderer in Providers.tsx */}
      </div>
    </>
  );
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
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
}) {
  const key = `${targetType}-${targetId}`;
  const userVote = votes[key]?.value || 0;
  const score = voteTotals[key] || 0;

  // Determine score color: gold if positive, red if negative, muted if zero
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

// Post Card Component
function PostCard({
  post,
  user,
  supabase,
  votes,
  voteTotals,
  onVote,
  isHighlighted,
  onOpenModal,
  onCommentAdded,
  reactions,
  onReactionsChange
}: {
  post: Post;
  user: User;
  supabase: ReturnType<typeof createBrowserClient>;
  votes: Record<string, Vote>;
  voteTotals: Record<string, number>;
  onVote: (type: "post" | "comment", id: string, value: number) => void;
  isHighlighted?: boolean;
  onOpenModal: () => void;
  onCommentAdded: () => void;
  reactions: Reaction[];
  onReactionsChange: (reactions: Reaction[]) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  async function handleDeletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    
    await supabase.from("posts").delete().eq("id", postId);
    onCommentAdded(); // Refresh the feed
  }

  async function handleSaveEdit() {
    if (!editContent.trim() && !post.image_url) return;
    
    setSaving(true);

    // Add current content to edit history
    const newHistoryEntry: EditHistoryEntry = {
      content: post.content,
      edited_at: new Date().toISOString(),
    };
    
    const updatedHistory = [...(post.edit_history || []), newHistoryEntry];

    const { error } = await supabase
      .from("posts")
      .update({
        content: editContent.trim(),
        edited_at: new Date().toISOString(),
        edit_history: updatedHistory,
      })
      .eq("id", post.id);

    if (!error) {
      setIsEditing(false);
      onCommentAdded(); // Refresh the feed
    }

    setSaving(false);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditContent(post.content);
  }

  // Count all comments recursively (unlimited depth)
  const countCommentsRecursive = (comments: Comment[]): number => {
    return comments.reduce((total, comment) => {
      return total + 1 + (comment.replies ? countCommentsRecursive(comment.replies) : 0);
    }, 0);
  };

  const commentCount = countCommentsRecursive(post.comments || []);

  return (
    <article 
      className="card" 
      id={`post-${post.id}`}
      style={isHighlighted ? { 
        boxShadow: "0 0 0 2px var(--alzooka-gold)",
        scrollMarginTop: 100,
      } : undefined}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {/* Vote Buttons */}
        <VoteButtons
          targetType="post"
          targetId={post.id}
          votes={votes}
          voteTotals={voteTotals}
          onVote={onVote}
        />

        {/* Post Content */}
        <div style={{ flex: 1 }}>
          {/* Post Header */}
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link 
              href={`/profile/${post.users?.username || "unknown"}`}
              style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
            >
              {post.users?.avatar_url ? (
                <img 
                  src={post.users.avatar_url} 
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
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
              {/* Edit/Delete - visible to owner only */}
              {(post.user_id === user.id || post.wall_user_id === user.id) && (
                <>
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
                  <button
                    onClick={() => handleDeletePost(post.id)}
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
                </>
              )}
            </div>
          </div>
          {post.wall_user_id && post.wall_user && post.wall_user.username !== post.users?.username && (
            <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.75 }}>
              Posted on <Link href={`/profile/${post.wall_user.username}`} style={{ color: "var(--alzooka-gold)" }}>{post.wall_user.display_name || post.wall_user.username}</Link>&apos;s wall
            </div>
          )}

          {/* Group attribution */}
          {post.group_id && post.groups && (
            <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.75 }}>
              Posted in <Link href={`/groups/${post.group_id}`} style={{ color: "var(--alzooka-gold)" }}>{post.groups.name}</Link>
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

          {/* Post Content - Edit Mode or View Mode */}
          {isEditing ? (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                style={{ marginBottom: 12, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
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
            <>
              {(() => {
                // Content is always on the post itself (shared posts copy the content)
                // shared_from_post is only used for attribution
                // Strip URLs from displayed content when there's a preview
                let displayContent = post.content;
                const videoUrl = post.video_url;
                
                // Strip YouTube/Spotify URLs if video exists
                if (videoUrl && displayContent) {
                  displayContent = displayContent
                    .replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+/gi, '')
                    .replace(/https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+/gi, '')
                    .trim();
                }
                
                // Strip ALL URLs when no image/video (link preview will show instead)
                if (!post.image_url && !post.video_url && displayContent) {
                  displayContent = displayContent
                    .replace(/https?:\/\/[^\s]+/gi, '')
                    .trim();
                }
                
                return displayContent ? (
                  <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>{renderTextWithQuotes(displayContent)}</p>
                ) : null;
              })()}
              
              {/* Edited indicator */}
              {post.edited_at && (
                <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.6 }}>
                  <span>Edited {formatTime(post.edited_at)}</span>
                  {post.edit_history && post.edit_history.length > 0 && (
                    <button
                      onClick={() => setShowEditHistory(!showEditHistory)}
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
                      {showEditHistory ? "Hide edits" : "See edits"}
                    </button>
                  )}
                </div>
              )}

              {/* Edit History */}
              {showEditHistory && post.edit_history && post.edit_history.length > 0 && (
                <div style={{ 
                  marginBottom: 16, 
                  padding: 12, 
                  background: "rgba(0, 0, 0, 0.2)", 
                  borderRadius: 8,
                  fontSize: 14,
                }}>
                  <p style={{ margin: "0 0 8px 0", fontWeight: 600, fontSize: 12, opacity: 0.7 }}>
                    Edit History
                  </p>
                  {post.edit_history.map((entry, index) => (
                    <div 
                      key={index} 
                      style={{ 
                        marginBottom: index < post.edit_history.length - 1 ? 12 : 0,
                        paddingBottom: index < post.edit_history.length - 1 ? 12 : 0,
                        borderBottom: index < post.edit_history.length - 1 ? "1px solid rgba(240, 235, 224, 0.1)" : "none",
                      }}
                    >
                      <span style={{ fontSize: 11, opacity: 0.5 }}>
                        {formatTime(entry.edited_at)}
                      </span>
                      <p style={{ margin: "4px 0 0 0", opacity: 0.7, fontStyle: "italic" }}>
                        {entry.content || "(no text)"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          {/* Post Images Gallery */}
          {(() => {
            const images = post.image_urls || (post.image_url ? [post.image_url] : []);
            if (images.length === 0) return null;
            
            if (images.length === 1) {
              return (
                <div style={{ marginBottom: 16 }}>
                  <img 
                    src={images[0]} 
                    alt="Post image"
                    style={{ 
                      maxWidth: "100%", 
                      maxHeight: 500,
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    onClick={onOpenModal}
                  />
                </div>
              );
            }
            
            // Multiple images - grid layout
            return (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: images.length === 2 ? "1fr 1fr" : "repeat(3, 1fr)",
                gap: 4,
                marginBottom: 16,
                borderRadius: 8,
                overflow: "hidden",
              }}>
                {images.slice(0, 6).map((url, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      position: "relative",
                      paddingTop: images.length === 2 ? "100%" : "100%",
                    }}
                  >
                    <img 
                      src={url} 
                      alt={`Image ${idx + 1}`}
                      style={{ 
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        cursor: "pointer",
                      }}
                      onClick={onOpenModal}
                    />
                    {idx === 5 && images.length > 6 && (
                      <div 
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(0,0,0,0.6)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 24,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onClick={onOpenModal}
                      >
                        +{images.length - 6}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* YouTube or Spotify Player */}
          {(post.shared_from_post?.video_url || post.video_url) && (() => {
            const videoUrl = post.shared_from_post?.video_url || post.video_url || "";
            // Check if it's a YouTube URL
            const videoId = extractYouTubeVideoId(videoUrl);
            if (videoId) {
              const playlistId = extractYouTubePlaylistId(videoUrl);
              const embedUrl = playlistId 
                ? `https://www.youtube.com/embed/${videoId}?list=${playlistId}&rel=0`
                : `https://www.youtube.com/embed/${videoId}?rel=0`;
              
              return (
                <div style={{ marginBottom: 16 }}>
                  {playlistId && (
                    <PlaylistTitle videoUrl={videoUrl} playlistId={playlistId} />
                  )}
                  <div style={{ 
                    position: "relative",
                    paddingBottom: "56.25%", /* 16:9 aspect ratio */
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
            const spotifyUrl = findSpotifyUrl(videoUrl);
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

          {/* Link Preview for non-YouTube/Spotify URLs */}
          {!post.image_url && !post.video_url && post.content && (() => {
            // Find URLs that are not YouTube or Spotify
            const urlRegex = /https?:\/\/[^\s]+/gi;
            const urls = (post.content.match(urlRegex) || []).map(url =>
              // Strip trailing punctuation that might be part of the sentence, not the URL
              url.replace(/[.,;:!?)]+$/, '')
            );
            const previewUrl = urls.find(url =>
              !url.match(/youtube\.com|youtu\.be|spotify\.com/i)
            );
            return previewUrl ? <LinkPreview url={previewUrl} /> : null;
          })()}

          {/* Reaction Picker */}
          <ReactionPicker
            targetType="post"
            targetId={post.id}
            userId={user.id}
            ownerId={post.user_id}
            supabase={supabase}
            reactions={reactions}
            onReactionsChange={onReactionsChange}
          />

          {/* Comment Button - Opens Modal */}
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
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
          >
            <span style={{ fontSize: 16 }}>💬</span>
            {commentCount === 0
              ? "Comment"
              : `${commentCount} comment${commentCount !== 1 ? "s" : ""}`}
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
          originalPosterName={
            post.users?.display_name || 
            post.users?.username || 
            "Unknown"
          }
          supabase={supabase}
          userId={user.id}
          onClose={() => setShowShareModal(false)}
          onShared={onCommentAdded}
        />
      )}
    </article>
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
    // Add text before the quote
    if (match.index > lastIndex) {
      parts.push(<span key={keyIndex++}>{text.substring(lastIndex, match.index)}</span>);
    }
    
    // Add the quoted text as italicized with quotation marks
    const quotedText = match[1];
    parts.push(
      <span key={keyIndex++} style={{ fontStyle: "italic" }}>
        "{quotedText}"
      </span>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last quote
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
