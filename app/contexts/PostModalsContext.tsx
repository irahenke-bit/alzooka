"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

const MAX_MODALS = 4;

export interface ModalWindow {
  id: string;
  postId: string;
  zIndex: number;
  position: { x: number; y: number } | null;
  size: { width: number; height: number } | null;
}

interface PostModalsContextType {
  openModals: ModalWindow[];
  highestZIndex: number;
  openModal: (postId: string) => boolean; // returns false if at max
  closeModal: (id: string) => void;
  bringToFront: (id: string) => void;
  updateModalPosition: (id: string, position: { x: number; y: number }) => void;
  updateModalSize: (id: string, size: { width: number; height: number }) => void;
  isAtMaxModals: boolean;
  showMaxModalsMessage: boolean;
  dismissMaxModalsMessage: () => void;
  // Global see-through mode - applies to ALL windows
  seeThroughMode: boolean;
  toggleSeeThroughMode: () => void;
}

const PostModalsContext = createContext<PostModalsContextType | null>(null);

export function PostModalsProvider({ children }: { children: React.ReactNode }) {
  const [openModals, setOpenModals] = useState<ModalWindow[]>([]);
  const [highestZIndex, setHighestZIndex] = useState(10000);
  const [showMaxModalsMessage, setShowMaxModalsMessage] = useState(false);
  // Global see-through mode - when true, all modals show transparent backgrounds
  const [seeThroughMode, setSeeThroughMode] = useState(false);

  const openModal = useCallback((postId: string): boolean => {
    // Check if this post is already open
    const existingModal = openModals.find(m => m.postId === postId);
    if (existingModal) {
      // Bring existing modal to front instead of opening new one
      setOpenModals(prev => prev.map(m => 
        m.id === existingModal.id 
          ? { ...m, zIndex: highestZIndex + 1 }
          : m
      ));
      setHighestZIndex(prev => prev + 1);
      return true;
    }

    // Check if at max
    if (openModals.length >= MAX_MODALS) {
      setShowMaxModalsMessage(true);
      return false;
    }

    // Create new modal with offset position based on how many are open
    const offset = openModals.length * 30;
    const newModal: ModalWindow = {
      id: `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      postId,
      zIndex: highestZIndex + 1,
      position: offset > 0 ? { x: offset, y: offset } : null,
      size: null,
    };

    setOpenModals(prev => [...prev, newModal]);
    setHighestZIndex(prev => prev + 1);
    return true;
  }, [openModals, highestZIndex]);

  const closeModal = useCallback((id: string) => {
    setOpenModals(prev => prev.filter(m => m.id !== id));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setOpenModals(prev => prev.map(m => 
      m.id === id 
        ? { ...m, zIndex: highestZIndex + 1 }
        : m
    ));
    setHighestZIndex(prev => prev + 1);
  }, [highestZIndex]);

  const updateModalPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setOpenModals(prev => prev.map(m => 
      m.id === id ? { ...m, position } : m
    ));
  }, []);

  const updateModalSize = useCallback((id: string, size: { width: number; height: number }) => {
    setOpenModals(prev => prev.map(m => 
      m.id === id ? { ...m, size } : m
    ));
  }, []);

  const dismissMaxModalsMessage = useCallback(() => {
    setShowMaxModalsMessage(false);
  }, []);

  const toggleSeeThroughMode = useCallback(() => {
    setSeeThroughMode(prev => !prev);
  }, []);

  const value = {
    openModals,
    highestZIndex,
    openModal,
    closeModal,
    bringToFront,
    updateModalPosition,
    updateModalSize,
    isAtMaxModals: openModals.length >= MAX_MODALS,
    showMaxModalsMessage,
    dismissMaxModalsMessage,
    seeThroughMode,
    toggleSeeThroughMode,
  };

  return (
    <PostModalsContext.Provider value={value}>
      {children}
      
      {/* Max modals message overlay */}
      {showMaxModalsMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            zIndex: highestZIndex + 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={dismissMaxModalsMessage}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--alzooka-teal-light)",
              borderRadius: 12,
              padding: "24px 32px",
              maxWidth: 400,
              textAlign: "center",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(201, 162, 39, 0.3)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📑</div>
            <h3 style={{ 
              margin: "0 0 12px 0", 
              color: "var(--alzooka-cream)",
              fontSize: 18,
            }}>
              Too Many Windows Open
            </h3>
            <p style={{ 
              margin: "0 0 20px 0", 
              color: "var(--alzooka-cream)", 
              opacity: 0.8,
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              You have {MAX_MODALS} post windows open. Please close one before opening another.
            </p>
            <button
              onClick={dismissMaxModalsMessage}
              style={{
                background: "var(--alzooka-gold)",
                color: "var(--alzooka-teal-dark)",
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </PostModalsContext.Provider>
  );
}

export function usePostModals() {
  const context = useContext(PostModalsContext);
  if (!context) {
    throw new Error("usePostModals must be used within a PostModalsProvider");
  }
  return context;
}

