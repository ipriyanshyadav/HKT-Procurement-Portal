/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    "@procurement/ui",
    "@procurement/hooks",
    "@procurement/stores",
    "@procurement/utils",
    "@procurement/types",
  ],
};

module.exports = nextConfig;
