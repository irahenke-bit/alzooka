"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Logo } from "./Logo";
import { UserSearch } from "./UserSearch";
import { NotificationBell } from "./NotificationBell";

type HeaderProps = {
  user: { id: string } | null;
  userUsername: string | null;
  userAvatarUrl: string | null;
  searchComponent?: React.ReactNode; // Optional custom search (e.g., GroupPostSearch)
};

export default function Header({ user, userUsername, userAvatarUrl, searchComponent }: HeaderProps) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        padding: "16px 40px",
        borderBottom: "1px solid rgba(240, 235, 224, 0.15)",
      }}
    >
      {/* Logo - always links home */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
        }}
      >
        <Logo size={32} />
        <span
          style={{
            fontSize: 24,
            fontWeight: 400,
            color: "var(--alzooka-cream)",
          }}
        >
          Alzooka
        </span>
      </Link>

      {/* Search - custom or default */}
      {searchComponent || <UserSearch />}

      {/* Navigation Icons */}
      <nav style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Groups */}
        <Link
          href="/groups"
          title="Groups"
          style={{
            color: "var(--alzooka-cream)",
            textDecoration: "none",
            opacity: 0.8,
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.8";
            e.currentTarget.style.background = "transparent";
          }}
        >
          👥
        </Link>

        {/* Friends */}
        {user && userUsername && (
          <Link
            href={`/profile/${userUsername}?showFriends=true`}
            title="Friends"
            style={{
              color: "var(--alzooka-cream)",
              textDecoration: "none",
              opacity: 0.8,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.8";
              e.currentTarget.style.background = "transparent";
            }}
          >
            🧑‍🤝‍🧑
          </Link>
        )}

        {/* Notifications */}
        {user && userUsername && (
          <NotificationBell userId={user.id} currentUsername={userUsername} />
        )}

        {/* User Avatar with Dropdown */}
        {user && userUsername && (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              title="Menu"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt="Profile"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid var(--alzooka-gold)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "var(--alzooka-gold)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--alzooka-teal-dark)",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {(userUsername || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <span
                style={{
                  color: "var(--alzooka-cream)",
                  fontSize: 10,
                  opacity: 0.6,
                }}
              >
                ▼
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "var(--alzooka-teal-dark)",
                  border: "1px solid rgba(240, 235, 224, 0.2)",
                  borderRadius: 8,
                  padding: "8px 0",
                  minWidth: 160,
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                  zIndex: 1000,
                }}
              >
                <Link
                  href="/"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    color: "var(--alzooka-cream)",
                    textDecoration: "none",
                    fontSize: 14,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  🏠 My Feed
                </Link>
                <Link
                  href={`/profile/${userUsername}`}
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    color: "var(--alzooka-cream)",
                    textDecoration: "none",
                    fontSize: 14,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  👤 My Profile
                </Link>
                <div
                  style={{
                    height: 1,
                    background: "rgba(240, 235, 224, 0.1)",
                    margin: "4px 0",
                  }}
                />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleSignOut();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    color: "var(--alzooka-cream)",
                    textDecoration: "none",
                    fontSize: 14,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
