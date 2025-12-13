"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Logo } from "@/app/components/Logo";
import { NotificationBell } from "@/app/components/NotificationBell";
import { UserSearch } from "@/app/components/UserSearch";
import { PostModal } from "@/app/components/PostModal";
import { ShareModal } from "@/app/components/ShareModal";
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
  video_url: string | null;
  wall_user_id: string | null;
  wall_user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
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

function FeedContent() {
  const [user, setUser] = useState<User | null>(null);
  const [userUsername, setUserUsername] = useState<string>("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [allowWallPosts, setAllowWallPosts] = useState<boolean>(true);
  const [wallFriendsOnly, setWallFriendsOnly] = useState<boolean>(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [youtubePreview, setYoutubePreview] = useState<{videoId: string; url: string; title: string; playlistId?: string; playlistTitle?: string} | null>(null);
  const [loadingYoutubePreview, setLoadingYoutubePreview] = useState(false);
  const [spotifyPreview, setSpotifyPreview] = useState<{url: string; title: string; thumbnail: string; type: string} | null>(null);
  const [loadingSpotifyPreview, setLoadingSpotifyPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [modalPost, setModalPost] = useState<Post | null>(null);
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
      
      // Fetch current user's username and avatar from the users table
      const { data: userData } = await supabase
        .from("users")
        .select("username, avatar_url, allow_wall_posts, wall_friends_only")
        .eq("id", user.id)
        .single();
      
      if (!userData) {
        // User is authenticated but has no profile - redirect to no-profile page
        router.push(`/auth/no-profile?email=${encodeURIComponent(user.email || "")}`);
        return;
      }
      
      setUserUsername(userData.username);
      setUserAvatarUrl(userData.avatar_url);
      setAllowWallPosts(userData.allow_wall_posts ?? true);
      setWallFriendsOnly(userData.wall_friends_only ?? true);
      
      // eslint-disable-next-line react-hooks/immutability
      const loadedPosts = await loadPosts();
      // eslint-disable-next-line react-hooks/immutability
      await loadUserVotes(user.id);
      // eslint-disable-next-line react-hooks/immutability
      await loadVoteTotals(loadedPosts);
      setLoading(false);

      // Fallback: poll periodically in case realtime misses an event (every 15s)
      pollInterval = setInterval(async () => {
        try {
          const refreshedPosts = await loadPosts();
          await loadUserVotes(user.id);
          await loadVoteTotals(refreshedPosts);
        } catch (err) {
          console.error("Error in poll interval:", err);
        }
      }, 15000);

      // Also refresh when the tab becomes visible again
      visibilityHandler = async () => {
        try {
          if (document.visibilityState === "visible") {
            const refreshedPosts = await loadPosts();
            await loadUserVotes(user.id);
            await loadVoteTotals(refreshedPosts);
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

              // Fetch the full post with user data
              const { data: newPost } = await supabase
                .from("posts")
                .select(`
                  id,
                  content,
                  image_url,
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
                    parent_comment_id,
                    users!comments_user_id_fkey (
                      username,
                      display_name,
                      avatar_url
                    )
                  )
                `)
                .eq("id", payload.new.id)
                .single();

              if (newPost) {
                // Process comments recursively (handles replies to replies)
                const allComments = (newPost.comments || []) as unknown as Comment[];
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

                // Load vote totals for the new post using the fresh list
                await loadVoteTotals(updatedPosts);
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
              const { data: newComment } = await supabase
                .from("comments")
                .select(`
                  id,
                  content,
                  created_at,
                  user_id,
                  post_id,
                  parent_comment_id,
                  users!comments_user_id_fkey (
                    username,
                    display_name,
                    avatar_url
                  )
                `)
                .eq("id", payload.new.id)
                .single();

              if (newComment) {
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

                // Also update modal if it's showing this post
                setModalPost(currentModal => {
                  if (!currentModal || currentModal.id !== postId) return currentModal;
                  
                  // Check if comment already exists (prevent duplicates)
                  const commentExists = (comments: Comment[]): boolean => {
                    for (const c of comments) {
                      if (c.id === commentId) return true;
                      if (c.replies && commentExists(c.replies)) return true;
                    }
                    return false;
                  };
                  if (commentExists(currentModal.comments || [])) return currentModal;
                  
                  const typedComment = newComment as unknown as Comment;
                  
                  if (typedComment.parent_comment_id) {
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
                    return { ...currentModal, comments: addReplyToParent(currentModal.comments || []) };
                  } else {
                    return { ...currentModal, comments: [...(currentModal.comments || []), typedComment] };
                  }
                });
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
              parent_comment_id,
              users!comments_user_id_fkey (
                username,
                display_name,
                avatar_url
              )
            )
          `)
          .eq("id", highlightPostId)
          .single();
          
        if (postsData) {
          // Process comments recursively (handles replies to replies)
          const allComments = (postsData.comments || []) as unknown as Comment[];
          const commentsWithReplies = buildCommentTreeRecursive(allComments);
          
          setModalPost({
            ...postsData,
            comments: commentsWithReplies
          } as unknown as Post);
        }
      } else if (highlightPostId) {
        setTimeout(() => {
          const element = document.getElementById(`post-${highlightPostId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
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

  // Global escape key handler as a failsafe to close any stuck modal
  useEffect(() => {
    function handleGlobalEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModalPost(null);
      }
    }
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, []);

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
              parent_comment_id,
              users!comments_user_id_fkey (
                username,
                display_name,
                avatar_url
              )
            )
          `)
          .eq("id", highlightPostId)
          .single();

        if (postsData) {
          const allComments = (postsData.comments || []) as unknown as Comment[];
          const commentsWithReplies = buildCommentTreeRecursive(allComments);

          setModalPost({
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
        }
      }
    }
    
    openModalForComment();
  }, [highlightCommentId, highlightPostId, notificationTimestamp, loading]);

  async function loadPosts(): Promise<Post[]> {
    const { data, error } = await supabase
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
      .is("group_id", null)  // Only show feed posts, not group posts
      .order("created_at", { ascending: false });

    // Fetch original posts for shared posts
    const sharedPostIds = (data || [])
      .filter((p: { shared_from_post_id?: string | null }) => p.shared_from_post_id)
      .map((p: { shared_from_post_id: string }) => p.shared_from_post_id);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sharedPostsMap: Record<string, any> = {};
    
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
    const postsWithNestedComments: Post[] = (data || []).map((post: any) => {
      const allComments = (post.comments || []) as Comment[];
      const commentsWithReplies = buildCommentTreeRecursive(allComments);
      
      // Get shared post info if this is a shared post
      const sharedFrom = post.shared_from_post_id ? sharedPostsMap[post.shared_from_post_id] : null;
      
      return {
        ...post,
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

    setPosts(postsWithNestedComments);
    return postsWithNestedComments;
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
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        }
      }
    }
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    // Allow posting if there's content, image, YouTube video, or Spotify
    if ((!content.trim() && !selectedImage && !youtubePreview && !spotifyPreview) || !user) return;

    setPosting(true);

    let imageUrl: string | null = null;

    // Upload image if selected
    if (selectedImage) {
      const fileExt = selectedImage.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, selectedImage, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Failed to upload image. Please try again.");
        setPosting(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

      imageUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        content: content.trim(),
        image_url: imageUrl,
        video_url: youtubePreview?.url || spotifyPreview?.url || null,
        user_id: user.id,
        wall_user_id: highlightPostId ? null : null, // feed posts only here
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
      setSelectedImage(null);
      setImagePreview(null);
      setYoutubePreview(null);
      setSpotifyPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      const refreshedPosts = await loadPosts();
      await loadUserVotes(user.id);
      await loadVoteTotals(refreshedPosts);
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
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 400, color: "var(--alzooka-cream)" }}>
            Alzooka
          </h1>
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
        {user && userUsername && (
          <Link 
            href={`/profile/${userUsername}?showFriends=true`}
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
            <span style={{ fontSize: 18 }}>🧑‍🤝‍🧑</span>
            <span style={{ fontSize: 10, letterSpacing: 0.5 }}>Friends</span>
          </Link>
        )}
        {user && (
          <NotificationBell userId={user.id} currentUsername={userUsername} />
        )}
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
          onClick={handleLogout}
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

      {/* New Post Form */}
      <form onSubmit={handlePost} style={{ marginBottom: 32 }}>
        <textarea
          placeholder="What's on your mind? Paste a YouTube or Spotify link to share..."
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          rows={3}
          style={{ marginBottom: 12, resize: "vertical" }}
        />
        
        {/* Image Preview */}
        {imagePreview && (
          <div style={{ position: "relative", marginBottom: 12, display: "inline-block" }}>
            <img 
              src={imagePreview} 
              alt="Preview" 
              style={{ 
                maxWidth: "100%", 
                maxHeight: 200, 
                borderRadius: 8,
                border: "1px solid rgba(240, 235, 224, 0.2)"
              }} 
            />
            <button
              type="button"
              onClick={removeSelectedImage}
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

        {/* Hidden file input */}
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
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📷 Photo
          </button>
          <button type="submit" disabled={posting || (!content.trim() && !selectedImage && !youtubePreview && !spotifyPreview)}>
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>

      {/* Posts Feed */}
      <div>
        {posts.length === 0 ? (
          <p className="text-muted" style={{ textAlign: "center", padding: 40 }}>
            No posts yet. Be the first to share something.
          </p>
        ) : (
          posts.map((post) => (
            <PostCard 
              key={post.id} 
              post={post} 
              user={user!} 
              supabase={supabase}
              votes={votes}
              voteTotals={voteTotals}
              onVote={handleVote}
              isHighlighted={post.id === highlightPostId}
              onOpenModal={() => setModalPost(post)}
              onCommentAdded={async () => {
                const refreshedPosts = await loadPosts();
                await loadUserVotes(user!.id);
                await loadVoteTotals(refreshedPosts);
              }}
            />
          ))
        )}
      </div>

      {/* Post Modal */}
      {modalPost && user && (
        <PostModal
          post={modalPost}
          user={user}
          supabase={supabase}
          votes={votes}
          voteTotals={voteTotals}
          onVote={handleVote}
          highlightCommentId={highlightCommentId}
          onClose={() => setModalPost(null)}
          onCommentAdded={(newComment) => {
            if (newComment && modalPost) {
              // Optimistically add the new comment to state immediately
              setModalPost(prev => {
                if (!prev) return prev;
                
                const updatedComments = [...(prev.comments || [])];
                
                if (newComment.parent_comment_id) {
                  // It's a reply - find the parent and add to its replies
                  const addReplyToParent = (comments: Comment[]): Comment[] => {
                    return comments.map(c => {
                      if (c.id === newComment.parent_comment_id) {
                        return {
                          ...c,
                          replies: [...(c.replies || []), newComment]
                        };
                      }
                      if (c.replies && c.replies.length > 0) {
                        return {
                          ...c,
                          replies: addReplyToParent(c.replies)
                        };
                      }
                      return c;
                    });
                  };
                  return {
                    ...prev,
                    comments: addReplyToParent(updatedComments)
                  };
                } else {
                  // It's a top-level comment - add to the end
                  return {
                    ...prev,
                    comments: [...updatedComments, newComment]
                  };
                }
              });
            }

            // Also update the main posts list in the background
            loadPosts().then(async (refreshedPosts) => {
              await loadUserVotes(user.id);
              await loadVoteTotals(refreshedPosts);
            });
          }}
        />
      )}
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
  onCommentAdded 
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
                // If there's a video, strip the YouTube or Spotify URL from displayed content
                let displayContent = post.content;
                const videoUrl = post.video_url;
                if (videoUrl && displayContent) {
                  // Remove YouTube and Spotify URLs from content
                  displayContent = displayContent
                    .replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[^\s]+/gi, '')
                    .replace(/https?:\/\/open\.spotify\.com\/(?:track|album|playlist|episode|show)\/[^\s]+/gi, '')
                    .trim();
                }
                return displayContent ? (
                  <p style={{ margin: "0 0 16px 0", lineHeight: 1.6 }}>{displayContent}</p>
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
          
          {/* Post Image */}
          {(post.shared_from_post?.image_url || post.image_url) && (
            <div style={{ marginBottom: 16 }}>
              <img 
                src={post.shared_from_post?.image_url || post.image_url || ""} 
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
          )}

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
