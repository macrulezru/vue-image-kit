// Fails CI when a shipped browser bundle grows past its budget — keeps the
// numbers in the README's "Bundle size & peer dependencies" table honest
// without anyone having to remember to update them by hand.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const LIMITS_KB = {
  'dist/vue-image-kit.js': 15,
  'dist/vue-image-kit.cjs': 13,
  'dist/cdn/index.js': 4,
}

let failed = false

for (const [rel, limitKb] of Object.entries(LIMITS_KB)) {
  const full = path.resolve(__dirname, '..', rel)

  if (!fs.existsSync(full)) {
    console.error(`[bundle-size] ${rel} not found — run npm run build first`)
    failed = true
    continue
  }

  const gzipKb = zlib.gzipSync(fs.readFileSync(full)).length / 1024
  const overLimit = gzipKb > limitKb

  console.log(`[bundle-size] ${rel}: ${gzipKb.toFixed(2)} kB gzip (limit ${limitKb} kB)${overLimit ? '  FAIL' : ''}`)

  if (overLimit) failed = true
}

if (failed) {
  console.error('\n[bundle-size] One or more bundles exceeded their size budget.')
  console.error('If the growth is intentional, raise the relevant limit in scripts/check-bundle-size.cjs')
  console.error('and update the numbers in the "Bundle size & peer dependencies" section of README.md.')
  process.exit(1)
}
