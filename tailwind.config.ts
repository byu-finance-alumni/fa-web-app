import type { Config } from "tailwindcss";

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
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
