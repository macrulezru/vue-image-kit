import { describe, it, expect, vi, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { parseImageRequest, vueImageKit } from '../../src/vite/plugin'
import { createTypesFile, normalizeQuery } from '../../src/vite/types-file'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function project() {
  const root = mkdtempSync(join(tmpdir(), 'vik-query-'))
  dirs.push(root)
  const image = join(root, 'photo.png')
  await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .png()
    .toFile(image)
  const svg = join(root, 'logo.svg')
  writeFileSync(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#e33"/></svg>',
  )
  return { root, image, svg }
}

type Load = (this: unknown, id: string) => Promise<string | null | undefined>

function loader(root: string, options: Parameters<typeof vueImageKit>[0] = {}) {
  const plugin = vueImageKit({ generate: false, ...options })
  ;(plugin.configResolved as (c: { command: string; root: string }) => void)({
    command: 'build',
    root,
  })
  const warn = vi.fn()
  const context = { warn, addWatchFile: vi.fn() }
  return {
    warn,
    plugin,
    run: async (id: string) => {
      const code = await (plugin.load as Load).call(context, id)
      return JSON.parse((code as string).replace('export default ', ''))
    },
  }
}

describe('parseImageRequest — field lists', () => {
  it('keeps the single legacy values exactly as before', () => {
    expect(parseImageRequest('./a.png?placeholder')).toMatchObject({ type: 'placeholder' })
    expect(parseImageRequest('./a.png?placeholder')?.fields).toBeUndefined()
    expect(parseImageRequest('./a.png?placeholder=thumbhash')).toMatchObject({
      type: 'placeholder',
      mode: 'thumbhash',
    })
    expect(parseImageRequest('./a.png?placeholder=color')?.fields).toBeUndefined()
  })

  it('parses a comma list in any order, without duplicates', () => {
    const request = parseImageRequest('./a.png?placeholder=color,blurhash,color,size')
    expect(request).toMatchObject({ type: 'placeholder', fields: ['color', 'blurhash', 'size'], shape: 'props' })
  })

  it('expands all and accepts spaces as separators', () => {
    expect(parseImageRequest('./a.png?placeholder=all')?.fields).toEqual([
      'blurhash',
      'thumbhash',
      'color',
      'size',
      'preview',
      'aspect',
    ])
    expect(parseImageRequest('./a.png?placeholder=blurhash+color')?.fields).toEqual(['blurhash', 'color'])
  })

  it('reads the shape and reports an invalid one', () => {
    expect(parseImageRequest('./a.png?placeholder=color,size&shape=raw')?.shape).toBe('raw')
    const bad = parseImageRequest('./a.png?placeholder=color,size&shape=nope')
    expect(bad?.shape).toBe('props')
    expect(bad?.issues?.[0]).toContain('shape')
  })

  it('reports an unknown field and keeps the valid ones', () => {
    const request = parseImageRequest('./a.png?placeholder=blurhash,bogus')
    expect(request?.fields).toEqual(['blurhash'])
    expect(request?.issues?.[0]).toContain('bogus')
  })

  it('falls back to the legacy form when no field is valid', () => {
    const request = parseImageRequest('./a.png?placeholder=bogus')
    expect(request?.type).toBe('placeholder')
    expect(request?.fields).toBeUndefined()
    expect(request?.issues).toHaveLength(1)
  })
})

describe('parseImageRequest — scalar imports and tuning', () => {
  it('recognises the scalar flags', () => {
    for (const name of ['blurhash', 'thumbhash', 'color', 'size', 'preview', 'aspect']) {
      expect(parseImageRequest(`./a.png?${name}`)?.type).toBe(name)
    }
  })

  it('ignores a new scalar name that carries a value, so another plugin\'s ?size=large is left alone', () => {
    expect(parseImageRequest('./a.png?size=large')).toBeNull()
    expect(parseImageRequest('./a.png?color=red')).toBeNull()
  })

  it('reads components, sample and strategy', () => {
    expect(parseImageRequest('./a.png?blurhash&components=5x3&sample=64&strategy=average')?.tuning).toEqual({
      components: [5, 3],
      sample: 64,
      color: 'average',
    })
  })

  it('reports invalid tuning values and leaves them out', () => {
    const request = parseImageRequest('./a.png?blurhash&components=12x1&sample=2&strategy=max')
    expect(request?.tuning).toBeUndefined()
    expect(request?.issues).toHaveLength(3)
  })

  it('works with the placeholder list too', () => {
    const request = parseImageRequest('./a.png?placeholder=blurhash,color&components=2x2')
    expect(request?.fields).toEqual(['blurhash', 'color'])
    expect(request?.tuning).toEqual({ components: [2, 2] })
  })
})

describe('placeholder lists through the plugin', () => {
  it('returns exactly the listed fields, in <VImage> prop names', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const props = await run(`${image}?placeholder=blurhash,color`)
    expect(Object.keys(props)).toEqual(['blurhash', 'placeholderColor'])
    expect(props.placeholderColor).toBe('#c82828')
  })

  it('adds width and height only when size is listed, and maps preview to the placeholder prop', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const props = await run(`${image}?placeholder=size,preview`)
    expect(props.width).toBe(200)
    expect(props.height).toBe(100)
    expect(props.placeholder).toMatch(/^data:image\/png;base64,/)
    expect(props.blurhash).toBeUndefined()
  })

  it('returns raw names with shape=raw', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const raw = await run(`${image}?placeholder=all&shape=raw`)
    expect(Object.keys(raw)).toEqual(['blurhash', 'thumbhash', 'color', 'preview', 'size', 'aspect'])
    expect(raw.size).toEqual({ width: 200, height: 100 })
    expect(raw.aspect).toBe(2)
  })

  it('warns that aspect is not a <VImage> prop and leaves it out of the props shape', async () => {
    const { root, image } = await project()
    const { run, warn } = loader(root)
    const props = await run(`${image}?placeholder=aspect,color`)
    expect(props.aspect).toBeUndefined()
    expect(props.placeholderColor).toBe('#c82828')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aspect'))
  })

  it('keeps the legacy shapes unchanged', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    expect(Object.keys(await run(`${image}?placeholder`))).toEqual([
      'blurhash',
      'placeholderColor',
      'width',
      'height',
    ])
    expect(Object.keys(await run(`${image}?placeholder=thumbhash`))).toEqual([
      'thumbhash',
      'placeholderColor',
      'width',
      'height',
    ])
    expect(Object.keys(await run(`${image}?placeholder=color`))).toEqual([
      'placeholderColor',
      'width',
      'height',
    ])
  })

  it('warns about an unknown field and still answers', async () => {
    const { root, image } = await project()
    const { run, warn } = loader(root)
    const props = await run(`${image}?placeholder=color,bogus`)
    expect(props.placeholderColor).toBe('#c82828')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bogus'))
  })
})

