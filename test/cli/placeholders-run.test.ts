import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { format } from 'prettier'
import { createProgramParser, loadCompiler, scanProject } from '../../src/cli/scan/scanner'
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from '../../src/cli/scan/files'
import { runPlaceholders, type PlaceholdersOptions } from '../../src/cli/placeholders/run'
import { downloadImage, downloadHead } from '../../src/cli/placeholders/fetch'
import type { PlaceholderCache } from '../../src/cli/placeholders/cache'
import * as cdnModule from '../../src/cdn/index'

let root: string
let remoteJpeg: Buffer
let fetchMock: ReturnType<typeof vi.fn>

const APP = `<script setup lang="ts">
import local from './assets/local.png'
const cdnUrl = 'https://demo.imgix.net/photo.jpg'
</script>

<template>
  <VImage src="/images/hero.jpg" alt="Hero" />
  <VImage :src="local" alt="Local" />
  <VImage src="https://example.com/remote.jpg" alt="Remote" />
  <VImage :src="cdnUrl" alt="CDN" />
  <VImage src="/logo.svg" alt="Logo" />
  <VImage src="/images/hero.jpg" alt="Sized" :width="10" :height="5" />
</template>
`

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

function imageResponse(body: Buffer, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'image/jpeg', 'content-length': String(body.length) },
  })
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'vik-run-'))
  write(
    'public/images/hero.jpg',
    await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .jpeg()
      .toBuffer(),
  )
  write(
    'src/assets/local.png',
    await sharp({
      create: { width: 64, height: 32, channels: 3, background: { r: 40, g: 200, b: 40 } },
    })
      .png()
      .toBuffer(),
  )
  write(
    'public/logo.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#0000ff"/></svg>',
  )
  write('src/App.vue', APP)
  remoteJpeg = await sharp({
    create: { width: 300, height: 150, channels: 3, background: { r: 0, g: 0, b: 200 } },
  })
    .jpeg()
    .toBuffer()
  fetchMock = vi.fn(async () => imageResponse(remoteJpeg, 200))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

function emptyCache(): PlaceholderCache {
  return { version: 1, entries: {} }
}

