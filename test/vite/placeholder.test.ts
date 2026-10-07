import { describe, it, expect } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { createPlaceholderService } from '../../src/vite/placeholder'
import { cachePath } from '../../src/cli/placeholders/cache'

async function makeProject(): Promise<{
  root: string
  image: (rel: string, w: number, h: number) => Promise<string>
}> {
  const root = mkdtempSync(join(tmpdir(), 'vik-ph-'))
  return {
    root,
    async image(rel, width, height) {
      const file = join(root, rel)
      mkdirSync(join(file, '..'), { recursive: true })
      const buf = await sharp({
        create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
      })
        .png()
        .toBuffer()
      writeFileSync(file, buf)
      return file
    },
  }
}

describe('placeholder service — single files', () => {
  it('returns hazehash, color and size by default, writing nothing next to the image', async () => {
    const { root, image } = await makeProject()
    const file = await image('a.png', 300, 200)
    const service = createPlaceholderService(root, undefined)
    const props = await service.file(file)
    expect(props.hazehash).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(props.blurhash).toBeUndefined()
    expect(props.thumbhash).toBeUndefined()
    expect(props.placeholderColor).toBe('#c82828')
    expect(props).toMatchObject({ width: 300, height: 200 })
  })

  it('returns blurhash, color and size with mode blurhash', async () => {
    const { root, image } = await makeProject()
    const file = await image('a.png', 300, 200)
    const service = createPlaceholderService(root, undefined, { mode: 'blurhash' })
    const props = await service.file(file)
    expect(props.blurhash).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]+$/)
    expect(props.hazehash).toBeUndefined()
    expect(props.thumbhash).toBeUndefined()
    expect(props.placeholderColor).toBe('#c82828')
    expect(props).toMatchObject({ width: 300, height: 200 })
  })

  it('returns only the requested kind even when both are cached', async () => {
    const { root, image } = await makeProject()
    const file = await image('a.png', 100, 400)
    const service = createPlaceholderService(root, undefined)
    const thumb = await service.file(file, 'thumbhash')
    expect(thumb.thumbhash).toBeTruthy()
    expect(thumb.blurhash).toBeUndefined()
    const blur = await service.file(file, 'blurhash')
    expect(blur.blurhash).toBeTruthy()
    expect(blur.thumbhash).toBeUndefined()
  })

  it('color mode returns only color and size', async () => {
    const { root, image } = await makeProject()
    const file = await image('a.png', 50, 50)
    const service = createPlaceholderService(root, undefined)
    expect(await service.file(file, 'color')).toEqual({
      placeholderColor: '#c82828',
      width: 50,
      height: 50,
    })
  })

  it('honours tuning: components change the hash, the color strategy is accepted', async () => {
    const { root, image } = await makeProject()
    const file = await image('a.png', 120, 80)
    const base = await createPlaceholderService(root, undefined, { mode: 'blurhash' }).file(file)
    const wide = await createPlaceholderService(root, undefined, {
      mode: 'blurhash',
      tuning: { components: [6, 4] },
    }).file(file)
    expect(wide.blurhash!.length).toBeGreaterThan(base.blurhash!.length)
    const avg = await createPlaceholderService(root, undefined, {
      tuning: { color: 'average' },
    }).file(file)
    expect(avg.placeholderColor).toBe('#c82828')
  })

  it('persists results to the cache file and reuses them', async () => {
    const { root, image } = await makeProject()
    const file = await image('a.png', 64, 64)
    const first = createPlaceholderService(root, undefined)
    const initial = await first.file(file)
    first.flush()
    expect(existsSync(cachePath(root))).toBe(true)
    const second = createPlaceholderService(root, undefined)
    expect(await second.file(file)).toEqual(initial)
  })
})

describe('placeholder service — folder manifest', () => {
  it('keys images under the public dir by their URL, including nested folders', async () => {
    const { root, image } = await makeProject()
    await image('public/images/a.png', 40, 30)
    await image('public/images/deep/b.png', 30, 40)
    const service = createPlaceholderService(root, join(root, 'public'), {
      dirs: ['public/images'],
    })
    const { entries, warnings } = await service.manifest()
    expect(Object.keys(entries).sort()).toEqual(['/images/a.png', '/images/deep/b.png'])
    expect(entries['/images/a.png']).toMatchObject({ width: 40, height: 30 })
    expect(entries['/images/a.png']!.hazehash).toBeTruthy()
    expect(warnings).toEqual([])
  })

  it('uses urlPrefix for folders outside public and warns without one', async () => {
    const { root, image } = await makeProject()
    await image('src/img/c.png', 20, 20)
    const prefixed = await createPlaceholderService(root, join(root, 'public'), {
      dirs: [{ dir: 'src/img', urlPrefix: '/assets/img/' }],
    }).manifest()
    expect(Object.keys(prefixed.entries)).toEqual(['/assets/img/c.png'])
    expect(prefixed.warnings).toEqual([])

    const bare = await createPlaceholderService(root, join(root, 'public'), {
      dirs: ['src/img'],
    }).manifest()
    expect(Object.keys(bare.entries)).toEqual(['/src/img/c.png'])
    expect(bare.warnings[0]).toContain('outside the public directory')
  })

  it('reports a missing folder instead of throwing', async () => {
    const { root } = await makeProject()
    const result = await createPlaceholderService(root, join(root, 'public'), {
      dirs: ['nope'],
    }).manifest()
    expect(result.entries).toEqual({})
    expect(result.warnings[0]).toContain('directory not found')
  })

  it('supports the thumbhash mode for the whole manifest', async () => {
    const { root, image } = await makeProject()
    await image('public/a.png', 100, 300)
    const { entries } = await createPlaceholderService(root, join(root, 'public'), {
      dirs: ['public'],
      mode: 'thumbhash',
    }).manifest()
    expect(entries['/a.png']!.thumbhash).toBeTruthy()
    expect(entries['/a.png']!.blurhash).toBeUndefined()
  })
})
