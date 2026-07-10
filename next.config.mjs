/** @type {import('next').NextConfig} */

// The Content-Security-Policy now lives in middleware (`src/lib/csp.ts` +
// `src/middleware.ts`) so it can carry a fresh per-request nonce and drop
// script-src 'unsafe-inline' (#30). It is intentionally NOT set here — a static
// header here plus the middleware header would emit TWO CSPs and the browser
// enforces the intersection, which breaks nonce'd scripts. The remaining
// (static, nonce-free) security headers stay below.

// HSTS only on deployed (production) builds — never on localhost http.
const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
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
  experimental: {
    // Headshot uploads run through a Server Action; raise the default 1 MB body
    // limit above the app's image cap (4 MB) so normal photos aren't rejected
    // with a framework-level 413 before our own validation can run.
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
