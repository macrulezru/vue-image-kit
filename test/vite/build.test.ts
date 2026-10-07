// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { build } from 'vite'
import { vueImageKit } from '../../src/vite/plugin'

async function project(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'vik-build-'))
  mkdirSync(join(root, 'public/images'), { recursive: true })
  mkdirSync(join(root, 'src/img'), { recursive: true })
  const png = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 30, g: 90, b: 200 } } })
      .png()
      .toBuffer()
  writeFileSync(join(root, 'public/images/a.png'), await png(80, 40))
  writeFileSync(join(root, 'src/img/one.png'), await png(60, 60))
  writeFileSync(join(root, 'src/img/two.png'), await png(30, 90))
  return root
}

async function bundle(root: string, entry: string, plugin: ReturnType<typeof vueImageKit>): Promise<string> {
  writeFileSync(join(root, 'entry.js'), entry)
  const result = await build({
    root,
    logLevel: 'silent',
    configFile: false,
    plugins: [plugin],
    build: {
      write: false,
      minify: false,
      lib: { entry: join(root, 'entry.js'), formats: ['es'], fileName: 'out' },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
    'output' in item ? item.output : [],
  )
  return outputs.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n')
}

describe('vite build integration', () => {
  it('serves a virtual manifest built from folders, with generate: false', async () => {
    const root = await project()
    const code = await bundle(
      root,
      "import placeholders from 'virtual:vue-image-kit/placeholders'\nexport default placeholders\n",
      vueImageKit({
        generate: false,
        placeholders: { dirs: ['public/images', { dir: 'src/img', urlPrefix: '/assets' }] },
      }),
    )
    expect(code).toContain('"/images/a.png"')
    expect(code).toContain('"/assets/one.png"')
    expect(code).toContain('"/assets/two.png"')
    expect(code).toMatch(/"hazehash":\s*"[^"]+"/)
    expect(code).toMatch(/"width":\s*80/)
  })

  it('works through import.meta.glob with a placeholder query', async () => {
    const root = await project()
    const code = await bundle(
      root,
      "export default import.meta.glob('./src/img/*.png', { query: '?placeholder', import: 'default', eager: true })\n",
      vueImageKit({ generate: false }),
    )
    expect(code).toContain('one.png')
    expect(code).toContain('two.png')
    expect(code).toMatch(/hazehash/)
    expect(code).toContain('"placeholderColor"')
  })

  it('does not touch the input folder when generate is false', async () => {
    const root = await project()
    const code = await bundle(
      root,
      "import h from './src/img/one.png?blurhash'\nexport default h\n",
      vueImageKit({ generate: false, input: join(root, 'does-not-exist') }),
    )
    expect(code).toMatch(/export|default/)
  })
})
