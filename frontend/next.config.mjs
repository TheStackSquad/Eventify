/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ✅ DEBUGGING: Better error messages
  productionBrowserSourceMaps: false,

  // ✅ CATCH BUILD ERRORS: Strict mode catches more bugs
  reactStrictMode: true,

  // ✅ TYPESCRIPT: Stricter type checking
  typescript: {
    ignoreBuildErrors: false,
  },

  // ✅ ESLINT: Catch problematic patterns
  eslint: {
    ignoreDuringBuilds: false,
  },

  // ✅ LOGGING: More verbose output
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
      {
        protocol: "https",
        hostname: "paystack.com",
        pathname: "/assets/**",
      },
    ],
  },

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

  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;