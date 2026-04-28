import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow LAN access during development
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "172.20.20.220",
    "172.20.20.170",
    "itemplus.app",
  ],
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' ws: wss: https:; font-src 'self' data:; frame-src 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
  // Dev proxy — forward /api/ and /uploads/ to Go backend
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:8000/uploads/:path*" },
      { source: "/ws", destination: "http://localhost:8000/ws" },
    ];
  },
};

export default nextConfig;
