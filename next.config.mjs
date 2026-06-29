/** @type {import('next').NextConfig} */

// Content-Security-Policy scoped to the origins this app actually talks to:
// itself, the Supabase project(s) (auth + REST + realtime), and the dev/prod
// API. script/style allow 'unsafe-inline' for now (Next injects some inline
// script/style); this can be tightened to nonce-based later. img allows https
// so headshots from the storage bucket render.
// Next.js dev mode (React Fast Refresh / HMR) evaluates strings as JavaScript,
// so 'unsafe-eval' is required locally. Never emitted in production builds.
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fa-web-api.vercel.app https://dev-fa-web-api.vercel.app",
].join("; ");

// HSTS only on deployed (production) builds — never on localhost http.
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  // Removes the `X-Powered-By: Next.js` stack-disclosure header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
