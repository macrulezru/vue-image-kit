import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanProject } from '../../src/cli/scan/scanner'
import { DEFAULT_EXCLUDE, DEFAULT_INCLUDE } from '../../src/cli/scan/files'
import * as cdn from '../../src/cdn/index'
import type { ImageUsage, ScanResult } from '../../src/cli/scan/types'

let root: string
let result: ScanResult

function write(path: string, content: string): void {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content, 'utf8')
}

function usagesIn(file: string): ImageUsage[] {
  return result.usages.filter((usage) => usage.file === file)
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'vik-scan-'))
  write('public/images/hero.jpg', 'x')
  write('src/assets/local.png', 'x')

  write(
    'src/components/Gallery.vue',
    `<script setup lang="ts">
import { VImage as Img } from '@macrulez/vue-image-kit'
import local from '@/assets/local.png'
import meta from './photo.jpg?vik'
const remote = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
const items: { src: string }[] = []
</script>

<template>
  <div>
    <VImage src="/images/hero.jpg" alt="Hero" :width="800" :height="600" lazy />
    <Img
      :src="local"
      alt="Local"
    />
    <v-image :src="remote" alt="Remote" placeholder-color="#fff" />
    <VImage :image="meta" alt="Vik" />
    <VImage :src="{ fallback: '/images/hero.jpg', webp: '/images/hero.webp' }" alt="SrcSet" />
    <VImage v-for="item in items" :key="item.src" :src="item.src" alt="Dyn" v-bind="$attrs" />
    <VImage src="https://example.com/a.jpg" alt="" priority />
    <VImage src="/images/missing.jpg" loader="server" />
    <div v-lazy-img="{ src: '/images/hero.jpg', placeholder: '/tiny.jpg' }" />
  </div>
</template>
`,
  )

  write(
    'src/components/Other.vue',
    `<script setup lang="ts">
import { VImage } from 'some-other-lib'
</script>
<template><VImage src="/images/hero.jpg" alt="Not ours" /></template>
`,
  )

  write(
    'src/composables/bg.ts',
    `import { useBackgroundImage, useImage } from '@macrulez/vue-image-kit'
import { useImage as useOtherImage } from '@vueuse/core'
export function setup() {
  useBackgroundImage('/images/hero.jpg', { lazy: false })
  useImage({ src: 'https://example.com/b.jpg', widths: [400] })
  useOtherImage({ src: '/ignored.jpg' })
}
`,
  )

  write(
    'src/render.tsx',
    `import { h } from 'vue'
import { VImage } from '@macrulez/vue-image-kit'
export const A = () => h(VImage, { src: '/images/hero.jpg', alt: 'h()' })
export const B = () => <VImage src="/images/hero.jpg" alt="jsx" width={10} height={10} />
`,
  )

  write(
    'src/main.ts',
    `import { createApp } from 'vue'
import { VImageKitPlugin } from '@macrulez/vue-image-kit'
import placeholders from './image-placeholders'
createApp({}).use(VImageKitPlugin, { placeholders })
`,
  )

  write('src/Broken.vue', '<template><VImage src="/a.jpg" alt="x"></template>')
  write('node_modules/pkg/index.vue', '<template><VImage src="/x.jpg" alt="x" /></template>')
  write('src/plain.ts', 'export const nothing = 1\n')

  result = await scanProject(
    {
      root,
      include: DEFAULT_INCLUDE,
      exclude: DEFAULT_EXCLUDE,
      publicDir: join(root, 'public'),
      aliases: { '@': join(root, 'src') },
      packageNames: ['@macrulez/vue-image-kit'],
    },
    { cdn },
  )
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('scanProject — templates', () => {
  it('finds VImage, its local alias and the kebab-case tag, but not node_modules', () => {
    const gallery = usagesIn('src/components/Gallery.vue')
    expect(gallery.filter((usage) => usage.kind === 'component')).toHaveLength(8)
    expect(result.usages.some((usage) => usage.file.startsWith('node_modules'))).toBe(false)
  })

  it('classifies a public path and records whether the file exists', () => {
    const hero = usagesIn('src/components/Gallery.vue')[0]!
    expect(hero.source).toMatchObject({
      kind: 'public',
      value: '/images/hero.jpg',
      fileExists: true,
    })
    expect(hero.props['width']).toEqual({ kind: 'static', value: 800 })
    expect(hero.props['lazy']).toEqual({ kind: 'static', value: true })
    expect(hero.hasPlaceholder).toBe(false)
  })

  it('resolves an aliased image import to a local file', () => {
    const local = usagesIn('src/components/Gallery.vue')[1]!
    expect(local.source.kind).toBe('local-import')
    expect(local.source.filePath).toBe(join(root, 'src', 'assets', 'local.png'))
    expect(local.source.fileExists).toBe(true)
  })

  it('detects the CDN provider of a const-bound URL and the placeholder prop', () => {
    const remote = usagesIn('src/components/Gallery.vue')[2]!
    expect(remote.source).toMatchObject({ kind: 'cdn', provider: 'cloudinary' })
    expect(remote.hasPlaceholder).toBe(true)
  })

  it('treats :image bound to a ?vik import as build-time metadata', () => {
    const vik = usagesIn('src/components/Gallery.vue')[3]!
    expect(vik.source).toMatchObject({ kind: 'vik', value: './photo.jpg?vik' })
    expect(vik.hasPlaceholder).toBe(true)
  })

  it('resolves a SrcSet object through its fallback', () => {
    expect(usagesIn('src/components/Gallery.vue')[4]!.source).toMatchObject({
      kind: 'public',
      value: '/images/hero.jpg',
    })
  })

  it('marks v-for sources as dynamic and records v-bind spreads', () => {
    const dynamic = usagesIn('src/components/Gallery.vue')[5]!
    expect(dynamic.source).toEqual({ kind: 'dynamic', expression: 'item.src' })
    expect(dynamic.props['v-bind']).toEqual({ kind: 'dynamic', expression: '$attrs' })
  })

  it('classifies remote URLs, server-loader paths and missing files', () => {
    const [, , , , , , remote, server] = usagesIn('src/components/Gallery.vue')
    expect(remote!.source.kind).toBe('remote')
    expect(server!.source).toMatchObject({ kind: 'server', fileExists: false })
  })

  it('records the directive with its options', () => {
    const directive = usagesIn('src/components/Gallery.vue').find(
      (usage) => usage.kind === 'directive',
    )!
    expect(directive.source.kind).toBe('public')
    expect(directive.hasPlaceholder).toBe(true)
  })

  it('computes an edit target that follows the attribute indentation', () => {
    const [single, multi] = usagesIn('src/components/Gallery.vue')
    expect(single!.edit!.indent).toBeNull()
    expect(multi!.edit!.indent).toBe('      ')
  })

  it('ignores a VImage imported from another library', () => {
    expect(usagesIn('src/components/Other.vue')).toHaveLength(0)
  })
})

