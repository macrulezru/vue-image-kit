import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { rgbaToThumbHash } from 'thumbhash'
import {
  computePlaceholder,
  dominantColor,
  probeSize,
  rgbaToRgbOverWhite,
} from '../../src/cli/placeholders/compute'
import { applyEdits, placeholderAttributes } from '../../src/cli/placeholders/codemod'
import { entryForMode, readManifest, renderManifest } from '../../src/cli/placeholders/manifest'
import { hasModeData } from '../../src/cli/placeholders/cache'
import { computeThumbhash } from '../../src/cli/processor'
import { installHint } from '../../src/cli/deps'
import { createProgramParser, loadCompiler } from '../../src/cli/scan/scanner'

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vik-ph-'))
  await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 120, b: 220 } },
  })
    .composite([
      {
        input: {
          create: { width: 60, height: 60, channels: 3, background: { r: 250, g: 200, b: 0 } },
        },
        left: 0,
        top: 0,
      },
    ])
    .jpeg({ quality: 95 })
    .toFile(join(dir, 'photo.jpg'))
  await sharp({
    create: { width: 400, height: 900, channels: 3, background: { r: 30, g: 160, b: 70 } },
  })
    .png()
    .toFile(join(dir, 'tall.png'))
  writeFileSync(
    join(dir, 'logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect x="20" y="10" width="40" height="20" fill="#7c3aed"/></svg>',
  )
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('dominantColor', () => {
  it('returns the most frequent color bin, ignoring transparent pixels', () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0,
    ])
    expect(dominantColor(rgba)).toBe('#ff0000')
  })

  it('returns undefined for a fully transparent image', () => {
    expect(dominantColor(new Uint8Array([1, 2, 3, 0]))).toBeUndefined()
  })

  it('composites over white for the blurhash input', () => {
    expect([...rgbaToRgbOverWhite(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]))]).toEqual([
      255, 255, 255, 0, 0, 0,
    ])
  })
})

describe('computePlaceholder', () => {
  it('computes blurhash, dominant color and the original size', async () => {
    const data = await computePlaceholder(join(dir, 'photo.jpg'), {
      mode: 'blurhash',
      sharp,
      includeSize: true,
      colorOnly: false,
    })
    expect(data.width).toBe(300)
    expect(data.height).toBe(200)
    expect(data.blurhash).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{28}$/)
    expect(data.color).toMatch(/^#0[0-9a-f]7[0-9a-f]d[0-9a-f]$/)
    expect(data.thumbhash).toBeUndefined()
  })

  it('computes a thumbhash for a tall image (fits 100×100)', async () => {
    const data = await computePlaceholder(join(dir, 'tall.png'), {
      mode: 'thumbhash',
      sharp,
      rgbaToThumbHash,
      includeSize: true,
      colorOnly: false,
    })
    expect(data.thumbhash).toBeTruthy()
    expect(data.blurhash).toBeUndefined()
    expect(data).toMatchObject({ width: 400, height: 900 })
  })

  it('returns only the color (and size) for color-only sources like SVG', async () => {
    const data = await computePlaceholder(join(dir, 'logo.svg'), {
      mode: 'blurhash',
      sharp,
      includeSize: true,
      colorOnly: true,
    })
    expect(data).toEqual({ width: 80, height: 40, color: '#7c3aed' })
  })

  it('probes the size of a buffer and returns null for garbage', async () => {
    const buffer = await sharp(join(dir, 'photo.jpg')).toBuffer()
    expect(await probeSize(sharp, buffer)).toEqual({ width: 300, height: 200 })
    expect(await probeSize(sharp, Buffer.from('nope'))).toBeNull()
  })
})

describe('generate thumbhash for tall images', () => {
  it('no longer throws for an image taller than 100px after resizing', async () => {
    await expect(computeThumbhash(join(dir, 'tall.png'))).resolves.toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})

describe('codemod', () => {
  it('builds attributes per mode, adding size only when asked', () => {
    const data = { blurhash: 'LEHV6n', thumbhash: 'YQkG', color: '#123456', width: 10, height: 20 }
    expect(placeholderAttributes(data, 'blurhash', true)).toEqual([
      ':width="10"',
      ':height="20"',
      'blurhash="LEHV6n"',
    ])
    expect(placeholderAttributes(data, 'thumbhash', false)).toEqual(['thumbhash="YQkG"'])
    expect(placeholderAttributes(data, 'color', false)).toEqual(['placeholder-color="#123456"'])
    expect(placeholderAttributes({ color: '#fff' }, 'blurhash', false)).toEqual([
      'placeholder-color="#fff"',
    ])
  })

  it('inserts inline or on new indented lines, last edit first', () => {
    const source = '<VImage src="/a.jpg" />\n<VImage\n  src="/b.jpg"\n/>'
    const firstEnd = source.indexOf(' />')
    const secondEnd = source.indexOf('"/b.jpg"') + '"/b.jpg"'.length
    const out = applyEdits(source, [
      {
        target: { insertOffset: firstEnd, tagEnd: 7, indent: null, attributes: [] },
        attributes: ['blurhash="x"'],
      },
      {
        target: { insertOffset: secondEnd, tagEnd: 0, indent: '  ', attributes: [] },
        attributes: [':width="1"', 'blurhash="y"'],
      },
    ])
    expect(out).toBe(
      '<VImage src="/a.jpg" blurhash="x" />\n<VImage\n  src="/b.jpg"\n  :width="1"\n  blurhash="y"\n/>',
    )
  })

  function target(source: string, indent: string | null) {
    const attributes = [...source.matchAll(/(:?[a-z-]+)="[^"]*"/g)].map((match) => ({
      name: match[1]!.replace(/^:/, '').replace(/-(\w)/g, (_, c: string) => c.toUpperCase()),
      raw: match[1]!,
      start: match.index!,
      end: match.index! + match[0].length,
    }))
    return { insertOffset: attributes.at(-1)!.end, tagEnd: 7, indent, attributes }
  }

  it('removes replaced attributes and inserts after the last kept one (single line)', () => {
    const source =
      '<VImage src="/a.jpg" placeholder-color="#fff" alt="A" placeholder-mode="color" />'
    const out = applyEdits(source, [
      {
        target: target(source, null),
        attributes: ['blurhash="x"'],
        remove: ['placeholderColor', 'placeholderMode'],
      },
    ])
    expect(out).toBe('<VImage src="/a.jpg" alt="A" blurhash="x" />')
  })

  it('removes whole lines in a multi-line tag and keeps the indentation', () => {
    const source = '<VImage\n  src="/a.jpg"\n  thumbhash="t"\n  alt="A"\n/>'
    const out = applyEdits(source, [
      { target: target(source, '  '), attributes: ['blurhash="x"'], remove: ['thumbhash'] },
    ])
    expect(out).toBe('<VImage\n  src="/a.jpg"\n  alt="A"\n  blurhash="x"\n/>')
  })

  it('only removes when nothing is inserted (value moved to the manifest)', () => {
    const source = '<VImage src="/a.jpg" alt="A" blurhash="b" />'
    expect(
      applyEdits(source, [{ target: target(source, null), attributes: [], remove: ['blurhash'] }]),
    ).toBe('<VImage src="/a.jpg" alt="A" />')
  })
})

