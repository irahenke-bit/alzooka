import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import Providers from "@/app/components/Providers";

// Bold, distinctive display font for headings
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

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
    <html lang="en" className={syne.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
