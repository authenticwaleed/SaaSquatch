import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaSquatch Signal",
  description:
    "Ranks SaaSquatch leads by acquisition fit and post-acquisition AI-readiness upside.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
