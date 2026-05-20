import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const devHttpSource = isDev ? " http:" : "";
const csp = `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:${devHttpSource}; media-src 'self' blob: https:${devHttpSource}; connect-src 'self' ws: wss: https:${devHttpSource}; font-src 'self' data:; frame-src 'self'`;

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
            value: csp,
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
      { source: "/api/:path*", destination: "http://localhost:17117/api/:path*" },
      { source: "/uploads/:path*", destination: "http://localhost:17117/uploads/:path*" },
      { source: "/ws", destination: "http://localhost:17117/ws" },
    ];
  },
};

export default nextConfig;
