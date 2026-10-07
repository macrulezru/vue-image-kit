// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { build } from 'vite'
import {
  importPathMatches,
  parseImageRequest,
  resolveImageImports,
  rewriteImageImports,
  vueImageKit,
} from '../../src/vite/plugin'

const dirs: string[] = []
afterEach(() => {
  delete (globalThis as Record<string, unknown>)['__VIK_PLACEHOLDERS__']
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
    expect(custom).toEqual({ mode: 'thumbhash', extensions: ['.png'], exclude: ['sprites/'], preview: false })
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
    expect(out).toContain('globalThis.__VIK_PLACEHOLDERS__')
    expect(out).toContain('import __vikPlaceholder0 from "@/assets/hero.webp?placeholder=blurhash&lenient"')
    expect(out).toContain('import __vikPlaceholder1 from "./logo.png?placeholder=blurhash&lenient"')
    expect(out).toContain('__vikStore.set(hero, __vikPlaceholder0)')
    expect(out).toContain('__vikStore.set(logo, __vikPlaceholder1)')
    expect(out.endsWith(`${code}\n`)).toBe(true)
  })

  it('puts the registration before the module body, so a module-level lookup already sees it', () => {
    const out = rewriteImageImports("import a from './a.png'\nconst x = a", defaults)!
    expect(out.indexOf('__vikStore.set(a,')).toBeLessThan(out.indexOf('const x = a'))
  })

  it('asks for a ready preview as well when the preview option is on', () => {
    const on = resolveImageImports({ preview: true }, 'blurhash')!
    expect(rewriteImageImports("import a from './a.png'", on)).toContain(
      '?placeholder=blurhash,color,size,preview&lenient',
    )
    const thumb = resolveImageImports({ preview: true }, 'thumbhash')!
    expect(rewriteImageImports("import a from './a.png'", thumb)).toContain(
      '?placeholder=thumbhash,color,size,preview&lenient',
    )
  })

  it('limits the preview to the listed paths', () => {
    const some = resolveImageImports({ preview: ['/hero/'] }, 'blurhash')!
    const code = ["import a from './hero/a.png'", "import b from './b.png'"].join('\n')
    const out = rewriteImageImports(code, some)!
    expect(out).toContain('./hero/a.png?placeholder=blurhash,color,size,preview&lenient')
    expect(out).toContain('./b.png?placeholder=blurhash&lenient')
  })

  it('follows an import that the dev server has already analyzed', () => {
    const code = 'import hero from "/_nuxt/src/assets/hero.webp?import"\nimport b from "/_nuxt/src/b.png?import&t=170"'
    const out = rewriteImageImports(code, defaults)!
    expect(out).toContain('import __vikPlaceholder0 from "/_nuxt/src/assets/hero.webp?placeholder=blurhash&lenient&import"')
    expect(out).toContain('import __vikPlaceholder1 from "/_nuxt/src/b.png?placeholder=blurhash&lenient&import"')
    expect(out).toContain('__vikStore.set(hero, __vikPlaceholder0)')
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
    expect(rewriteImageImports(code, defaults)).toContain('__vikStore.set(_imports_0, __vikPlaceholder0)')
  })
})

describe('the lenient flag', () => {
  it('is read from the query', () => {
    expect(parseImageRequest('./a.png?placeholder=blurhash&lenient')?.lenient).toBe(true)
    expect(parseImageRequest('./a.png?placeholder=blurhash')?.lenient).toBeUndefined()
  })
})

