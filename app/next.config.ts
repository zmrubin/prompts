import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * better-sqlite3 is a native addon. Webpack cannot bundle the .node binary,
   * so it has to be required from node_modules at runtime instead.
   *
   * Deliberately not `output: 'standalone'`. Standalone traces imports but not
   * data files, so the drizzle/ migrations folder would be missing at runtime,
   * and the native addon would have to be hand-copied into the image — two
   * fragile steps to save disk on a single-user app.
   */
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
