/** @type {import('next').NextConfig} */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";

// CSP baseline from docs/SPEC_AMENDMENTS.md §4.2. `unsafe-eval` is development-only
// so the React refresh runtime can compile modules; production never ships it.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://*.flutterwave.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.maptiler.com https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.flutterwave.com https://*.maptiler.com https://api.africastalking.com",
  "font-src 'self'",
  "frame-src https://checkout.flutterwave.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.flutterwave.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.maptiler.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
