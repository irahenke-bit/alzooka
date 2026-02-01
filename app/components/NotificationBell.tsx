"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { notifyFriendRequestAccepted } from "@/lib/notifications";

type Notification = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  related_user_id: string | null;
};

export function NotificationBell({ userId, currentUsername }: { userId: string; currentUsername?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();

    // Subscribe to new notifications
     
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          } catch (err) {
            console.error("Error in notifications subscription:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Mark all as read when closing (except friend requests)
        const nonFriendRequestUnread = notifications.filter(
          n => !n.is_read && n.type !== "friend_request"
        );
        if (nonFriendRequestUnread.length > 0) {
          nonFriendRequestUnread.forEach(n => markAsRead(n.id));
        }
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifications]);

  async function markAsRead(notificationId: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function markAllAsRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function handleFriendRequestResponse(notification: Notification, accept: boolean) {
    if (!notification.related_user_id) return;
    
    setRespondingTo(notification.id);
    
    if (accept) {
      // Accept the friend request
      await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("requester_id", notification.related_user_id)
        .eq("addressee_id", userId);
      
      // Notify the requester
      if (currentUsername) {
        await notifyFriendRequestAccepted(
          supabase,
          notification.related_user_id,
          currentUsername,
          userId
        );
      }
    } else {
      // Decline the friend request
      await supabase
        .from("friendships")
        .update({ status: "declined" })
        .eq("requester_id", notification.related_user_id)
        .eq("addressee_id", userId);
    }
    
    // Update the notification in the database to show it's been handled
    const newType = accept ? "friend_accepted" : "friend_declined";
    const newTitle = accept ? "You accepted this friend request" : "You declined this friend request";
    
    await supabase
      .from("notifications")
      .update({ 
        type: newType,
        title: newTitle,
        content: null,
        is_read: true 
      })
      .eq("id", notification.id);
    
    // Update local state to match
    setNotifications((prev) =>
      prev.map((n) => 
        n.id === notification.id 
          ? { 
              ...n, 
              type: newType,
              title: newTitle,
              content: null,
              is_read: true
            } 
          : n
      )
    );
    
    setRespondingTo(null);
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "comment":
        return "💬";
      case "reply":
        return "↩️";
      case "mention":
        return "@";
      case "upvote_milestone":
        return "🎉";
      case "downvote_milestone":
        return "📉";
      case "friend_request":
        return "👋";
      case "friend_accepted":
        return "🤝";
      case "friend_declined":
        return "❌";
      default:
        return "🔔";
    }
  }

  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString();
  }

  // Handle hover open with delay for closing
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleMouseEnter() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (!isOpen) {
      setIsOpen(true);
    }
  }

  function handleMouseLeave() {
    closeTimeoutRef.current = setTimeout(() => {
      // Mark all as read when closing (except friend requests)
      const nonFriendRequestUnread = notifications.filter(
        n => !n.is_read && n.type !== "friend_request"
      );
      if (nonFriendRequestUnread.length > 0) {
        nonFriendRequestUnread.forEach(n => markAsRead(n.id));
      }
      setIsOpen(false);
    }, 200);
  }

  return (
    <div 
      ref={dropdownRef} 
      style={{ position: "relative" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Bell Button - using div to avoid global button styling */}
      <div
        role="button"
        tabIndex={0}
        style={{
          background: isOpen ? "var(--border-subtle)" : "transparent",
          border: "none",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          transition: "all 0.2s",
          overflow: "visible",
        }}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="currentColor"
          style={{ 
            color: isOpen ? "#0165FC" : "rgba(255,255,255,0.5)", 
            transition: "color 0.2s" 
          }}
        >
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "#0165FC",
              color: "rgba(255,255,255,0.7)",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 340,
            maxHeight: 400,
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.6 }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.6 }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => {
                  // Don't auto-navigate for friend requests
                  if (notification.type === "friend_request") return;
                  if (!notification.is_read) markAsRead(notification.id);
                  if (notification.link) {
                    setIsOpen(false);
                  }
                }}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(240, 235, 224, 0.05)",
                  background: notification.is_read
                    ? "transparent"
                    : "rgba(1, 101, 252, 0.1)",
                  cursor: notification.link && notification.type !== "friend_request" ? "pointer" : "default",
                }}
              >
                {notification.type === "friend_request" ? (
                  <FriendRequestNotification
                    notification={notification}
                    getIcon={getNotificationIcon}
                    formatTime={formatTime}
                    onRespond={handleFriendRequestResponse}
                    isResponding={respondingTo === notification.id}
                  />
                ) : notification.link ? (
                  <Link
                    href={`${notification.link}${notification.link.includes('?') ? '&' : '?'}t=${Date.now()}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                    onClick={() => setIsOpen(false)}
                  >
                    <NotificationContent
                      notification={notification}
                      getIcon={getNotificationIcon}
                      formatTime={formatTime}
                    />
                  </Link>
                ) : (
                  <NotificationContent
                    notification={notification}
                    getIcon={getNotificationIcon}
                    formatTime={formatTime}
                  />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NotificationContent({
  notification,
  getIcon,
  formatTime,
}: {
  notification: Notification;
  getIcon: (type: string) => string;
  formatTime: (date: string) => string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 18 }}>{getIcon(notification.type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: notification.is_read ? 400 : 600,
            lineHeight: 1.4,
          }}
        >
          {notification.title}
        </p>
        {notification.content && (
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {notification.content}
          </p>
        )}
        <span style={{ fontSize: 11, opacity: 0.5 }}>
          {formatTime(notification.created_at)}
        </span>
      </div>
      {!notification.is_read && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
      )}
    </div>
  );
}

function FriendRequestNotification({
  notification,
  getIcon,
  formatTime,
  onRespond,
  isResponding,
}: {
  notification: Notification;
  getIcon: (type: string) => string;
  formatTime: (date: string) => string;
  onRespond: (notification: Notification, accept: boolean) => void;
  isResponding: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 18 }}>{getIcon(notification.type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: notification.is_read ? 400 : 600,
            lineHeight: 1.4,
          }}
        >
          {notification.title}
        </p>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginTop: 2 }}>
          {formatTime(notification.created_at)}
        </span>
        
        {/* Accept/Decline buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRespond(notification, true);
            }}
            disabled={isResponding}
            style={{
              padding: "6px 16px",
              background: "var(--accent)",
              color: "black",
              border: "none",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: isResponding ? "not-allowed" : "pointer",
              opacity: isResponding ? 0.6 : 1,
            }}
          >
            {isResponding ? "..." : "Accept"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRespond(notification, false);
            }}
            disabled={isResponding}
            style={{
              padding: "6px 16px",
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid var(--border-hover)",
              borderRadius: 4,
              fontSize: 12,
              cursor: isResponding ? "not-allowed" : "pointer",
              opacity: isResponding ? 0.6 : 1,
            }}
          >
            Decline
          </button>
          {notification.link && (
            <Link
              href={notification.link}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                fontSize: 12,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              View
            </Link>
          )}
        </div>
      </div>
      {!notification.is_read && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
      )}
    </div>
  );
}
