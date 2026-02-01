"use client";

import { useState, useEffect, useCallback } from "react";
import { usePostModals } from "@/app/contexts/PostModalsContext";
import { PostModal } from "@/app/components/PostModal";
import { Reaction } from "@/app/components/ReactionPicker";
import { createBrowserClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";

// Types
type CommentEditHistoryEntry = {
  content: string;
  edited_at: string;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  edit_history?: CommentEditHistoryEntry[];
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
};

type Vote = {
  id: string;
  user_id: string;
  value: number;
};

// Reaction type is imported from ReactionPicker

// Helper function to build recursive comment tree
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

export default function GlobalModalsRenderer() {
  const postModals = usePostModals();
  const supabase = createBrowserClient();
  const searchParams = useSearchParams();
  const highlightCommentId = searchParams.get("comment");
  
  // User state
  const [user, setUser] = useState<User | null>(null);
  
  // Posts data keyed by postId
  const [postsData, setPostsData] = useState<Record<string, Post>>({});
  
  // Votes and reactions
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [voteTotals, setVoteTotals] = useState<Record<string, number>>({});
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  
  // Loading states
  const [loadingPosts, setLoadingPosts] = useState<Set<string>>(new Set());
  
  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    fetchUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => subscription.unsubscribe();
  }, [supabase]);
  
  // Fetch post data when new modals are opened
  useEffect(() => {
    if (!user) return;
    
    const postIdsToFetch = postModals.openModals
      .map(m => m.postId)
      .filter(postId => !postsData[postId] && !loadingPosts.has(postId));
    
    if (postIdsToFetch.length === 0) return;
    
    // Mark as loading
    setLoadingPosts(prev => new Set([...prev, ...postIdsToFetch]));
    
    async function fetchPosts() {
      console.log("GlobalModalsRenderer: Fetching posts with IDs:", postIdsToFetch);
      
      const { data, error } = await supabase
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
            edited_at,
            edit_history,
            user_id,
            parent_comment_id,
            users (
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .in("id", postIdsToFetch);
      
      console.log("GlobalModalsRenderer: Fetch result - data:", data, "error:", error);
      
      if (error) {
        console.error("Error fetching posts for modals:", error);
        setLoadingPosts(prev => {
          const next = new Set(prev);
          postIdsToFetch.forEach(id => next.delete(id));
          return next;
        });
        return;
      }
      
      if (data) {
        const newPostsData: Record<string, Post> = {};
        data.forEach(p => {
          // Transform comments to handle Supabase's array format for users
          const transformedComments = (p.comments || []).map((c: any) => ({
            ...c,
            users: Array.isArray(c.users) ? c.users[0] : c.users,
          }));
          const commentsWithReplies = buildCommentTreeRecursive(transformedComments as Comment[]);
          
          // Transform post user and wall_user
          const transformedPost = {
            ...p,
            users: Array.isArray(p.users) ? p.users[0] : p.users,
            wall_user: Array.isArray(p.wall_user) ? p.wall_user[0] : p.wall_user,
            comments: commentsWithReplies,
          };
          newPostsData[p.id] = transformedPost as Post;
        });
        
        setPostsData(prev => ({ ...prev, ...newPostsData }));
        
        // Load votes and reactions for these posts
        await loadVotesAndReactions(postIdsToFetch);
        
        // Clear loading state
        setLoadingPosts(prev => {
          const next = new Set(prev);
          postIdsToFetch.forEach(id => next.delete(id));
          return next;
        });
      }
    }
    
    fetchPosts();
  }, [postModals.openModals, postsData, loadingPosts, user, supabase]);
  
  // Load votes and reactions for posts
  const loadVotesAndReactions = useCallback(async (postIds: string[]) => {
    if (!user || postIds.length === 0) return;
    
    // Load user's votes
    const { data: userVotes } = await supabase
      .from("votes")
      .select("*")
      .eq("user_id", user.id)
      .in("post_id", postIds);
    
    if (userVotes) {
      const newVotes: Record<string, Vote> = {};
      userVotes.forEach(v => {
        newVotes[`post-${v.post_id}`] = v;
        if (v.comment_id) {
          newVotes[`comment-${v.comment_id}`] = v;
        }
      });
      setVotes(prev => ({ ...prev, ...newVotes }));
    }
    
    // Load vote totals
    const { data: voteTotalsData } = await supabase
      .from("posts")
      .select("id, vote_count")
      .in("id", postIds);
    
    if (voteTotalsData) {
      const newTotals: Record<string, number> = {};
      voteTotalsData.forEach(p => {
        newTotals[`post-${p.id}`] = p.vote_count;
      });
      setVoteTotals(prev => ({ ...prev, ...newTotals }));
    }
    
    // Load reactions
    const { data: reactionsData } = await supabase
      .from("reactions")
      .select(`
        id, user_id, post_id, reaction_type, created_at,
        users (username, display_name, avatar_url)
      `)
      .in("post_id", postIds);
    
    if (reactionsData) {
      const newReactions: Record<string, Reaction[]> = {};
      reactionsData.forEach(r => {
        if (r.post_id) {
          if (!newReactions[r.post_id]) {
            newReactions[r.post_id] = [];
          }
          newReactions[r.post_id].push({
            ...r,
            users: Array.isArray(r.users) ? r.users[0] : r.users,
          } as Reaction);
        }
      });
      setReactions(prev => ({ ...prev, ...newReactions }));
    }
  }, [user, supabase]);
  
  // Handle vote
  const handleVote = useCallback(async (type: "post" | "comment", id: string, value: number) => {
    if (!user) return;
    
    const { data, error } = await supabase.rpc("handle_vote", {
      item_id: id,
      vote_type: type,
      user_id: user.id,
      vote_value: value,
    });
    
    if (error) {
      console.error("Error voting:", error);
      return;
    }
    
    // Update UI optimistically
    setVotes(prev => ({
      ...prev,
      [`${type}-${id}`]: { id: "temp", user_id: user.id, value: data.new_vote_value },
    }));
    setVoteTotals(prev => ({
      ...prev,
      [`${type}-${id}`]: data.new_vote_count,
    }));
  }, [user, supabase]);
  
  // Handle reactions change
  const handleReactionsChange = useCallback((postId: string, newReactions: Reaction[]) => {
    setReactions(prev => ({
      ...prev,
      [postId]: newReactions,
    }));
  }, []);
  
  // Handle comment added/deleted/edited
  const handleCommentChange = useCallback((postId: string, newComment?: Comment, deletedCommentId?: string, editedComment?: { id: string; content: string; edited_at?: string; edit_history?: CommentEditHistoryEntry[] }) => {
    setPostsData(prev => {
      const post = prev[postId];
      if (!post) return prev;
      
      let updatedComments = [...(post.comments || [])];
      
      if (newComment) {
        // Check if comment already exists
        const commentExists = (comments: Comment[]): boolean => {
          for (const c of comments) {
            if (c.id === newComment.id) return true;
            if (c.replies && commentExists(c.replies)) return true;
          }
          return false;
        };
        
        if (commentExists(updatedComments)) return prev;
        
        if (newComment.parent_comment_id) {
          // Add reply to parent
          const addReplyToParent = (comments: Comment[]): Comment[] => {
            return comments.map(c => {
              if (c.id === newComment.parent_comment_id) {
                return {
                  ...c,
                  replies: [...(c.replies || []), newComment]
                };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: addReplyToParent(c.replies) };
              }
              return c;
            });
          };
          updatedComments = addReplyToParent(updatedComments);
        } else {
          updatedComments = [...updatedComments, newComment];
        }
      }
      
      if (deletedCommentId) {
        const removeComment = (comments: Comment[]): Comment[] => {
          return comments
            .filter(c => c.id !== deletedCommentId)
            .map(c => ({
              ...c,
              replies: c.replies ? removeComment(c.replies) : []
            }));
        };
        updatedComments = removeComment(updatedComments);
      }
      
      // Handle edited comment - update the content, edited_at, and edit_history in place
      if (editedComment) {
        const updateCommentContent = (comments: Comment[]): Comment[] => {
          return comments.map(c => {
            if (c.id === editedComment.id) {
              return { 
                ...c, 
                content: editedComment.content,
                edited_at: editedComment.edited_at,
                edit_history: editedComment.edit_history,
              };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: updateCommentContent(c.replies) };
            }
            return c;
          });
        };
        updatedComments = updateCommentContent(updatedComments);
      }
      
      return {
        ...prev,
        [postId]: { ...post, comments: updatedComments },
      };
    });
  }, []);
  
  // Close modal handler
  const handleCloseModal = useCallback((modalId: string) => {
    postModals.closeModal(modalId);
  }, [postModals]);
  
  // Global escape key handler - closes the topmost modal
  useEffect(() => {
    function handleGlobalEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && postModals.openModals.length > 0) {
        // Close the topmost modal (highest zIndex)
        const topModal = [...postModals.openModals].sort((a, b) => b.zIndex - a.zIndex)[0];
        if (topModal) {
          postModals.closeModal(topModal.id);
        }
      }
    }
    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [postModals]);
  
  // Don't render anything if no modals
  if (postModals.openModals.length === 0) {
    return null;
  }
  
  // Show loading if user not loaded yet but modals are open
  if (!user) {
    return (
      <div style={{
        position: "fixed",
        bottom: 100,
        right: 20,
        background: "var(--accent)",
        color: "black",
        padding: "8px 16px",
        borderRadius: 8,
        zIndex: 99999,
        fontSize: 14,
      }}>
        Loading modal...
      </div>
    );
  }
  
  // Calculate max zIndex for determining top modal
  const maxZIndex = Math.max(...postModals.openModals.map(m => m.zIndex));
  
  return (
    <>
      {postModals.openModals.map((modalWindow, index) => {
        const post = postsData[modalWindow.postId];
        
        // Show loading if post data not loaded yet
        if (!post) {
          return (
            <div
              key={modalWindow.id}
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                background: "var(--bg-elevated)",
                padding: "40px 60px",
                borderRadius: 12,
                zIndex: modalWindow.zIndex,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
              <div style={{ color: "#ffffff" }}>Loading post...</div>
            </div>
          );
        }
        
        const isTopModal = modalWindow.zIndex === maxZIndex;
        
        return (
          <PostModal
            key={modalWindow.id}
            post={post}
            user={user}
            supabase={supabase}
            votes={votes}
            voteTotals={voteTotals}
            onVote={handleVote}
            highlightCommentId={isTopModal ? highlightCommentId : null}
            onClose={() => handleCloseModal(modalWindow.id)}
            // Multi-window props
            modalId={modalWindow.id}
            initialPosition={modalWindow.position}
            initialSize={modalWindow.size}
            zIndex={modalWindow.zIndex}
            onBringToFront={() => postModals.bringToFront(modalWindow.id)}
            onPositionChange={(pos) => postModals.updateModalPosition(modalWindow.id, pos)}
            onSizeChange={(size) => postModals.updateModalSize(modalWindow.id, size)}
            hideBackdrop={!isTopModal}
            seeThroughMode={postModals.seeThroughMode}
            onToggleSeeThroughMode={postModals.toggleSeeThroughMode}
            onCommentAdded={(newComment, deletedCommentId, editedComment) => {
              handleCommentChange(post.id, newComment, deletedCommentId, editedComment);
            }}
            postReactions={reactions[post.id] || []}
            onPostReactionsChange={(newReactions) => handleReactionsChange(post.id, newReactions)}
          />
        );
      })}
    </>
  );
}

