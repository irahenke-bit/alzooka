import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alzooka — Community Without Clutter",
  description: "A social platform built for real human interaction, not algorithms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
