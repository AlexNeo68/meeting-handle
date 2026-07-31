/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:3001/auth/:path*',
      },
      {
        source: '/api/user/:path*',
        destination: 'http://localhost:3001/user/:path*',
      },
      {
        source: '/api/meetings/:path*',
        destination: 'http://localhost:3001/meetings/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
