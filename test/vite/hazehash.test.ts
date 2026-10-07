import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { decode, getAspectRatio, toBytes } from 'hazehash'
import { parseImageRequest, vueImageKit } from '../../src/vite/plugin'
import { createPlaceholderService } from '../../src/vite/placeholder'
import { defaultPlaceholderMode, resolveTuning, tuningKey } from '../../src/cli/placeholders/compute'
import { hazehashAvailable } from '../../src/cli/deps'
import { placeholderAttributes, sourceProperties } from '../../src/cli/placeholders/codemod'
import { entryForMode } from '../../src/cli/placeholders/manifest'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function project() {
  const root = mkdtempSync(join(tmpdir(), 'vik-hazehash-'))
  dirs.push(root)
  const image = join(root, 'photo.png')
  const pixels = Buffer.alloc(120 * 60 * 3)
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 120; x++) {
      const o = (y * 120 + x) * 3
      pixels[o] = Math.round((x / 119) * 255)
      pixels[o + 1] = 80
      pixels[o + 2] = Math.round((y / 59) * 255)
    }
  }
  await sharp(pixels, { raw: { width: 120, height: 60, channels: 3 } }).png().toFile(image)
  return { root, image }
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
    run: async (id: string) => {
      const code = await (plugin.load as Load).call(context, id)
      return JSON.parse((code as string).replace('export default ', ''))
    },
  }
}

describe('hazehash as the default placeholder', () => {
  it('is the default mode when the hazehash package is installed', () => {
    expect(hazehashAvailable()).toBe(true)
    expect(defaultPlaceholderMode()).toBe('hazehash')
  })

  it('answers a bare ?placeholder import with hazehash, color and size', async () => {
    const { root, image } = await project()
    const { run } = loader(root)
    const props = await run(`${image}?placeholder`)
    expect(Object.keys(props)).toEqual(['hazehash', 'placeholderColor', 'width', 'height'])
    expect(props).toMatchObject({ width: 120, height: 60 })
    expect(props.hazehash).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('keeps blurhash for the mode option, and for an explicit query', async () => {
    const { root, image } = await project()
    const configured = await loader(root, { placeholders: { mode: 'blurhash' } }).run(`${image}?placeholder`)
    expect(Object.keys(configured)).toEqual(['blurhash', 'placeholderColor', 'width', 'height'])
    const explicit = await loader(root).run(`${image}?placeholder=blurhash`)
    expect(Object.keys(explicit)).toEqual(['blurhash', 'placeholderColor', 'width', 'height'])
  })

  it('produces a hash that decodes with the right proportions', async () => {
    const { root, image } = await project()
    const props = await loader(root).run(`${image}?placeholder=hazehash`)
    const hash = props.hazehash as string
    expect(getAspectRatio(hash)).toBeCloseTo(2, 0)
    const { width, height } = decode(hash)
    expect(width).toBe(32)
    expect(height).toBe(16)
  })
})

describe('hazehash queries', () => {
  it('parses ?hazehash as a single value and ?placeholder=hazehash as a legacy mode', () => {
    expect(parseImageRequest('./a.png?hazehash')).toMatchObject({ type: 'hazehash' })
    expect(parseImageRequest('./a.png?placeholder=hazehash')).toMatchObject({
      type: 'placeholder',
      mode: 'hazehash',
    })
    expect(parseImageRequest('./a.png?placeholder=hazehash,color')?.fields).toEqual(['hazehash', 'color'])
  })

  it('returns the bare string for ?hazehash', async () => {
    const { root, image } = await project()
    const code = await (loader(root) as unknown as { run: (id: string) => Promise<unknown> }).run(`${image}?hazehash`)
    expect(typeof code).toBe('string')
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('takes the byte budget from &budget=, and warns about a bad one', async () => {
    const { root, image } = await project()
    const small = (await loader(root).run(`${image}?hazehash&budget=16`)) as string
    const large = (await loader(root).run(`${image}?hazehash&budget=40`)) as string
    expect(toBytes(small).length).toBeLessThanOrEqual(16)
    expect(toBytes(large).length).toBeLessThanOrEqual(40)
    const bad = loader(root)
    await bad.run(`${image}?hazehash&budget=3`)
    expect(bad.warn).toHaveBeenCalledWith(expect.stringContaining('budget must be a whole number of bytes from 7 to 48'))
  })

  it('lists hazehash among the fields of all', () => {
    expect(parseImageRequest('./a.png?placeholder=all')?.fields?.[0]).toBe('hazehash')
  })
})

describe('hazehash tuning and cache', () => {
  it('resolves the budget with a default of 28 and clamps it to 7-48', () => {
    expect(resolveTuning().budget).toBe(28)
    expect(resolveTuning({ budget: 2 }).budget).toBe(7)
    expect(resolveTuning({ budget: 99 }).budget).toBe(48)
    expect(resolveTuning({ budget: 24 }).budget).toBe(24)
  })

  it('changes the cache key with the budget', () => {
    expect(tuningKey({ budget: 20 })).not.toBe(tuningKey({ budget: 30 }))
  })

  it('computes a hazehash per file with the service and honors the budget', async () => {
    const { root, image } = await project()
    const first = await createPlaceholderService(root, undefined, { mode: 'hazehash', tuning: { budget: 16 } }).file(image)
    expect(toBytes(first.hazehash as string).length).toBeLessThanOrEqual(16)
  })
})

describe('hazehash in templates and manifests', () => {
  const data = { hazehash: 'Ed7UwRWKKv5znndNd2Ba284jhm2TLgpUMa0UkQ', blurhash: 'LEHV6nWB2yk8', color: '#112233', width: 40, height: 20 }

  it('writes a hazehash attribute for the hazehash mode, with color only as a fallback', () => {
    expect(placeholderAttributes(data, 'hazehash', true)).toEqual([
      ':width="40"',
      ':height="20"',
      `hazehash="${data.hazehash}"`,
    ])
    expect(placeholderAttributes({ color: '#112233' }, 'hazehash', false)).toEqual(['placeholder-color="#112233"'])
    expect(placeholderAttributes(data, 'blurhash', false)).toEqual(['blurhash="LEHV6nWB2yk8"'])
  })

  it('writes a hazehash property into script sources', () => {
    expect(sourceProperties(data, 'hazehash', false, "'")).toEqual([`hazehash: '${data.hazehash}'`])
  })

  it('keeps only the hash of the chosen mode in a manifest entry', () => {
    expect(entryForMode(data, 'hazehash')).toEqual({
      hazehash: data.hazehash,
      color: '#112233',
      width: 40,
      height: 20,
    })
    expect(entryForMode(data, 'blurhash').hazehash).toBeUndefined()
  })
})
