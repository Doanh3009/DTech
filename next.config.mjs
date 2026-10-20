import { networkInterfaces } from "node:os";

const production = process.env.NODE_ENV === "production";
const localTest = ["development", "test"].includes(process.env.APP_ENV) && process.env.TEST_TOOLS_ENABLED === "true" && process.env.NEXT_PUBLIC_SUPABASE_URL === process.env.TEST_SUPABASE_URL;
const testDatabaseOrigin = localTest && process.env.TEST_SUPABASE_URL ? new URL(process.env.TEST_SUPABASE_URL).origin : "";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co${testDatabaseOrigin ? ` ${testDatabaseOrigin}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${testDatabaseOrigin ? ` ${testDatabaseOrigin} ${testDatabaseOrigin.replace(/^http/, "ws")}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  ...(production && !localTest ? ["upgrade-insecure-requests"] : [])
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 also checks the origin of its development handshake. Use only
  // addresses belonging to this machine so phones on Wi-Fi can hydrate.
  allowedDevOrigins: production ? [] : [...new Set(Object.values(networkInterfaces()).flatMap((interfaces) =>
    (interfaces || []).filter((address) => address.family === "IPv4" && !address.internal).map((address) => address.address)
  ))],
  distDir: process.env.BUILD_VARIANT === "review" ? ".next-review" : process.env.E2E_DATABASE_KIND === "test" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  devIndicators: false,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/v1/accounting/payslips/*/download": ["./assets/fonts/pdf/**"],
    "/api/v1/leave-requests/*/pdf": ["./assets/fonts/pdf/**"]
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }
    ];
  }
};

export default nextConfig;
