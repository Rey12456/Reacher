import type { NextConfig } from "next";

// Cache Components is off: every page here is per-user and session-bound, so it adds
// Suspense/validation overhead without any prerendering benefit.
const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
