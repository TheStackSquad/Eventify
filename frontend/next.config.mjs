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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kphwpin3r1kcmjsx.public.blob.vercel-storage.com",
        port: "",
        //  pathname: "/event-images/**",a
        pathname: "/**",
      },
      // Add this new pattern for vendor images
      {
        protocol: "https",
        hostname: "kphwpin3r1kcmjsx.public.blob.vercel-storage.com",
        port: "",
        pathname: "/vendor-images/**",
      },
    ],
  },
};

export default nextConfig;
