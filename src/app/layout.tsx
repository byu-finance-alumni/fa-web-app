import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Render every route per-request (#30). The nonce-based CSP set in middleware
// changes each request, so a statically-prerendered page's inline scripts would
// carry no nonce and be blocked by the CSP. Forcing dynamic rendering at the
// root makes Next.js apply the per-request nonce to its injected scripts on
// every page (login, landing, privacy included). Cost is negligible — the app is
// authenticated and already mostly dynamic.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BYU Finance Alumni Database",
  description:
    "Internal CRM and relationship management system for the BYU Finance program.",
};

export const viewport: Viewport = {
  themeColor: "#1C2E54",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "only light" }}>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
