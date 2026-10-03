import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { parseSvgSize, readSvgSize, svgDensity } from '../../src/cli/placeholders/svg'
import { createPlaceholderService } from '../../src/vite/placeholder'
import { vueImageKit } from '../../src/vite/plugin'
import { generate } from '../../src/cli/processor'
import { DEFAULTS } from '../../src/cli/config'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vik-svg-'))
  dirs.push(dir)
  return dir
}

describe('parseSvgSize', () => {
  it('reads width and height, with or without px', () => {
    expect(parseSvgSize('<svg xmlns="x" width="64" height="32">')).toEqual({
      width: 64,
      height: 32,
    })
    expect(parseSvgSize("<svg width='20px' height='10px'>")).toEqual({ width: 20, height: 10 })
  })

  it('falls back to the viewBox, and derives the missing side from it', () => {
    expect(parseSvgSize('<svg viewBox="0 0 24 12">')).toEqual({ width: 24, height: 12 })
    expect(parseSvgSize('<svg width="48" viewBox="0 0 24 12">')).toEqual({ width: 48, height: 24 })
    expect(parseSvgSize('<svg height="6" viewBox="0,0,24,12">')).toEqual({ width: 12, height: 6 })
  })

  it('does not trust percentages or other units, and gives up without any size', () => {
    expect(parseSvgSize('<svg width="100%" height="100%">')).toBeNull()
    expect(parseSvgSize('<svg width="10em" height="5em">')).toBeNull()
    expect(parseSvgSize('<svg>')).toBeNull()
    expect(parseSvgSize('not an svg')).toBeNull()
  })

  it('reads the header of a file and a buffer, and returns null for a missing file', () => {
    const dir = project()
    const file = join(dir, 'a.svg')
    writeFileSync(file, '<?xml version="1.0"?>\n<svg width="7" height="9"></svg>')
    expect(readSvgSize(file)).toEqual({ width: 7, height: 9 })
    expect(readSvgSize(Buffer.from('<svg width="3" height="4"/>'))).toEqual({ width: 3, height: 4 })
    expect(readSvgSize(join(dir, 'missing.svg'))).toBeNull()
  })
})

describe('svgDensity', () => {
  it('leaves small vectors at the default density and lowers it for large ones', () => {
    expect(svgDensity(null)).toBeUndefined()
    expect(svgDensity({ width: 64, height: 64 })).toBeUndefined()
    expect(svgDensity({ width: 256, height: 100 })).toBeUndefined()
    expect(svgDensity({ width: 2560, height: 100 })).toBe(7)
    expect(svgDensity({ width: 30000, height: 30000 })).toBe(1)
  })
})

describe('placeholders for vector images', () => {
  it('returns the declared size and a color for a huge SVG instead of failing on the pixel limit', async () => {
    const root = project()
    const file = join(root, 'huge.svg')
    writeFileSync(
      file,
      '<svg xmlns="http://www.w3.org/2000/svg" width="30000" height="30000"><rect width="30000" height="30000" fill="#3366cc"/></svg>',
    )
    const props = await createPlaceholderService(root, undefined).file(file)
    expect(props).toEqual({ placeholderColor: '#3366cc', width: 30000, height: 30000 })
  })

  it('still reports exact size and color for an ordinary SVG', async () => {
    const root = project()
    const file = join(root, 'icon.svg')
    writeFileSync(
      file,
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#e33"/></svg>',
    )
    expect(await createPlaceholderService(root, undefined).file(file)).toEqual({
      placeholderColor: '#ee3333',
      width: 64,
      height: 32,
    })
  })

  it('has no color for an empty SVG but keeps its size', async () => {
    const root = project()
    const file = join(root, 'empty.svg')
    writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')
    expect(await createPlaceholderService(root, undefined).file(file)).toEqual({
      width: 10,
      height: 10,
    })
  })
})

describe('?placeholder / ?blurhash imports of an SVG through the plugin', () => {
  type Load = (this: unknown, id: string) => Promise<string | null | undefined>

  function loader(root: string) {
    const plugin = vueImageKit({ generate: false })
    ;(plugin.configResolved as (c: { command: string; root: string }) => void)({
      command: 'build',
      root,
    })
    const warn = vi.fn()
    const context = { warn, addWatchFile: vi.fn() }
    return { warn, load: (id: string) => (plugin.load as Load).call(context, id) }
  }

  it('does not throw for a corrupt SVG: warns and falls back to the declared size', async () => {
    const root = project()
    const file = join(root, 'broken.svg')
    writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><<oops')
    const { load, warn } = loader(root)
    const code = await load(`${file}?placeholder`)
    expect(code).toBe('export default {"width":40,"height":20}')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken.svg'))
  })

  it('returns an empty object for a corrupt SVG with no usable size', async () => {
    const root = project()
    const file = join(root, 'broken.svg')
    writeFileSync(file, 'definitely not an svg')
    const { load, warn } = loader(root)
    expect(await load(`${file}?placeholder`)).toBe('export default {}')
    expect(warn).toHaveBeenCalled()
  })

  it('still fails loudly for a corrupt raster image', async () => {
    const root = project()
    const file = join(root, 'broken.png')
    writeFileSync(file, 'not a png')
    const { load } = loader(root)
    await expect(load(`${file}?placeholder`)).rejects.toThrow()
  })

  it('explains that a vector has no blurhash or thumbhash instead of silently returning nothing', async () => {
    const root = project()
    const file = join(root, 'icon.svg')
    writeFileSync(
      file,
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>',
    )
    const { load, warn } = loader(root)
    expect(await load(`${file}?blurhash`)).toBe('export default ""')
    expect(await load(`${file}?thumbhash`)).toBe('export default ""')
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]![0]).toContain('?placeholder')
  })
})

describe('generate with the output inside the input directory', () => {
  it('does not feed its own output back in as input', async () => {
    const root = project()
    const input = join(root, 'images')
    const output = join(input, 'optimized')
    mkdirSync(input, { recursive: true })
    await sharp({
      create: { width: 80, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toFile(join(input, 'photo.jpg'))
    writeFileSync(
      join(input, 'logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>',
    )

    const config = {
      ...DEFAULTS,
      input,
      output,
      widths: [40],
      formats: ['jpg' as const],
      incremental: false,
    }
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await generate(config)
    await generate(config)
    const processing = log.mock.calls
      .map((c) => String(c[0]))
      .filter((l) => l.includes('Processing'))
    log.mockRestore()

    expect(processing).toEqual([
      '[vue-image-kit] Processing 2 image(s)…',
      '[vue-image-kit] Processing 2 image(s)…',
    ])
    expect(readdirSync(output).sort()).toEqual(['logo.svg', 'photo-40.jpg', 'photo.jpg'])
  })
})
