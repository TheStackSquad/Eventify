/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Performance: Modern Image Formats
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [25, 50, 75, 85, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kphwpin3r1kcmjsx.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com",
        pathname: "/v1/create-qr-code/**",
      },
      // ✅ ADDED: Paystack domain for logo
      {
        protocol: "https",
        hostname: "paystack.com",
        pathname: "/assets/**",
      },
    ],
  },
  // 2. Caching & Security Headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  // 3. Development/Stale Time Config
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};
export default nextConfig;