describe('imports through the plugin', () => {
  type Transform = { handler(this: unknown, code: string, id: string): Promise<{ code: string } | null> }

  function transformer(options: Parameters<typeof vueImageKit>[0]) {
    const plugin = vueImageKit({ generate: false, ...options })
    const hook = plugin.transform as unknown as Transform
    return (code: string, id: string, context: unknown = {}) => hook.handler.call(context, code, id)
  }

  it('does nothing unless placeholders.imports is on', async () => {
    expect(await transformer({})("import a from './a.png'", '/p/src/x.ts')).toBeNull()
    expect(await transformer({ placeholders: {} })("import a from './a.png'", '/p/src/x.ts')).toBeNull()
  })

  it('rewrites project scripts and single-file components, and only those', async () => {
    const run = transformer({ placeholders: { imports: true } })
    const code = "import a from './a.png'"
    expect(await run(code, '/p/src/x.ts')).not.toBeNull()
    expect(await run(code, '/p/src/Comp.vue')).not.toBeNull()
    expect(await run(code, '/p/src/x.mjs')).not.toBeNull()
    expect(await run(code, '/p/node_modules/lib/x.js')).toBeNull()
    expect(await run(code, '\0virtual:thing')).toBeNull()
    expect(await run(code, '/p/src/Comp.vue?vue&type=style&index=0&lang.css')).toBeNull()
    expect(await run(code, '/p/src/styles.css')).toBeNull()
    expect(await run(code, '/p/src/Comp.vue?vue&type=script&setup=true&lang.ts')).not.toBeNull()
    expect(await run(code, '/p/src/Comp.vue?vue&type=template&lang.js')).not.toBeNull()
    expect(await run(code, '/p/src/x.ts?raw')).toBeNull()
  })

  it('honors the mode of the placeholders option', async () => {
    const run = transformer({ placeholders: { imports: true, mode: 'thumbhash' } })
    expect((await run("import a from './a.png'", '/p/x.ts'))!.code).toContain('?placeholder=thumbhash&lenient')
  })

  it('matches a preview list against the real path of an aliased import', async () => {
    const run = transformer({ placeholders: { mode: 'blurhash', imports: { preview: ['src/assets/hero/'] } } })
    const context = {
      resolve: async (source: string) => ({ id: source.replace('@/', '/p/src/') }),
    }
    const code = ["import a from '@/assets/hero/a.png'", "import b from '@/assets/b.png'"].join('\n')
    const out = (await run(code, '/p/src/x.ts', context))!.code
    expect(out).toContain('@/assets/hero/a.png?placeholder=blurhash,color,size,preview&lenient')
    expect(out).toContain('@/assets/b.png?placeholder=blurhash&lenient')
  })

  it('matches a dev-server URL that is already analyzed, after cutting the base', async () => {
    const plugin = vueImageKit({
      generate: false,
      placeholders: { mode: 'blurhash', imports: { preview: ['src/assets/hero/'] } },
    })
    const configure = plugin.configResolved as unknown as (config: unknown) => void
    configure({ command: 'serve', root: '/p', base: '/_nuxt/', publicDir: false })
    const hook = plugin.transform as unknown as Transform
    const code = [
      'import a from "/_nuxt/src/assets/hero/a.png?import"',
      'import b from "/_nuxt/src/assets/b.png?import"',
    ].join('\n')
    const out = (await hook.handler.call({}, code, '/p/src/x.ts'))!.code
    expect(out).toContain('/_nuxt/src/assets/hero/a.png?placeholder=blurhash,color,size,preview&lenient&import')
    expect(out).toContain('/_nuxt/src/assets/b.png?placeholder=blurhash&lenient&import')
  })
})

describe('importPathMatches', () => {
  it('takes a part of the path, a directory or an exact file', () => {
    expect(importPathMatches(['hero'], '@/a/hero.png', 'src/a/hero.png')).toBe(true)
    expect(importPathMatches(['src/a/hero/'], '@/a/hero/x.png', 'src/a/hero/x.png')).toBe(true)
    expect(importPathMatches(['src/a/hero/'], '@/a/hero/x.png', 'src/a/other/x.png')).toBe(false)
    expect(importPathMatches(['src/a/hero.png'], '@/a/hero.png', 'src/a/hero.png')).toBe(true)
    expect(importPathMatches(['./src/a/hero.png'], '@/a/hero.png', 'src/a/hero.png')).toBe(true)
  })

  it('takes glob patterns over the root-relative path', () => {
    expect(importPathMatches(['src/assets/*.png'], 'x', 'src/assets/a.png')).toBe(true)
    expect(importPathMatches(['src/assets/*.png'], 'x', 'src/assets/deep/a.png')).toBe(false)
    expect(importPathMatches(['src/assets/**/*.png'], 'x', 'src/assets/deep/er/a.png')).toBe(true)
    expect(importPathMatches(['src/assets/**/*.png'], 'x', 'src/assets/a.png')).toBe(true)
    expect(importPathMatches(['**/hero-*.webp'], 'x', 'src/img/hero-1.webp')).toBe(true)
    expect(importPathMatches(['src/**'], 'x', 'lib/a.png')).toBe(false)
  })

  it('falls back to the import specifier when the real path is unknown', () => {
    expect(importPathMatches(['hero'], './hero.png', undefined)).toBe(true)
    expect(importPathMatches(['./img/*.png'], './img/a.png', undefined)).toBe(true)
  })
})

describe('exclude with real paths', () => {
  it('excludes by a resolved path', () => {
    const rewrite = resolveImageImports({ exclude: ['src/sprites/**'] }, 'blurhash')!
    const code = ["import s from '@/sprites/s.png'", "import p from '@/p.png'"].join('\n')
    const paths = new Map([
      ['@/sprites/s.png', 'src/sprites/s.png'],
      ['@/p.png', 'src/p.png'],
    ])
    const out = rewriteImageImports(code, rewrite, paths)!
    expect(out).not.toContain('sprites/s.png?placeholder')
    expect(out).toContain('@/p.png?placeholder=blurhash&lenient')
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
      { placeholders: { imports: true, mode: 'blurhash' } },
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
      { placeholders: { imports: true, mode: 'blurhash' } },
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
      { placeholders: { imports: true, mode: 'blurhash' } },
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