describe('scalar imports through the plugin', () => {
  it('returns the dominant color, the size, the aspect ratio and a preview', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    expect(await run(`${image}?color`)).toBe('#c82828')
    expect(await run(`${image}?size`)).toEqual({ width: 200, height: 100 })
    expect(await run(`${image}?aspect`)).toBe(2)
    expect(await run(`${image}?preview`)).toMatch(/^data:image\/png;base64,/)
    expect(await run(`${image}?blurhash`)).toMatch(/^L/)
    expect(await run(`${image}?thumbhash`)).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('makes a preview that is a real PNG', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const uri = (await run(`${image}?preview`)) as string
    const png = Buffer.from(uri.split(',')[1]!, 'base64')
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBeGreaterThan(0)
  })
})

describe('per-import tuning', () => {
  it('changes the BlurHash components for that import only, and never leaks into the cache', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const standard = (await run(`${image}?blurhash`)) as string
    const tuned = (await run(`${image}?blurhash&components=2x2`)) as string
    expect(standard.startsWith('L')).toBe(true)
    expect(tuned.startsWith('A')).toBe(true)
    expect(await run(`${image}?blurhash`)).toBe(standard)
    expect(await run(`${image}?blurhash&components=2x2`)).toBe(tuned)
  })

  it('supports the average color strategy', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const average = (await run(`${image}?color&strategy=average`)) as string
    expect(average).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('warns about an invalid value and uses the default', async () => {
    const { root, image } = await project()
    const { run, warn } = loader(root)
    const hash = (await run(`${image}?blurhash&components=99x1`)) as string
    expect(hash.startsWith('L')).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('components'))
  })
})