describe('scanProject — scripts', () => {
  it('finds package composables but not same-named imports from other packages', () => {
    const composables = usagesIn('src/composables/bg.ts')
    expect(composables.map((usage) => usage.name)).toEqual(['useBackgroundImage', 'useImage'])
    expect(composables[0]!.source.kind).toBe('public')
    expect(composables[1]!.source.kind).toBe('remote')
    expect(composables[1]!.props['widths']).toEqual({ kind: 'dynamic', expression: '[400]' })
  })

  it('finds h(VImage, …) and JSX usages without an edit target', () => {
    const render = usagesIn('src/render.tsx')
    expect(render).toHaveLength(2)
    expect(
      render.every((usage) => usage.source.kind === 'public' && usage.edit === undefined),
    ).toBe(true)
    expect(render[1]!.props['width']).toEqual({ kind: 'static', value: 10 })
  })

  it('detects the placeholders manifest registration', () => {
    expect(result.registration).toEqual({ found: true, where: ['src/main.ts:4'] })
  })

  it('reports unparsable SFCs without aborting the scan', () => {
    expect(result.parseErrors.some((error) => error.file === 'src/Broken.vue')).toBe(true)
    expect(result.filesScanned).toBeGreaterThan(5)
  })
})

describe('scanProject — registration variants', () => {
  it('detects provide(PLACEHOLDERS_KEY) and the Nuxt module option', async () => {
    const project = mkdtempSync(join(tmpdir(), 'vik-scan-reg-'))
    try {
      writeFileSync(
        join(project, 'nuxt.config.ts'),
        `export default defineNuxtConfig({ vueImageKit: { placeholders: './image-placeholders.ts' } })\n`,
      )
      mkdirSync(join(project, 'plugins'))
      writeFileSync(
        join(project, 'plugins', 'vik.ts'),
        `import { PLACEHOLDERS_KEY } from '@macrulez/vue-image-kit'\nexport default (app: any) => app.provide(PLACEHOLDERS_KEY, {})\n`,
      )
      const scanned = await scanProject(
        {
          root: project,
          include: DEFAULT_INCLUDE,
          exclude: DEFAULT_EXCLUDE,
          publicDir: join(project, 'public'),
          aliases: {},
          packageNames: ['@macrulez/vue-image-kit'],
        },
        { cdn: null },
      )
      expect(scanned.registration.where).toEqual(['nuxt.config.ts:1', 'plugins/vik.ts:2'])
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })

  it('accepts extra package names (e.g. a local alias of the package)', async () => {
    const project = mkdtempSync(join(tmpdir(), 'vik-scan-pkg-'))
    try {
      writeFileSync(
        join(project, 'App.vue'),
        `<script setup>\nimport { VImage as Pic } from 'vue-image-kit'\n</script>\n<template><Pic src="/a.jpg" alt="a" /></template>\n`,
      )
      const options = {
        root: project,
        include: DEFAULT_INCLUDE,
        exclude: DEFAULT_EXCLUDE,
        publicDir: join(project, 'public'),
        aliases: {},
      }
      const without = await scanProject(
        { ...options, packageNames: ['@macrulez/vue-image-kit'] },
        { cdn: null },
      )
      const withAlias = await scanProject(
        { ...options, packageNames: ['@macrulez/vue-image-kit', 'vue-image-kit'] },
        { cdn: null },
      )
      expect(without.usages).toHaveLength(0)
      expect(withAlias.usages).toHaveLength(1)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })
})

describe('scanProject — art-direction sources', () => {
  let project: string

  beforeAll(() => {
    project = mkdtempSync(join(tmpdir(), 'vik-scan-src-'))
    mkdirSync(join(project, 'public', 'images'), { recursive: true })
    writeFileSync(join(project, 'public', 'images', 'h.jpg'), 'x')
    writeFileSync(
      join(project, 'App.vue'),
      [
        '<script setup lang="ts">',
        "import local from './l.png'",
        'const shared = { tablet: "/images/h.jpg" }',
        '</script>',
        '<template>',
        '  <VImage',
        '    src="/images/h.jpg"',
        '    alt="A"',
        '    :sources="{',
        "      tablet: { src: '/images/h.jpg', width: 10, height: 5 },",
        "      mobile: '/images/h.jpg',",
        '      local: { src: local },',
        "      ready: { src: '/images/h.jpg', blurhash: 'abc' },",
        '      dyn: { src: item.src },',
        '      empty: {},',
        '    }"',
        '  />',
        '  <VImage src="/images/h.jpg" alt="B" :sources="shared" />',
        '</template>',
        '',
      ].join('\n'),
    )
    writeFileSync(join(project, 'l.png'), 'x')
  })

  afterAll(() => {
    rmSync(project, { recursive: true, force: true })
  })

  async function scanned() {
    return scanProject(
      {
        root: project,
        include: DEFAULT_INCLUDE,
        exclude: DEFAULT_EXCLUDE,
        publicDir: join(project, 'public'),
        aliases: {},
        packageNames: ['@macrulez/vue-image-kit'],
      },
      { cdn },
    )
  }

  it('lists every entry of a literal sources prop with its source, size and placeholder state', async () => {
    const [literal] = (await scanned()).usages
    const entries = literal!.sources!
    expect(entries.map((entry) => entry.key)).toEqual([
      'tablet',
      'mobile',
      'local',
      'ready',
      'dyn',
      'empty',
    ])
    expect(entries.map((entry) => entry.source.kind)).toEqual([
      'public',
      'public',
      'local-import',
      'public',
      'dynamic',
      'dynamic',
    ])
    expect(entries.map((entry) => entry.hasSize)).toEqual([true, false, false, false, false, false])
    expect(entries.map((entry) => entry.hasPlaceholder)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ])
  })

  it('computes edit spans that point at the right text inside the attribute', async () => {
    const [literal] = (await scanned()).usages
    const source = readFileSync(join(project, 'App.vue'), 'utf8')
    const byKey = Object.fromEntries(literal!.sources!.map((entry) => [entry.key, entry]))

    const tablet = byKey['tablet']!.edit!
    expect(tablet.kind).toBe('object')
    if (tablet.kind === 'object')
      expect(source.slice(tablet.insertOffset - 9, tablet.insertOffset)).toBe('height: 5')

    const mobile = byKey['mobile']!.edit!
    expect(mobile.kind).toBe('string')
    if (mobile.kind === 'string')
      expect(source.slice(mobile.start, mobile.end)).toBe("'/images/h.jpg'")
    expect(mobile.quote).toBe("'")
  })

  it('records sources reached through a const, without edit spans', async () => {
    const usages = (await scanned()).usages
    const second = usages[1]!
    expect(second.sources!.map((entry) => entry.key)).toEqual(['tablet'])
    expect(second.sources![0]!.edit).toBeUndefined()
  })
})
