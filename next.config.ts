import type { NextConfig } from "next";
import { isProductionDeployment } from "./src/lib/deploy-env";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' https://tiles.openfreemap.org https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Safari upgrades http://localhost assets to https when this is set, so the
  // dev menu loses its stylesheet and photos. Production stays on HTTPS.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  ...(isProductionDeployment()
    ? []
    : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // Opt in to the exact LAN address used for local phone previews.
  allowedDevOrigins: process.env.SUSHINAA_PREVIEW_HOST
    ? [process.env.SUSHINAA_PREVIEW_HOST]
    : [],
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Vercel runs linux-x64 glibc, so that libsql and sharp pair stays in the
  // trace. The other native builds, and sharp's wasm builds, do not.
  outputFileTracingExcludes: {
    "/*": [
      "node_modules/@libsql/darwin-*/**/*",
      "node_modules/@libsql/win32-*/**/*",
      "node_modules/@libsql/linux-arm*/**/*",
      "node_modules/@libsql/linux-x64-musl/**/*",
      "node_modules/@img/sharp-darwin-*/**/*",
      "node_modules/@img/sharp-win32-*/**/*",
      "node_modules/@img/sharp-linux-arm*/**/*",
      "node_modules/@img/sharp-linux-ppc64/**/*",
      "node_modules/@img/sharp-linux-riscv64/**/*",
      "node_modules/@img/sharp-linux-s390x/**/*",
      "node_modules/@img/sharp-linuxmusl-*/**/*",
      "node_modules/@img/sharp-wasm32/**/*",
      "node_modules/@img/sharp-freebsd-wasm32/**/*",
      "node_modules/@img/sharp-webcontainers-wasm32/**/*",
      "node_modules/@img/sharp-libvips-darwin-*/**/*",
      "node_modules/@img/sharp-libvips-linux-arm*/**/*",
      "node_modules/@img/sharp-libvips-linux-ppc64/**/*",
      "node_modules/@img/sharp-libvips-linux-riscv64/**/*",
      "node_modules/@img/sharp-libvips-linux-s390x/**/*",
      "node_modules/@img/sharp-libvips-linuxmusl-*/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/dishes/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