describe('runPlaceholders — without a manifest registration', () => {
  it('writes everything resolvable into the template and skips remote images by default', async () => {
    const report = await runPlaceholders(await scan(), options(), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(report.registrationFound).toBe(false)
    expect(report.manifestPath).toBeNull()
    expect(report.codemodUsages).toBe(4)
    expect(report.fellBackToCodemod).toBe(3)
    expect(report.skipped).toEqual({ 'remote-disabled': 2 })
    expect(fetchMock).not.toHaveBeenCalled()

    const app = readFileSync(join(root, 'src', 'App.vue'), 'utf8')
    expect(app).toMatch(
      /<VImage src="\/images\/hero\.jpg" alt="Hero" :width="640" :height="480" blurhash="[^"]+" \/>/,
    )
    expect(app).toMatch(
      /<VImage :src="local" alt="Local" :width="64" :height="32" blurhash="[^"]+" \/>/,
    )
    expect(app).toContain(
      '<VImage src="/logo.svg" alt="Logo" :width="20" :height="10" placeholder-color="#0000ff" />',
    )
    expect(app).toMatch(/alt="Sized" :width="10" :height="5" blurhash="[^"]+" \/>/)
  })

  it('previews without touching anything in dry-run, and honors --no-write', async () => {
    const dry = await runPlaceholders(await scan(), options({ dryRun: true }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(dry.codemodUsages).toBe(4)
    expect(dry.codemodPreview).toHaveLength(4)
    expect(readFileSync(join(root, 'src', 'App.vue'), 'utf8')).toBe(APP)

    const noWrite = await runPlaceholders(await scan(), options({ write: false }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(noWrite.skipped['write-disabled']).toBe(4)
    expect(readFileSync(join(root, 'src', 'App.vue'), 'utf8')).toBe(APP)
  })

  it('refuses to edit files with uncommitted changes unless forced', async () => {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' })
    git('init', '-q')
    git('add', '-A')
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init')
    writeFileSync(join(root, 'src', 'App.vue'), `${APP}<!-- wip -->\n`)

    const report = await runPlaceholders(await scan(), options({ forceWrite: false }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(report.dirty).toEqual(['src/App.vue'])
    expect(report.skipped['dirty']).toBe(4)
    expect(readFileSync(join(root, 'src', 'App.vue'), 'utf8')).toBe(`${APP}<!-- wip -->\n`)
  })
})

describe('runPlaceholders — with a manifest registration', () => {
  beforeEach(() => {
    write(
      'src/main.ts',
      "import { VImageKitPlugin } from '@macrulez/vue-image-kit'\napp.use(VImageKitPlugin, { placeholders })\n",
    )
  })

  it('puts public/CDN/remote images into the manifest and only local imports into the source', async () => {
    const cache = emptyCache()
    const report = await runPlaceholders(await scan(), options({ remote: true }), {
      sharp,
      cdn: cdnModule,
      cache,
    })
    expect(report.manifestUsages).toBe(5)
    expect(report.codemodUsages).toBe(1)
    expect(report.computed).toEqual({ local: 3, remote: 2 })

    const manifest = readFileSync(join(root, 'src', 'image-placeholders.ts'), 'utf8')
    expect(manifest).toContain('"/images/hero.jpg": {"blurhash":')
    expect(manifest).toContain('"/logo.svg": {"color":"#0000ff","width":20,"height":10}')
    expect(manifest).toMatch(
      /"https:\/\/example\.com\/remote\.jpg": \{"blurhash":"[^"]+","color":"#[0-9a-f]{6}","width":300,"height":150\}/,
    )
    expect(manifest).toContain('"https://demo.imgix.net/photo.jpg": {"blurhash":')

    const urls = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(urls).toContain('https://example.com/remote.jpg')
    expect(
      urls.some(
        (url) => url.startsWith('https://demo.imgix.net/photo.jpg?') && url.includes('w=128'),
      ),
    ).toBe(true)
    const headCall = fetchMock.mock.calls.find(
      (call) => String(call[0]) === 'https://demo.imgix.net/photo.jpg',
    )
    expect((headCall![1] as RequestInit).headers).toMatchObject({ range: 'bytes=0-65535' })

    const app = readFileSync(join(root, 'src', 'App.vue'), 'utf8')
    expect(app).toMatch(/:src="local" alt="Local" :width="64" :height="32" blurhash=/)
    expect(app).toContain('<VImage src="/images/hero.jpg" alt="Hero" />')

    fetchMock.mockClear()
    const second = await runPlaceholders(await scan(), options({ remote: false }), {
      sharp,
      cdn: cdnModule,
      cache,
    })
    expect(second.cached).toBe(4)
    expect(second.manifestUsages).toBe(5)
    expect(second.manifestChanged).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps remote entries from the previous manifest when not downloading', async () => {
    await runPlaceholders(await scan(), options({ remote: true }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    const report = await runPlaceholders(await scan(), options(), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(report.manifestUsages).toBe(5)
    expect(readFileSync(join(root, 'src', 'image-placeholders.ts'), 'utf8')).toContain(
      'https://example.com/remote.jpg',
    )
  })

  it('keeps remote entries after the manifest was reformatted by prettier', async () => {
    const manifestPath = join(root, 'src', 'image-placeholders.ts')
    await runPlaceholders(await scan(), options({ remote: true }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    const formatted = await format(readFileSync(manifestPath, 'utf8'), {
      parser: 'typescript',
      singleQuote: true,
      semi: false,
    })
    writeFileSync(manifestPath, formatted)
    expect(formatted).toContain("'https://example.com/remote.jpg': {")

    const parseProgram = createProgramParser(await loadCompiler())
    const report = await runPlaceholders(await scan(), options(), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
      parseProgram,
    })
    expect(report.manifestUsages).toBe(5)
    expect(readFileSync(manifestPath, 'utf8')).toContain(
      '"https://example.com/remote.jpg": {"blurhash":',
    )
  })

  it('applies --hosts and --limit to remote downloads', async () => {
    const hosts = await runPlaceholders(
      await scan(),
      options({ remote: true, hosts: ['imgix.net'] }),
      { sharp, cdn: cdnModule, cache: emptyCache() },
    )
    expect(hosts.skipped['host-not-allowed']).toBe(1)
    expect(hosts.computed.remote).toBe(1)

    rmSync(join(root, 'src', 'image-placeholders.ts'))
    const limited = await runPlaceholders(await scan(), options({ remote: true, limit: 1 }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(limited.computed.remote).toBe(1)
    expect(limited.skipped['limit']).toBe(1)
  })

  it('reports failed downloads and keeps going', async () => {
    fetchMock.mockImplementation(async () => new Response('nope', { status: 404 }))
    const report = await runPlaceholders(await scan(), options({ remote: true }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(report.failures.map((failure) => failure.message)).toEqual(['HTTP 404', 'HTTP 404'])
    expect(report.skipped['failed']).toBe(2)
    expect(report.manifestUsages).toBe(3)
  })

  it('writes a JSON manifest when asked to', async () => {
    const manifest = join(root, 'placeholders.json')
    await runPlaceholders(await scan(), options({ manifest, mode: 'color' }), {
      sharp,
      cdn: cdnModule,
      cache: emptyCache(),
    })
    expect(existsSync(manifest)).toBe(true)
    expect(JSON.parse(readFileSync(manifest, 'utf8'))['/images/hero.jpg']).toEqual({
      color: '#c82828',
      width: 640,
      height: 480,
    })
  })
})

describe('download helpers', () => {
  it('rejects non-images, oversized bodies and slow servers', async () => {
    fetchMock.mockImplementation(
      async () => new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    )
    await expect(downloadImage('https://x/a', { timeout: 1000, maxBytes: 100 })).rejects.toThrow(
      'not an image',
    )

    fetchMock.mockImplementation(async () => imageResponse(Buffer.alloc(200)))
    await expect(downloadImage('https://x/a', { timeout: 1000, maxBytes: 100 })).rejects.toThrow(
      'limit (--max-bytes)',
    )

    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          ),
        ),
    )
    await expect(downloadImage('https://x/a', { timeout: 20, maxBytes: 100 })).rejects.toThrow(
      'timed out after 20 ms',
    )
  })

  it('reads only the first bytes for a size probe', async () => {
    fetchMock.mockImplementation(async () => imageResponse(Buffer.alloc(1000, 7)))
    const head = await downloadHead('https://x/a', 1000, 64)
    expect(head.byteLength).toBe(64)
  })
})
