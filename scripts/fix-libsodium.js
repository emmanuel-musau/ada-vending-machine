// libsodium-wrappers-sumo 0.7.16 ships an ESM entry that imports "./libsodium-sumo.mjs"
// but that file is missing from the published package. The actual binary lives in the
// companion "libsodium-sumo" package. We copy it over so Turbopack/webpack can resolve it.
const fs = require("fs")
const path = require("path")

const src = path.resolve(
  __dirname,
  "../node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs"
)
const dest = path.resolve(
  __dirname,
  "../node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs"
)

if (!fs.existsSync(src)) {
  console.warn("fix-libsodium: source not found, skipping:", src)
  process.exit(0)
}

if (fs.existsSync(dest)) {
  process.exit(0)
}

fs.copyFileSync(src, dest)
console.log("fix-libsodium: copied libsodium-sumo.mjs into libsodium-wrappers-sumo ESM directory")
