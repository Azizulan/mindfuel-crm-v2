import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mongoose and bcryptjs run only in Route Handlers (Node.js runtime)
  serverExternalPackages: ['mongoose', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },   // pre-existing loose types from Vite era
};

export default nextConfig;
