import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { runScanCommand } from '../../src/cli/commands/scan'
import { defaultManifestPath, runPlaceholdersCommand } from '../../src/cli/commands/placeholders'
import { resolveDiscovery } from '../../src/cli/commands/discovery'

let root: string
let stdout: string[]
let logs: string[]

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'vik-cmd-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, 'public'), { recursive: true })
  await sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .jpeg()
    .toFile(join(root, 'public', 'a.jpg'))
  writeFileSync(
    join(root, 'src', 'App.vue'),
    '<template>\n  <VImage src="/a.jpg" />\n  <VImage src="https://res.cloudinary.com/demo/image/upload/s.jpg" alt="c" />\n</template>\n',
  )
  stdout = []
  logs = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdout.push(String(chunk))
    return true
  })
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.join(' '))
  })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

describe('scan command', () => {
  it('prints the table report and classifies the CDN host', async () => {
    expect(await runScanCommand(['--root', root, '--no-vite-config'])).toBe(0)
    const output = stdout.join('')
    expect(output).toContain('scan — 2 usages in 1 file')
    expect(output).toContain('cdn:cloudinary')
    expect(output).toContain('missing-alt')
  })

  it('writes json to --out and fails on requested warnings', async () => {
    const out = join(root, 'reports', 'usage.json')
    const code = await runScanCommand([
      '--root',
      root,
      '--no-vite-config',
      '--format',
      'json',
      '--out',
      out,
      '--fail-on',
      'missing-alt',
    ])
    expect(code).toBe(1)
    const report = JSON.parse(readFileSync(out, 'utf8')) as { summary: { totalUsages: number } }
    expect(report.summary.totalUsages).toBe(2)
  })

  it('rejects unknown formats and warning codes', async () => {
    await expect(runScanCommand(['--root', root, '--format', 'xml'])).rejects.toThrow('--format')
    await expect(runScanCommand(['--root', root, '--fail-on', 'nope'])).rejects.toThrow(
      'Unknown --fail-on',
    )
  })

  it('prints help', async () => {
    expect(await runScanCommand(['--help'])).toBe(0)
    expect(logs.join('')).toContain('vue-image-kit scan')
  })
})

describe('placeholders command', () => {
  it('runs end to end with the default manifest path and writes the template', async () => {
    expect(
      await runPlaceholdersCommand(['--root', root, '--no-vite-config', '--force-write']),
    ).toBe(0)
    expect(readFileSync(join(root, 'src', 'App.vue'), 'utf8')).toMatch(
      /<VImage src="\/a\.jpg" :width="40" :height="20" hazehash="[^"]+" \/>/,
    )
    expect(logs.join('\n')).toContain('No placeholders manifest registration was found')
    expect(
      existsSync(join(root, 'node_modules', '.cache', 'vue-image-kit', 'placeholders.json')),
    ).toBe(true)
  })

  it('reads its defaults from vue-image-kit.config.json', async () => {
    writeFileSync(
      join(root, 'vue-image-kit.config.json'),
      JSON.stringify({ placeholders: { mode: 'color' } }),
    )
    await runPlaceholdersCommand(['--root', root, '--no-vite-config', '--force-write', '--dry-run'])
    expect(logs.join('\n')).toContain('mode: color')
    expect(logs.join('\n')).toContain('placeholder-color="#000000"')
  })

  it('validates its options', async () => {
    await expect(runPlaceholdersCommand(['--root', root, '--mode', 'webp'])).rejects.toThrow(
      '--mode',
    )
    await expect(
      runPlaceholdersCommand(['--root', root, '--no-vite-config', '--limit', '0']),
    ).rejects.toThrow('--limit')
  })

  it('defaults the manifest to src/ for Vue and to the Nuxt srcDir', () => {
    expect(defaultManifestPath(root)).toBe(join(root, 'src', 'image-placeholders.ts'))
    writeFileSync(join(root, 'nuxt.config.ts'), 'export default {}')
    mkdirSync(join(root, 'app'))
    writeFileSync(join(root, 'app', 'app.vue'), '')
    expect(defaultManifestPath(root)).toBe(join(root, 'app', 'image-placeholders.ts'))
  })
})

describe('resolveDiscovery', () => {
  it('merges config, flags and default excludes', async () => {
    const options = await resolveDiscovery(
      {
        root,
        exclude: 'legacy/**',
        alias: ['~=src'],
        package: ['vue-image-kit'],
        'no-vite-config': true,
      },
      { exclude: ['stories/**'], publicDir: 'static', packageNames: ['my-vik'] },
    )
    expect(options.exclude).toEqual(
      expect.arrayContaining(['**/node_modules/**', 'stories/**', 'legacy/**']),
    )
    expect(options.publicDir).toBe(join(root, 'static'))
    expect(options.aliases['~']).toBe(join(root, 'src'))
    expect(options.packageNames).toEqual(['@macrulez/vue-image-kit', 'my-vik', 'vue-image-kit'])
  })

  it('rejects malformed aliases and missing roots', async () => {
    await expect(resolveDiscovery({ root, alias: ['nope'] })).rejects.toThrow('--alias')
    await expect(resolveDiscovery({ root: join(root, 'missing') })).rejects.toThrow(
      'Root directory not found',
    )
  })
})
