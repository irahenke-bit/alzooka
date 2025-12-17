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
      <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Groups */}
        <Link
          href="/groups"
          title="Groups"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: "50%",
            transition: "all 0.2s",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="3"/>
            <circle cx="17" cy="7" r="3"/>
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
            <path d="M17 11a4 4 0 0 1 4 4v2"/>
          </svg>
        </Link>

        {/* Friends */}
        {user && userUsername && (
          <Link
            href={`/profile/${userUsername}?showFriends=true`}
            title="Friends"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              transition: "all 0.2s",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(240, 235, 224, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
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
