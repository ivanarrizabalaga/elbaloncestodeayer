import type { NextConfig } from "next";

// Cache Components is deliberately off: pages that read the session simply render per request,
// which is the simplest model to maintain (CLAUDE.md, rule number one).
const nextConfig: NextConfig = {
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
