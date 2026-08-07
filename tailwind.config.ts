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
        // APPROVED PALETTE EXCEPTION — the alumni survey's "Submit my updates"
        // button, and nothing else. Approved by Jake, 2026-08-06 (#648); the
        // rationale and the scope live in UX-UI.md under "Approved palette
        // exceptions" so a design-compliance pass doesn't revert it as stray
        // green. Named for its one use on purpose: there is no generic green in
        // this product.
        //
        // 600 is the same green as `success-600` — one green in the app, not
        // two — but kept as its own token because this is an ACTION colour, not
        // the success/verified semantic, and the two must be free to diverge.
        // 700 is the hover, DARKER rather than lighter (the opposite of
        // `brand-blue`): a lighter green drops white text under 4.5:1.
        // Contrast on white text: 600 = 5.0:1, 700 = 6.6:1 — both pass WCAG AA.
        "submit-green": { 600: "#15803D", 700: "#126B33" },
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
