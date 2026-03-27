/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@turk/shared"],
  experimental: {
    serverComponentsExternalPackages: ["dockerode", "ssh2"],
  },
};

module.exports = nextConfig;
