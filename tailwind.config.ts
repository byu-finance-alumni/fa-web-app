import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Brand tokens are the single source of truth in UX-UI.md.
// Reference these by name in components — never hardcode hex values in JSX.
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0F1B33",
          800: "#1C2E54", // primary brand navy
          700: "#243B6B",
        },
        royal: {
          700: "#002E5D", // BYU official navy
        },
        "brand-blue": {
          600: "#2E4A86", // primary interactive
          500: "#3B5C9A",
          300: "#9DB2D8",
          50: "#EEF2FA",
        },
        success: { 600: "#15803D", 50: "#ECFDF3" },
        warning: { 600: "#B45309", 50: "#FEF6E7" },
        danger: { 600: "#B42318", 50: "#FEF3F2" },
        // App background — a near-white neutral. White cards pop cleanly
        // against it (modern SaaS look) with soft gray-200 borders + shadow.
        canvas: "#F9FAFB",
      },
      fontFamily: {
        // Inter is loaded in app/layout.tsx via next/font (exposed as --font-inter).
        // Reference the variable so `font-sans` actually uses the loaded font.
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Design-system shadow hierarchy (UX-UI.md): cards get a single subtle
        // shadow; popovers use md; dialogs/toasts use lg (Tailwind defaults).
        card: "0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.10)",
      },
    },
  },
  plugins: [animate],
};

export default config;
