/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: process.env.NODE_ENV !== 'production',
  },
  transpilePackages: [
    "@procurement/ui",
    "@procurement/hooks",
    "@procurement/stores",
    "@procurement/utils",
    "@procurement/types",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