describe('vector images with the new imports', () => {
  it('answers color, size and aspect, and warns for the fields an SVG does not have', async () => {
    const { root, svg } = await project()
    const { run, warn } = loader(root)
    expect(await run(`${svg}?color`)).toBe('#ee3333')
    expect(await run(`${svg}?size`)).toEqual({ width: 64, height: 32 })
    expect(await run(`${svg}?aspect`)).toBe(2)
    expect(await run(`${svg}?preview`)).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
    const props = await run(`${svg}?placeholder=blurhash,color,size`)
    expect(props).toEqual({ placeholderColor: '#ee3333', width: 64, height: 32 })
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[1]![0]).toContain('blurhash')
  })
})

describe('generated typings (types option)', () => {
  it('normalizes the query Vite adds', () => {
    expect(normalizeQuery('import&placeholder=color,size')).toBe('placeholder=color,size')
    expect(normalizeQuery('placeholder=color&t=1700000000')).toBe('placeholder=color')
  })

  it('writes a declaration for a list, skips the built-in ones and keeps earlier entries', async () => {
    const { root } = await project()
    const file = join(root, 'src', 'vik-imports.d.ts')
    const first = createTypesFile(file)
    first.record(parseImageRequest('./a.png?placeholder=blurhash,color')!)
    first.record(parseImageRequest('./a.png?placeholder=color')!)
    first.record(parseImageRequest('./a.png?color')!)
    first.record(parseImageRequest('./a.png?blurhash&components=3x3')!)
    first.flush()
    const text = readFileSync(file, 'utf8')
    expect(text).toContain("declare module '*?placeholder=blurhash,color'")
    expect(text).toContain("declare module '*?blurhash&components=3x3'")
    expect(text).not.toContain("declare module '*?placeholder=color'")
    expect(text).not.toContain("declare module '*?color'")

    const second = createTypesFile(file)
    second.record(parseImageRequest('./a.png?size&sample=64')!)
    second.flush()
    const merged = readFileSync(file, 'utf8')
    expect(merged).toContain("declare module '*?placeholder=blurhash,color'")
    expect(merged).toContain("declare module '*?size&sample=64'")
  })

  it('does not rewrite an unchanged file', async () => {
    const { root } = await project()
    const file = join(root, 'vik-imports.d.ts')
    const writer = createTypesFile(file)
    writer.record(parseImageRequest('./a.png?placeholder=color,size')!)
    writer.flush()
    const before = readFileSync(file, 'utf8')
    const again = createTypesFile(file)
    again.record(parseImageRequest('./a.png?placeholder=color,size')!)
    again.flush()
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  it('is written by the plugin when the types option is on', async () => {
    const { root, image } = await project()
    const { plugin } = loader(root, { types: true })
    const resolveId = plugin.resolveId as (
      this: unknown,
      id: string,
      importer?: string,
    ) => Promise<unknown>
    await resolveId.call({ resolve: async () => ({ id: image }) }, `${image}?placeholder=thumbhash,size`, undefined)
    ;(plugin.buildEnd as () => void)()
    expect(existsSync(join(root, 'src', 'vik-imports.d.ts'))).toBe(true)
    expect(readFileSync(join(root, 'src', 'vik-imports.d.ts'), 'utf8')).toContain(
      "declare module '*?placeholder=thumbhash,size'",
    )
  })

  it('produces declarations TypeScript accepts for the matching imports', async () => {
    const { root } = await project()
    mkdirSync(join(root, 'src'), { recursive: true })
    const file = join(root, 'src', 'vik-imports.d.ts')
    const writer = createTypesFile(file)
    writer.record(parseImageRequest('./photo.png?placeholder=color,blurhash')!)
    writer.record(parseImageRequest('./photo.png?size&sample=64')!)
    writer.flush()
    writeFileSync(
      join(root, 'src', 'use.ts'),
      [
        "import ph from './photo.png?placeholder=color,blurhash'",
        "import dims from './photo.png?size&sample=64'",
        'export const a: string | undefined = ph.placeholderColor',
        'export const b: number = dims.width',
      ].join('\n'),
    )
    writeFileSync(
      join(root, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: { strict: true, noEmit: true, module: 'esnext', moduleResolution: 'bundler', skipLibCheck: true },
        include: ['src'],
      }),
    )
    const tsc = join(createRequire(import.meta.url).resolve('typescript/package.json'), '..', 'bin', 'tsc')
    const result = spawnSync(process.execPath, [tsc, '-p', root], { encoding: 'utf8' })
    expect(result.stdout + result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})
