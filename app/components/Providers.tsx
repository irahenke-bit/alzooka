"use client";

import { MiniPlayerProvider } from "@/app/contexts/MiniPlayerContext";
import { PostModalsProvider } from "@/app/contexts/PostModalsContext";
import MiniPlayer from "@/app/components/MiniPlayer";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniPlayerProvider>
      <PostModalsProvider>
        {children}
        <MiniPlayer />
      </PostModalsProvider>
    </MiniPlayerProvider>
  );
}
