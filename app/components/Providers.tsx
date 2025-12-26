"use client";

import { SpotifyPlayerProvider } from "@/app/contexts/SpotifyPlayerContext";
import MiniPlayer from "@/app/components/MiniPlayer";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SpotifyPlayerProvider>
      {children}
      <MiniPlayer />
    </SpotifyPlayerProvider>
  );
}

