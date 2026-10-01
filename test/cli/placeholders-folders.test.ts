import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { scanProject } from '../../src/cli/scan/scanner'
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from '../../src/cli/scan/files'
import { runPlaceholders, type PlaceholdersOptions } from '../../src/cli/placeholders/run'
import { tuningKey } from '../../src/cli/placeholders/compute'
import { loadCache, saveCache } from '../../src/cli/placeholders/cache'
import { parseDirs, resolveTuningFlags } from '../../src/cli/commands/placeholders'
import * as cdnModule from '../../src/cdn/index'

let root: string

function write(path: string, content: string | Buffer): void {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), content)
}

function options(overrides: Partial<PlaceholdersOptions> = {}): PlaceholdersOptions {
  return {
    root,
    mode: 'blurhash',
    manifest: join(root, 'src', 'image-placeholders.ts'),
    typeImport: '@macrulez/vue-image-kit',
    remote: false,
    hosts: [],
    limit: 0,
    concurrency: 2,
    timeout: 1000,
    maxBytes: 5 * 1024 * 1024,
    dryRun: false,
    write: true,
    forceWrite: true,
    refreshRemote: false,
    replace: false,
    publicDir: join(root, 'public'),
    ...overrides,
  }
}

async function scan() {
  return scanProject(
    {
      root,
      include: DEFAULT_INCLUDE,
      exclude: DEFAULT_EXCLUDE,
      publicDir: join(root, 'public'),
      aliases: { '@': join(root, 'src') },
      packageNames: ['@macrulez/vue-image-kit'],
    },
    { cdn: cdnModule },
  )
}

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } } })
    .png()
    .toBuffer()
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'vik-folders-'))
  write('public/images/a.png', await png(80, 40))
  write('public/images/nested/b.png', await png(40, 80))
  write('src/assets/c.png', await png(20, 20))
  write(
    'src/main.ts',
    "import { VImageKitPlugin } from '@macrulez/vue-image-kit'\napp.use(VImageKitPlugin, { placeholders })\n",
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

const deps = () => ({
  sharp,
  cdn: cdnModule,
  cache: { version: 1 as const, entries: {} },
})

describe('runPlaceholders — folders', () => {
  it('adds every image of a folder to the manifest even when no component uses it', async () => {
    write('src/App.vue', '<template><div /></template>')
    const report = await runPlaceholders(await scan(), options({ dirs: ['public/images'] }), deps())
    expect(report.folderEntries).toBe(2)
    const manifest = readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8')
    expect(manifest).toContain('"/images/a.png"')
    expect(manifest).toContain('"/images/nested/b.png"')
    expect(manifest).toMatch(/"width":80,"height":40/)
  })

  it('maps a folder outside public through urlPrefix and warns when it has none', async () => {
    write('src/App.vue', '<template><div /></template>')
    const report = await runPlaceholders(
      await scan(),
      options({ dirs: [{ dir: 'src/assets', urlPrefix: '/_nuxt/assets' }, 'src/assets'] }),
      deps(),
    )
    const manifest = readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8')
    expect(manifest).toContain('"/_nuxt/assets/c.png"')
    expect(manifest).toContain('"/src/assets/c.png"')
    expect(report.warnings).toHaveLength(1)
  })

  it('downloads explicit urls without --remote', async () => {
    write('src/App.vue', '<template><div /></template>')
    const body = await png(30, 30)
    const fetchMock = vi.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'image/png', 'content-length': String(body.length) },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const report = await runPlaceholders(
      await scan(),
      options({ urls: ['https://example.com/x.png'] }),
      deps(),
    )
    expect(fetchMock).toHaveBeenCalled()
    expect(report.computed.remote).toBe(1)
    expect(readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8')).toContain(
      '"https://example.com/x.png"',
    )
  })

  it('merges folder entries with entries found through usages', async () => {
    write('src/App.vue', '<template><VImage src="/images/a.png" alt="A" /></template>')
    const report = await runPlaceholders(await scan(), options({ dirs: ['public/images'] }), deps())
    expect(report.manifestUsages).toBe(1)
    expect(report.folderEntries).toBe(2)
    const manifest = readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8')
    expect(manifest.match(/"\/images\/a\.png"/g)).toHaveLength(1)
    expect(manifest).toContain('"/images/nested/b.png"')
  })
})

describe('runPlaceholders — v-lazy-img and useBackgroundImage', () => {
  it('fills the manifest for them, and skips local imports', async () => {
    write(
      'src/App.vue',
      `<script setup lang="ts">
import { useBackgroundImage } from '@macrulez/vue-image-kit'
import local from './assets/c.png'
const bg = useBackgroundImage('/images/a.png')
</script>
<template>
  <div v-lazy-img="'/images/nested/b.png'" />
  <div v-lazy-img="local" />
</template>
`,
    )
    const report = await runPlaceholders(await scan(), options(), deps())
    expect(report.manifestUsages).toBe(2)
    expect(report.skipped['manifest-required']).toBe(1)
    const manifest = readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8')
    expect(manifest).toContain('"/images/a.png"')
    expect(manifest).toContain('"/images/nested/b.png"')
    expect(readFileSync(join(root, 'src/App.vue'), 'utf8')).not.toContain('blurhash')
  })

  it('needs a registered manifest', async () => {
    rmSync(join(root, 'src/main.ts'))
    write('src/App.vue', `<template><div v-lazy-img="'/images/a.png'" /></template>`)
    const report = await runPlaceholders(await scan(), options(), deps())
    expect(report.manifestUsages).toBe(0)
    expect(report.skipped['manifest-required']).toBe(1)
  })
})

describe('tuning', () => {
  it('more components give a longer blurhash through the whole pipeline', async () => {
    write('src/App.vue', '<template><div /></template>')
    await runPlaceholders(await scan(), options({ dirs: ['public/images'] }), deps())
    const find = (text: string) => /"\/images\/a\.png": \{"blurhash":"([^"]+)"/.exec(text)![1]!
    const baseHash = find(readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8'))
    await runPlaceholders(
      await scan(),
      options({ dirs: ['public/images'], tuning: { components: [6, 5] } }),
      deps(),
    )
    const tunedHash = find(readFileSync(join(root, 'src/image-placeholders.ts'), 'utf8'))
    expect(tunedHash.length).toBeGreaterThan(baseHash.length)
  })

  it('the cache is dropped when the tuning changes', () => {
    saveCache(root, {
      version: 1,
      tuning: tuningKey({}),
      entries: { k: { data: { color: '#fff' } } },
    })
    expect(Object.keys(loadCache(root, tuningKey({})).entries)).toEqual(['k'])
    expect(loadCache(root, tuningKey({ components: [5, 5] })).entries).toEqual({})
  })

  it('parses the CLI flags', () => {
    expect(
      resolveTuningFlags({ components: '5x4', sample: '64', color: 'average' }, undefined),
    ).toEqual({ components: [5, 4], sample: 64, color: 'average' })
    expect(resolveTuningFlags({}, { components: [2, 2] })).toEqual({ components: [2, 2] })
    expect(() => resolveTuningFlags({ components: '10x2' }, undefined)).toThrow('--components')
    expect(() => resolveTuningFlags({ color: 'weird' }, undefined)).toThrow('--color')
  })

  it('parses --dir values with an optional url prefix', () => {
    expect(parseDirs(['public/a', 'src/img=/assets'], ['config/dir'])).toEqual([
      'config/dir',
      'public/a',
      { dir: 'src/img', urlPrefix: '/assets' },
    ])
  })
})
