"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

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
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
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
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Bell Button */}
      <button
        onClick={() => {
          const wasOpen = isOpen;
          setIsOpen(!isOpen);
          // Mark all as read when opening the dropdown
          if (!wasOpen && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--alzooka-cream)",
          fontSize: 20,
          cursor: "pointer",
          position: "relative",
          padding: "4px 8px",
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "#e53935",
              color: "#fff",
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
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            background: "var(--alzooka-teal-light)",
            border: "1px solid rgba(240, 235, 224, 0.2)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 1000,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(240, 235, 224, 0.1)",
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
                  color: "var(--alzooka-gold)",
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
                    : "rgba(212, 168, 75, 0.1)",
                  cursor: notification.link ? "pointer" : "default",
                }}
              >
                {notification.link ? (
                  <Link
                    href={notification.link}
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
              opacity: 0.7,
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
            background: "var(--alzooka-gold)",
            flexShrink: 0,
            marginTop: 4,
          }}
        />
      )}
    </div>
  );
}

