// tsc strips the shebang from bin.ts — re-add it after compilation
const fs = require('node:fs')
const path = require('node:path')

const binPath = path.resolve(__dirname, '../dist/cli/bin.js')
if (!fs.existsSync(binPath)) {
  console.error('dist/cli/bin.js not found — run build:cli first')
  process.exit(1)
}

const content = fs.readFileSync(binPath, 'utf8')
if (!content.startsWith('#!/usr/bin/env node')) {
  fs.writeFileSync(binPath, '#!/usr/bin/env node\n' + content, 'utf8')
}

fs.chmodSync(binPath, 0o755)
console.log('[vue-image-kit] CLI shebang fixed, chmod 755 applied.')
