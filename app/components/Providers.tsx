"use client";

import { Suspense } from "react";
import { MiniPlayerProvider } from "@/app/contexts/MiniPlayerContext";
import { PostModalsProvider } from "@/app/contexts/PostModalsContext";
import MiniPlayer from "@/app/components/MiniPlayer";
import GlobalModalsRenderer from "@/app/components/GlobalModalsRenderer";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniPlayerProvider>
      <PostModalsProvider>
        {children}
        <MiniPlayer />
        {/* Global modals renderer - persists across page navigation */}
        <Suspense fallback={null}>
          <GlobalModalsRenderer />
        </Suspense>
      </PostModalsProvider>
    </MiniPlayerProvider>
  );
}
