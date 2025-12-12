import { SupabaseClient } from "@supabase/supabase-js";

// Vote milestones for upvotes
const UPVOTE_MILESTONES = [10, 50, 100, 200, 300, 500, 1000];
// After 1000, notify every 1000
const UPVOTE_REPEAT_INTERVAL = 1000;

// Vote milestones for downvotes
const DOWNVOTE_MILESTONES = [20, 100];

type NotificationParams = {
  supabase: SupabaseClient;
  userId: string;
  type: string;
  title: string;
  content?: string;
  link?: string;
  relatedUserId?: string;
  relatedPostId?: string;
  relatedCommentId?: string;
};

export async function createNotification({
  supabase,
  userId,
  type,
  title,
  content,
  link,
  relatedUserId,
  relatedPostId,
  relatedCommentId,
}: NotificationParams) {
  // Don't notify yourself
  if (relatedUserId && relatedUserId === userId) return;

  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    content,
    link,
    related_user_id: relatedUserId,
    related_post_id: relatedPostId,
    related_comment_id: relatedCommentId,
  });
}

// Notify when someone comments on your post
export async function notifyNewComment(
  supabase: SupabaseClient,
  postOwnerId: string,
  commenterUsername: string,
  postId: string,
  commentId: string,
  commentPreview: string
) {
  await createNotification({
    supabase,
    userId: postOwnerId,
    type: "comment",
    title: `@${commenterUsername} commented on your post`,
    content: commentPreview.slice(0, 100),
    link: `/?post=${postId}&comment=${commentId}`,
    relatedPostId: postId,
    relatedCommentId: commentId,
  });
}

// Notify when someone replies to your comment
export async function notifyNewReply(
  supabase: SupabaseClient,
  commentOwnerId: string,
  replierUsername: string,
  postId: string,
  commentId: string,
  replyPreview: string
) {
  await createNotification({
    supabase,
    userId: commentOwnerId,
    type: "reply",
    title: `@${replierUsername} replied to your comment`,
    content: replyPreview.slice(0, 100),
    link: `/?post=${postId}&comment=${commentId}`,
    relatedPostId: postId,
    relatedCommentId: commentId,
  });
}

// Notify when someone mentions you
export async function notifyMention(
  supabase: SupabaseClient,
  mentionedUserId: string,
  mentionerUsername: string,
  postId: string,
  commentId: string,
  commentPreview: string
) {
  await createNotification({
    supabase,
    userId: mentionedUserId,
    type: "mention",
    title: `@${mentionerUsername} mentioned you`,
    content: commentPreview.slice(0, 100),
    link: `/?post=${postId}&comment=${commentId}`,
    relatedPostId: postId,
    relatedCommentId: commentId,
  });
}

// Check and notify for vote milestones
export async function checkVoteMilestones(
  supabase: SupabaseClient,
  userId: string,
  targetType: "post" | "comment",
  targetId: string,
  currentTotal: number,
  previousTotal: number
) {
  // Check upvote milestones
  for (const milestone of UPVOTE_MILESTONES) {
    if (previousTotal < milestone && currentTotal >= milestone) {
      await createNotification({
        supabase,
        userId,
        type: "upvote_milestone",
        title: `🎉 Your ${targetType} reached ${milestone} upvotes!`,
        content: "Keep up the great contributions!",
        link: targetType === "post" ? `/?post=${targetId}` : undefined,
      });
      return; // Only one milestone notification at a time
    }
  }

  // Check for milestones above 1000 (every 1000)
  if (currentTotal >= 1000) {
    const prevThousand = Math.floor(previousTotal / UPVOTE_REPEAT_INTERVAL);
    const currThousand = Math.floor(currentTotal / UPVOTE_REPEAT_INTERVAL);
    
    if (currThousand > prevThousand && currThousand >= 1) {
      const milestone = currThousand * UPVOTE_REPEAT_INTERVAL;
      await createNotification({
        supabase,
        userId,
        type: "upvote_milestone",
        title: `🎉 Your ${targetType} reached ${milestone} upvotes!`,
        content: "Incredible! Your content is resonating with the community.",
        link: targetType === "post" ? `/?post=${targetId}` : undefined,
      });
    }
  }

  // Check downvote milestones (negative values)
  const downvotes = Math.abs(Math.min(0, currentTotal));
  const prevDownvotes = Math.abs(Math.min(0, previousTotal));
  
  for (const milestone of DOWNVOTE_MILESTONES) {
    if (prevDownvotes < milestone && downvotes >= milestone) {
      await createNotification({
        supabase,
        userId,
        type: "downvote_milestone",
        title: `Your ${targetType} received ${milestone} downvotes`,
        content: "Consider reviewing your content.",
        link: targetType === "post" ? `/?post=${targetId}` : undefined,
      });
      return;
    }
  }
}

// Notify when someone sends a friend request
export async function notifyFriendRequest(
  supabase: SupabaseClient,
  recipientId: string,
  senderUsername: string,
  senderId: string
) {
  await createNotification({
    supabase,
    userId: recipientId,
    type: "friend_request",
    title: `@${senderUsername} sent you a friend request`,
    content: "Accept or decline this request",
    link: `/profile/${encodeURIComponent(senderUsername)}`,
    relatedUserId: senderId,
  });
}

// Notify when someone accepts your friend request
export async function notifyFriendRequestAccepted(
  supabase: SupabaseClient,
  requesterId: string,
  accepterUsername: string,
  accepterId: string
) {
  await createNotification({
    supabase,
    userId: requesterId,
    type: "friend_accepted",
    title: `@${accepterUsername} accepted your friend request`,
    content: "You are now friends!",
    link: `/profile/${encodeURIComponent(accepterUsername)}`,
    relatedUserId: accepterId,
  });
}

// Notify when someone posts on your wall
export async function notifyWallPost(
  supabase: SupabaseClient,
  wallOwnerId: string,
  posterUsername: string,
  postId: string,
  contentPreview: string
) {
  await createNotification({
    supabase,
    userId: wallOwnerId,
    type: "wall_post",
    title: `@${posterUsername} posted on your wall`,
    content: contentPreview.slice(0, 100),
    link: `/?post=${postId}`,
    relatedPostId: postId,
  });
}

// Notify when someone invites you to a group
export async function notifyGroupInvite(
  supabase: SupabaseClient,
  invitedUserId: string,
  inviterUsername: string,
  groupId: string,
  groupName: string
) {
  await createNotification({
    supabase,
    userId: invitedUserId,
    type: "group_invite",
    title: `@${inviterUsername} invited you to join ${groupName}`,
    content: "Click to view the group and accept or decline",
    link: `/groups/${groupId}`,
  });
}

// Parse @mentions from text
export function parseMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

// Get user IDs from usernames
export async function getUserIdsByUsernames(
  supabase: SupabaseClient,
  usernames: string[]
): Promise<Record<string, string>> {
  if (usernames.length === 0) return {};

  const { data } = await supabase
    .from("users")
    .select("id, username")
    .in("username", usernames);

  if (!data) return {};

  const result: Record<string, string> = {};
  data.forEach((user) => {
    result[user.username.toLowerCase()] = user.id;
  });
  return result;
}

