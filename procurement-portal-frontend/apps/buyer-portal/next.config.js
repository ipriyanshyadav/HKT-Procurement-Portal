/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@procurement/ui",
    "@procurement/hooks",
    "@procurement/stores",
    "@procurement/utils",
    "@procurement/types",
  ],
};

module.exports = nextConfig;
