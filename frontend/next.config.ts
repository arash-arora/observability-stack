import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_API_URL || 'http://backend:8000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