describe('manifest', () => {
  it('keeps only the fields for the chosen mode', () => {
    const data = { blurhash: 'b', thumbhash: 't', color: '#000000', width: 1, height: 2 }
    expect(entryForMode(data, 'blurhash')).toEqual({
      blurhash: 'b',
      color: '#000000',
      width: 1,
      height: 2,
    })
    expect(entryForMode(data, 'color')).toEqual({ color: '#000000', width: 1, height: 2 })
  })

  it('round-trips through the generated TS and JSON files', () => {
    const entries = {
      '/b.jpg': { color: '#111111' },
      '/a.jpg': { width: 1, height: 2, blurhash: 'x' },
    }
    for (const file of ['manifest.ts', 'manifest.json']) {
      const path = join(dir, file)
      const content = renderManifest(entries, path, '@macrulez/vue-image-kit')
      writeFileSync(path, content)
      expect(readManifest(path)).toEqual(entries)
    }
    const ts = renderManifest(entries, 'x.ts', 'vue-image-kit')
    expect(ts).toContain("import type { PlaceholderManifest } from 'vue-image-kit'")
    expect(ts.indexOf('"/a.jpg"')).toBeLessThan(ts.indexOf('"/b.jpg"'))
    expect(ts).toContain('"/a.jpg": {"blurhash":"x","width":1,"height":2}')
  })

  it('reads a manifest reformatted by prettier or edited by hand', async () => {
    const parse = createProgramParser(await loadCompiler())
    const path = join(dir, 'formatted.ts')
    writeFileSync(
      path,
      [
        "import type { PlaceholderManifest } from '@macrulez/vue-image-kit'",
        '',
        '// comment',
        'const placeholders: PlaceholderManifest = {',
        "  '/images/hero.jpg': {",
        "    blurhash: 'LJ9+E%}}$^I_^Z=:xUNMIwI^R.s+',",
        "    color: '#1e6ec7',",
        '    width: 1200,',
        '    height: 800,',
        '  },',
        "  'https://cdn.example.com/a.jpg': { color: `#000000` }, // trailing",
        '}',
        '',
        'export default placeholders',
        '',
      ].join('\n'),
    )
    expect(readManifest(path, parse)).toEqual({
      '/images/hero.jpg': {
        blurhash: 'LJ9+E%}}$^I_^Z=:xUNMIwI^R.s+',
        color: '#1e6ec7',
        width: 1200,
        height: 800,
      },
      'https://cdn.example.com/a.jpg': { color: '#000000' },
    })

    writeFileSync(
      path,
      "export default { '/a.jpg': { width: 1, height: 2 } } satisfies Record<string, object>\n",
    )
    expect(readManifest(path, parse)).toEqual({ '/a.jpg': { width: 1, height: 2 } })
  })

  it('treats a missing or unreadable manifest as empty', () => {
    expect(readManifest(join(dir, 'nope.ts'))).toEqual({})
    writeFileSync(join(dir, 'broken.ts'), 'export default {')
    expect(readManifest(join(dir, 'broken.ts'))).toEqual({})
  })
})

describe('cache and install hints', () => {
  it('knows which cached data satisfies a mode', () => {
    expect(hasModeData({ blurhash: 'b' }, 'blurhash', false)).toBe(true)
    expect(hasModeData({ blurhash: 'b' }, 'thumbhash', false)).toBe(false)
    expect(hasModeData({ color: '#fff' }, 'blurhash', true)).toBe(true)
  })

  it('lists npm, pnpm and yarn install commands', () => {
    const hint = installHint('sharp', 'needed')
    expect(hint).toContain('npm install -D sharp')
    expect(hint).toContain('pnpm add -D sharp')
    expect(hint).toContain('yarn add -D sharp')
  })
})
