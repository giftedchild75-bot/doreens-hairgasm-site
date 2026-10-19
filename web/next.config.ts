import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// Static preview build (scripts/static-preview.mjs) served from a GitHub Pages
// sub-path, where there is no image optimizer.
const previewBase = process.env.PREVIEW_BASE_PATH;

const nextConfig: NextConfig = {
  ...(previewBase ? { basePath: previewBase, distDir: ".next-preview" } : {}),
  // PGlite ships WASM + data files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Product photo uploads go through a server action. Vercel caps function
  // request bodies at 4.5 MB, so uploads are limited to 4 MB (+ multipart overhead).
  experimental: { serverActions: { bodySizeLimit: "4.4mb" } },
  images: {
    unoptimized: Boolean(previewBase),
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
