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
  currentPage?: "feed" | "profile" | "group" | "other"; // For context-aware dropdown
  isOwnProfile?: boolean; // True when viewing your own profile
};

// Instant tooltip component
function InstantTooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }} className="instant-tooltip-wrapper">
      {children}
      <span className="instant-tooltip">{text}</span>
      <style>{`
        .instant-tooltip-wrapper .instant-tooltip {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.85);
          color: #fff;
          padding: 6px 10px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.1s, visibility 0.1s;
          pointer-events: none;
          z-index: 1001;
        }
        .instant-tooltip-wrapper:hover .instant-tooltip {
          opacity: 1;
          visibility: visible;
        }
      `}</style>
    </div>
  );
}

export default function Header({ user, userUsername, userAvatarUrl, searchComponent, currentPage = "other", isOwnProfile = false }: HeaderProps) {
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
        position: "sticky",
        top: 0,
        zIndex: 1000,
        backgroundColor: "#0a0a0a",
        opacity: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        padding: "16px 40px",
        borderBottom: "1px solid rgba(201, 162, 39, 0.3)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(201, 162, 39, 0.15)",
      }}
    >
      {/* Logo - always links home */}
      <Link
        href="/"
        prefetch={true}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
        }}
        className="logo-glow"
      >
        <Logo size={32} />
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--alzooka-cream)",
            textShadow: "0 0 10px rgba(201, 162, 39, 0.4), 0 0 20px rgba(201, 162, 39, 0.2)",
            transition: "text-shadow 0.3s ease",
          }}
        >
          Alzooka
        </span>
      </Link>
      <style>{`
        .logo-glow:hover span {
          text-shadow: 0 0 15px rgba(201, 162, 39, 0.7), 0 0 30px rgba(201, 162, 39, 0.4), 0 0 45px rgba(201, 162, 39, 0.2) !important;
        }
        .nav-icon-glow {
          transition: background 0.2s ease !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .nav-icon-glow:hover {
          background: rgba(240, 235, 224, 0.1) !important;
        }
        .nav-icon-glow:hover svg {
          filter: drop-shadow(0 0 6px rgba(201, 162, 39, 0.8));
        }
        .profile-avatar-wrapper {
          position: relative;
        }
        .profile-avatar-wrapper:hover {
          box-shadow: 0 0 15px rgba(201, 162, 39, 0.5), 0 0 30px rgba(201, 162, 39, 0.3);
        }
        .profile-avatar-wrapper:hover img {
          box-shadow: 0 0 12px rgba(201, 162, 39, 0.6);
        }
      `}</style>

      {/* Search - custom or default */}
      {searchComponent || <UserSearch />}

      {/* Navigation Icons */}
      <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Communities */}
        <InstantTooltip text="Communities">
          <Link
            href="/groups"
            prefetch={true}
            className="nav-icon-glow"
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a227">
              <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58A2.01 2.01 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
            </svg>
          </Link>
        </InstantTooltip>

        {/* My Station (Alzooka FM) */}
        {user && (
          <InstantTooltip text="My Station">
            <Link
              href="/station"
              className="nav-icon-glow"
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a227">
                <path d="M20 6H8.3l8.26-3.34L15.88 1 3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-8 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
              </svg>
            </Link>
          </InstantTooltip>
        )}

        {/* Game Hub (dev only) or Music Trivia (production) */}
        {user && process.env.NODE_ENV === "development" ? (
          <InstantTooltip text="Game Hub">
            <Link
              href="/game-hub"
              className="nav-icon-glow"
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a227">
                <path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0016.53 5H7.47a3.996 3.996 0 00-3.96 3.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19h.06c.83 0 1.58-.34 2.12-.88L8 17h8l.88 1.12c.54.54 1.29.88 2.12.88h.06c1.55 0 2.74-1.37 2.52-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
              </svg>
            </Link>
          </InstantTooltip>
        ) : user ? (
          <InstantTooltip text="Music Trivia">
            <Link
              href="/games"
              className="nav-icon-glow"
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a227">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </Link>
          </InstantTooltip>
        ) : null}

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
              background: "none",
              backgroundColor: "transparent",
              textDecoration: "none",
              border: "none",
              outline: "none",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a227">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </Link>
        )}

        {/* Notifications */}
        {user && userUsername && (
          <NotificationBell userId={user.id} currentUsername={userUsername} />
        )}

        {/* User Avatar with Dropdown */}
        {user && userUsername && (
          <ProfileDropdown
            menuRef={menuRef}
            showUserMenu={showUserMenu}
            setShowUserMenu={setShowUserMenu}
            userAvatarUrl={userAvatarUrl}
            userUsername={userUsername}
            currentPage={currentPage}
            isOwnProfile={isOwnProfile}
            handleSignOut={handleSignOut}
          />
        )}
      </nav>
    </header>
  );
}

// Separate component for profile dropdown with hover logic
function ProfileDropdown({
  menuRef,
  showUserMenu,
  setShowUserMenu,
  userAvatarUrl,
  userUsername,
  currentPage,
  isOwnProfile,
  handleSignOut,
}: {
  menuRef: React.RefObject<HTMLDivElement | null>;
  showUserMenu: boolean;
  setShowUserMenu: (show: boolean) => void;
  userAvatarUrl: string | null;
  userUsername: string;
  currentPage: string;
  isOwnProfile: boolean;
  handleSignOut: () => void;
}) {
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function handleMouseEnter() {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowUserMenu(true);
  }

  function handleMouseLeave() {
    closeTimeoutRef.current = setTimeout(() => {
      setShowUserMenu(false);
    }, 150);
  }

  return (
    <div 
      ref={menuRef} 
      style={{ position: "relative" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="profile-avatar-wrapper"
        style={{
          background: showUserMenu ? "rgba(240, 235, 224, 0.1)" : "transparent",
          border: "none",
          padding: 4,
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
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
              display: "block",
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
              color: "#050505",
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
      </div>

      {/* Dropdown Menu */}
      {showUserMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "#151515",
                  border: "1px solid rgba(240, 235, 224, 0.2)",
                  borderRadius: 8,
                  padding: "8px 0",
                  minWidth: 160,
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
                  zIndex: 1000,
                }}
              >
              {currentPage !== "feed" && (
                <Link
                  href="/"
                  prefetch={true}
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
              )}
              {!(currentPage === "profile" && isOwnProfile) && (
                <Link
                  href={`/profile/${userUsername}`}
                  prefetch={true}
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
              )}
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
  );
}
