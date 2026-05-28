import type { NextConfig } from "next"
import path from "path"

// libsodium-wrappers-sumo's ESM entry (dist/modules-sumo-esm/libsodium-wrappers.mjs)
// tries to import "./libsodium-sumo.mjs" — a file that does not exist in the
// published package. We redirect the whole package to its self-contained CJS bundle.
//
// Turbopack resolveAlias requires a module-name string (not an absolute path).
// Webpack resolve.alias accepts an absolute path via path.resolve().
const LIBSODIUM_CJS_MODULE = "libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers"
const LIBSODIUM_CJS_ABS = path.resolve(
  "./node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js"
)

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }

    // Force the CJS bundle for webpack builds (next build / next dev --webpack)
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers-sumo": LIBSODIUM_CJS_ABS,
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }

    return config
  },

  // Turbopack config applies to `next dev` (default dev mode in Next.js 15+).
  // resolveAlias values must be module-name strings, not absolute paths.
  turbopack: {
    resolveAlias: {
      "libsodium-wrappers-sumo": LIBSODIUM_CJS_MODULE,
    },
  },
}

export default nextConfig
