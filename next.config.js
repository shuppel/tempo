/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable SWC compiler
  swcMinify: true,
  // Disable Babel
  experimental: {
    forceSwcTransforms: true
  },
  // Temporarily disable TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true
  },
  // Temporarily disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true
  }
}

module.exports = nextConfig 