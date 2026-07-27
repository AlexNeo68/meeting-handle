/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: 'http://localhost:3001/auth/:path*',
      },
      {
        source: '/user/:path*',
        destination: 'http://localhost:3001/user/:path*',
      },
      {
        source: '/meetings/:path*',
        destination: 'http://localhost:3001/meetings/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
