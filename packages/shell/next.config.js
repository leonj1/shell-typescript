/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  // In a real implementation, you might need to configure module federation here
  // For now, we'll keep it simple
};

module.exports = nextConfig;