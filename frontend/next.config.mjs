// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable caching in development
  experimental: {
    staleTimes: {
      dynamic: 0, // Always fresh for dynamic content
      static: 0, // Always fresh for static content
    },
  },
  // Add headers to prevent caching
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
    ];
  },
  images: {
    // Configure allowed qualities for Next.js 16+
    qualities: [25, 50, 75, 85, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kphwpin3r1kcmjsx.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "kphwpin3r1kcmjsx.public.blob.vercel-storage.com",
        port: "",
        pathname: "/vendor-images/**",
      },
      // ADD THIS: Allow QR code service
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        port: "",
        pathname: "/v1/create-qr-code/**",
      },
    ],
  },
};

export default nextConfig;
