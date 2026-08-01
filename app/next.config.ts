import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Railway builds a container; standalone keeps the runtime image small.
  output: 'standalone',
  serverExternalPackages: ['postgres'],
}

export default nextConfig
