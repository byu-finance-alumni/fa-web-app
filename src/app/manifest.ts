import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest). Makes the app installable as a
 * standalone, native-feeling experience per UX-UI.md (Mobile experience).
 *
 * NOTE: proper square maskable icons (192/512 PNG) are still a pending design
 * asset (see the logo to-do in UX-UI.md). Until then this references the existing
 * navy logo so installs aren't icon-less; swap in real maskable icons when ready.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BYU Finance Alumni Database",
    short_name: "FA Database",
    description:
      "Internal relationship-management system for the BYU Finance alumni program.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F4F6",
    theme_color: "#1C2E54",
    icons: [
      {
        src: "/branding/finance-logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
