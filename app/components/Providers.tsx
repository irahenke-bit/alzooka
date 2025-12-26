"use client";

import { MiniPlayerProvider } from "@/app/contexts/MiniPlayerContext";
import MiniPlayer from "@/app/components/MiniPlayer";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniPlayerProvider>
      {children}
      <MiniPlayer />
    </MiniPlayerProvider>
  );
}
