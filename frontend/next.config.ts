import type { NextConfig } from "next";

const isStandalone = process.env.NEXT_PRIVATE_STANDALONE === "true" || process.env.DOCKER_BUILD === "true";

const nextConfig: NextConfig = {
  output: isStandalone ? "standalone" : undefined,
  eslint: {
    // ESLint dijalankan terpisah (CI/dev), bukan saat Docker production build
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      // Preserve trailing slash — Next.js :path* does not capture trailing slash,
      // so we add a second rule that explicitly matches the slash variant.
      {
        source: "/api/:path*/",
        destination: `${process.env.BACKEND_URL || "http://backend:8000"}/api/:path*/`,
      },
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://backend:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
