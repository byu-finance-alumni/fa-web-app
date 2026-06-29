/** @type {import('next').NextConfig} */

// Content-Security-Policy scoped to the origins this app actually talks to:
// itself, the Supabase project(s) (auth + REST + realtime), and the dev/prod
// API. img allows https so headshots from the storage bucket render.
//
// NOTE: `script-src` is intentionally NOT set here. It is emitted per-request by
// `src/middleware.ts` with a nonce + 'strict-dynamic' (issue #30), which is the
// single source of truth for script-src so 'unsafe-inline' can be dropped. The
// middleware sets a full Content-Security-Policy response header that overrides
// the static one below on every matched route; this static header remains as a
// defense-in-depth baseline for any response the middleware doesn't match.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
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
