import { describe, it, expect } from 'vitest'
import {
  collectWarnings,
  isPlaceholderFixable,
  renderCsv,
  renderJson,
  renderMarkdown,
  renderTable,
  renderText,
  summarize,
} from '../../src/cli/scan/report'
import type { ImageUsage, PropValue, ScanResult } from '../../src/cli/scan/types'

function usage(overrides: Partial<ImageUsage> & { props?: Record<string, PropValue> }): ImageUsage {
  return {
    file: 'src/App.vue',
    absFile: '/p/src/App.vue',
    line: 1,
    column: 0,
    kind: 'component',
    name: 'VImage',
    props: {},
    source: { kind: 'public', value: '/a.jpg', fileExists: true },
    hasPlaceholder: false,
    ...overrides,
  }
}

const s = (value: string | number | boolean): PropValue => ({ kind: 'static', value })

function result(usages: ImageUsage[]): ScanResult {
  return {
    root: '/p',
    filesScanned: 10,
    filesWithUsages: new Set(usages.map((u) => u.file)).size,
    usages,
    registration: { found: false, where: [] },
    parseErrors: [],
  }
}

describe('collectWarnings', () => {
  it('flags alt, size, placeholder, file and sizes problems', () => {
    const warnings = collectWarnings([
      usage({ props: { src: s('/a.jpg') } }),
      usage({
        line: 2,
        props: { alt: s(''), width: s(1), height: s(1), blurhash: s('x') },
        hasPlaceholder: true,
      }),
      usage({
        line: 3,
        props: { alt: s('x'), widths: s(1) },
        source: { kind: 'public', value: '/b.jpg', fileExists: false },
      }),
      usage({
        line: 4,
        props: { alt: s('x'), layout: s('fill') },
        source: { kind: 'local-import', value: './c.png', fileExists: true },
      }),
    ])
    const codes = warnings.map((w) => `${w.code}@${w.usage.line}`)
    expect(codes).toEqual([
      'missing-alt@1',
      'no-dimensions@1',
      'no-placeholder@1',
      'empty-alt@2',
      'missing-file@3',
      'no-dimensions@3',
      'no-placeholder@3',
      'widths-without-sizes@3',
      'no-placeholder@4',
      'local-without-vik@4',
    ])
  })

  it('skips prop-based checks for v-bind spreads and flags extra priority images per file', () => {
    const warnings = collectWarnings([
      usage({ props: { 'v-bind': { kind: 'dynamic', expression: 'attrs' } } }),
      usage({
        line: 2,
        props: { alt: s('a'), width: s(1), height: s(1), priority: s(true) },
        hasPlaceholder: true,
      }),
      usage({
        line: 3,
        props: { alt: s('a'), width: s(1), height: s(1), priority: s('') },
        hasPlaceholder: true,
      }),
    ])
    expect(warnings.map((w) => `${w.code}@${w.usage.line}`)).toEqual(['multiple-priority@3'])
  })
})

describe('summarize', () => {
  const data = result([
    usage({ props: { alt: s('a'), width: s(1), height: s(1), lazy: s(false), key: s('k') } }),
    usage({
      file: 'src/B.vue',
      props: { alt: s('a') },
      source: { kind: 'cdn', provider: 'imgix', value: 'https://x.imgix.net/a.jpg' },
    }),
    usage({
      file: 'src/B.vue',
      kind: 'directive',
      name: 'v-lazy-img',
      source: { kind: 'dynamic', expression: 'x' },
    }),
    usage({
      file: 'src/B.vue',
      kind: 'composable',
      name: 'useImage',
      props: {},
      source: { kind: 'dynamic', expression: 'y' },
    }),
  ])
  const summary = summarize(data)

  it('groups by source (with the CDN provider) and by file', () => {
    expect(summary.bySource.map((row) => row.source)).toEqual(['dynamic', 'cdn:imgix', 'public'])
    expect(summary.bySource.find((row) => row.source === 'public')).toMatchObject({
      withSize: 1,
      eager: 1,
    })
    expect(summary.byFile[0]).toMatchObject({
      file: 'src/B.vue',
      usages: 3,
      components: 1,
      directives: 1,
      composables: 1,
    })
  })

  it('counts only real VImage props and fixable placeholders', () => {
    expect(summary.propUsage.map((p) => p.prop)).toEqual(['alt', 'height', 'lazy', 'width'])
    expect(summary.fixablePlaceholders).toBe(2)
    expect(isPlaceholderFixable(data.usages[2]!)).toBe(false)
  })

  it('renders every output format', () => {
    const text = renderText(data, summary, { details: true, top: 10 })
    expect(text).toContain('scan — 4 usages in 2 files (10 scanned)')
    expect(text).toContain('cdn:imgix')
    expect(text).toContain('src/B.vue:1')
    expect(text).toContain('2 usages have sources that can')

    const md = renderMarkdown(data, summary, { details: false, top: 10 })
    expect(md).toContain('| Source | Usages | VImage | w/ size | w/ placeholder | eager |')
    expect(md).toContain('- **no-placeholder** (2)')

    const csv = renderCsv(data).trim().split('\n')
    expect(csv[0]).toBe(
      'file,line,usage,kind,source,provider,value,file_exists,has_placeholder,props',
    )
    expect(csv).toHaveLength(5)
    expect(csv[1]).toContain('"{""alt"":')

    const json = JSON.parse(renderJson(data, summary)) as {
      usages: Record<string, unknown>[]
      warnings: unknown[]
    }
    expect(json.usages[0]).not.toHaveProperty('absFile')
    expect(json.warnings.length).toBe(summary.warnings.length)
  })

  it('says so when nothing is found', () => {
    const empty = result([])
    expect(renderText(empty, summarize(empty), { details: false, top: 10 })).toContain('No VImage')
  })
})

describe('renderTable', () => {
  it('pads columns and right-aligns numeric ones', () => {
    expect(
      renderTable(
        ['Name', 'N'],
        [
          ['a', '1'],
          ['bbb', '22'],
        ],
        [false, true],
      ),
    ).toBe(['  Name   N', '  ────  ──', '  a      1', '  bbb   22'].join('\n'))
  })
})
