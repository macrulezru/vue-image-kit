// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { build } from 'vite'
import { parseImageRequest, resolveImageImports, rewriteImageImports, vueImageKit } from '../../src/vite/plugin'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const defaults = resolveImageImports(true, 'blurhash')!

describe('resolveImageImports', () => {
  it('is off unless asked for', () => {
    expect(resolveImageImports(undefined, 'blurhash')).toBeNull()
    expect(resolveImageImports(false, 'blurhash')).toBeNull()
  })

  it('uses the common raster extensions by default and takes custom ones and exclusions', () => {
    expect(defaults.extensions).toEqual(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.tif', '.tiff'])
    const custom = resolveImageImports({ extensions: ['.PNG'], exclude: ['sprites/'] }, 'thumbhash')!
    expect(custom).toEqual({ mode: 'thumbhash', extensions: ['.png'], exclude: ['sprites/'] })
  })
})

describe('rewriteImageImports', () => {
  it('registers the placeholder of every default image import under its own value', () => {
    const code = [
      "import hero from '@/assets/hero.webp'",
      'import logo from "./logo.png";',
      'console.log(hero, logo)',
    ].join('\n')
    const out = rewriteImageImports(code, defaults)!
    expect(out).toContain("import { registerPlaceholder as __vikRegister } from '@macrulez/vue-image-kit'")
    expect(out).toContain('import __vikPlaceholder0 from "@/assets/hero.webp?placeholder=blurhash&lenient"')
    expect(out).toContain('import __vikPlaceholder1 from "./logo.png?placeholder=blurhash&lenient"')
    expect(out).toContain('__vikRegister(hero, __vikPlaceholder0)')
    expect(out).toContain('__vikRegister(logo, __vikPlaceholder1)')
    expect(out.endsWith(`${code}\n`)).toBe(true)
  })

  it('puts the registration before the module body, so a module-level lookup already sees it', () => {
    const out = rewriteImageImports("import a from './a.png'\nconst x = a", defaults)!
    expect(out.indexOf('__vikRegister(a,')).toBeLessThan(out.indexOf('const x = a'))
  })

  it('uses the configured mode', () => {
    const out = rewriteImageImports("import a from './a.png'", resolveImageImports(true, 'thumbhash')!)!
    expect(out).toContain('?placeholder=thumbhash&lenient')
  })

  it('leaves vector images, queried imports, other files and named imports alone', () => {
    expect(rewriteImageImports("import icon from './icon.svg'", defaults)).toBeNull()
    expect(rewriteImageImports("import a from './a.png?url'", defaults)).toBeNull()
    expect(rewriteImageImports("import a from './a.png?placeholder'", defaults)).toBeNull()
    expect(rewriteImageImports("import data from './data.json'", defaults)).toBeNull()
    expect(rewriteImageImports("import { a } from './a.png'", defaults)).toBeNull()
    expect(rewriteImageImports("import './a.png'", defaults)).toBeNull()
  })

  it('ignores an import that is only mentioned in a comment', () => {
    expect(rewriteImageImports("// import a from './a.png'\nconst x = 1", defaults)).toBeNull()
  })

  it('skips excluded paths, and rewrites a module only once', () => {
    const rewrite = resolveImageImports({ exclude: ['/sprites/'] }, 'blurhash')!
    const code = "import s from './sprites/s.png'\nimport p from './p.png'"
    const out = rewriteImageImports(code, rewrite)!
    expect(out).not.toContain('sprites/s.png?placeholder')
    expect(out).toContain('p.png?placeholder=blurhash&lenient')
    expect(rewriteImageImports(out, rewrite)).toBeNull()
  })

  it('finds the imports Vue generates from template src attributes', () => {
    const code = 'import { createElementVNode as _createElementVNode } from "vue"\nimport _imports_0 from "@/img/a.webp"\nexport default {}'
    expect(rewriteImageImports(code, defaults)).toContain('__vikRegister(_imports_0, __vikPlaceholder0)')
  })
})

describe('the lenient flag', () => {
  it('is read from the query', () => {
    expect(parseImageRequest('./a.png?placeholder=blurhash&lenient')?.lenient).toBe(true)
    expect(parseImageRequest('./a.png?placeholder=blurhash')?.lenient).toBeUndefined()
  })
})

describe('imports through the plugin', () => {
  type Transform = { handler(this: unknown, code: string, id: string): { code: string } | null }

  function transformer(options: Parameters<typeof vueImageKit>[0]) {
    const plugin = vueImageKit({ generate: false, ...options })
    const hook = plugin.transform as unknown as Transform
    return (code: string, id: string) => hook.handler.call({}, code, id)
  }

  it('does nothing unless placeholders.imports is on', () => {
    expect(transformer({})("import a from './a.png'", '/p/src/x.ts')).toBeNull()
    expect(transformer({ placeholders: {} })("import a from './a.png'", '/p/src/x.ts')).toBeNull()
  })

  it('rewrites project scripts and single-file components, and only those', () => {
    const run = transformer({ placeholders: { imports: true } })
    const code = "import a from './a.png'"
    expect(run(code, '/p/src/x.ts')).not.toBeNull()
    expect(run(code, '/p/src/Comp.vue')).not.toBeNull()
    expect(run(code, '/p/src/x.mjs')).not.toBeNull()
    expect(run(code, '/p/node_modules/lib/x.js')).toBeNull()
    expect(run(code, '\0virtual:thing')).toBeNull()
    expect(run(code, '/p/src/Comp.vue?vue&type=style&index=0&lang.css')).toBeNull()
    expect(run(code, '/p/src/styles.css')).toBeNull()
  })

  it('honors the mode of the placeholders option', () => {
    const run = transformer({ placeholders: { imports: true, mode: 'thumbhash' } })
    expect(run("import a from './a.png'", '/p/x.ts')!.code).toContain('?placeholder=thumbhash&lenient')
  })
})

describe('vite build with imports on', () => {
  async function project() {
    const root = mkdtempSync(join(tmpdir(), 'vik-imports-'))
    dirs.push(root)
    mkdirSync(join(root, 'src'), { recursive: true })
    await sharp({ create: { width: 80, height: 40, channels: 3, background: { r: 200, g: 40, b: 40 } } })
      .png()
      .toFile(join(root, 'src', 'a.png'))
    writeFileSync(join(root, 'src', 'broken.png'), 'not a png')
    return root
  }

  async function bundleAndRun(root: string, entry: string, options: Parameters<typeof vueImageKit>[0]) {
    writeFileSync(join(root, 'src', 'entry.js'), entry)
    const registry = resolve(__dirname, '../../src/utils/placeholder-registry.ts')
    const result = await build({
      root,
      logLevel: 'silent',
      configFile: false,
      resolve: { alias: { '@macrulez/vue-image-kit': registry } },
      plugins: [vueImageKit({ generate: false, ...options })],
      build: {
        write: false,
        minify: false,
        assetsInlineLimit: 0,
        lib: { entry: join(root, 'src', 'entry.js'), formats: ['es'], fileName: 'out' },
      },
    })
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : [],
    )
    const chunk = outputs.find((item) => item.type === 'chunk' && item.isEntry)
    const file = join(root, 'out.mjs')
    writeFileSync(file, (chunk as { code: string }).code)
    return import(/* @vite-ignore */ `${pathToFileURL(file).href}?t=${Date.now()}`)
  }

  it('registers the placeholder under the final asset URL of an imported image', async () => {
    const root = await project()
    const mod = await bundleAndRun(
      root,
      "import a from './a.png'\nimport { lookupRegisteredPlaceholder } from '@macrulez/vue-image-kit'\nexport const url = a\nexport const entry = () => lookupRegisteredPlaceholder(a)\n",
      { placeholders: { imports: true } },
    )
    expect(typeof mod.url).toBe('string')
    expect(mod.url).toMatch(/\.png$|data:/)
    const entry = mod.entry()
    expect(entry.blurhash).toMatch(/^L/)
    expect(entry.color).toBe('#c82828')
    expect(entry).toMatchObject({ width: 80, height: 40 })
  })

  it('also finds the entry at module level, because the registration runs first', async () => {
    const root = await project()
    const mod = await bundleAndRun(
      root,
      "import a from './a.png'\nimport { lookupRegisteredPlaceholder } from '@macrulez/vue-image-kit'\nexport const atLoad = lookupRegisteredPlaceholder(a)\n",
      { placeholders: { imports: true } },
    )
    expect(mod.atLoad.blurhash).toMatch(/^L/)
  })

  it('does not register anything when the option is off', async () => {
    const root = await project()
    const mod = await bundleAndRun(
      root,
      "import a from './a.png'\nimport { lookupRegisteredPlaceholder } from '@macrulez/vue-image-kit'\nexport const entry = lookupRegisteredPlaceholder(a)\n",
      {},
    )
    expect(mod.entry).toBeUndefined()
  })

  it('does not fail the build for a corrupt image: no placeholder for that one', async () => {
    const root = await project()
    const mod = await bundleAndRun(
      root,
      "import a from './a.png'\nimport broken from './broken.png'\nimport { lookupRegisteredPlaceholder } from '@macrulez/vue-image-kit'\nexport const good = lookupRegisteredPlaceholder(a)\nexport const bad = lookupRegisteredPlaceholder(broken)\n",
      { placeholders: { imports: true } },
    )
    expect(mod.good.blurhash).toMatch(/^L/)
    expect(mod.bad).toBeUndefined()
  })

  it('honors exclusions', async () => {
    const root = await project()
    const mod = await bundleAndRun(
      root,
      "import a from './a.png'\nimport { lookupRegisteredPlaceholder } from '@macrulez/vue-image-kit'\nexport const entry = lookupRegisteredPlaceholder(a)\n",
      { placeholders: { imports: { exclude: ['a.png'] } } },
    )
    expect(mod.entry).toBeUndefined()
  })
})
