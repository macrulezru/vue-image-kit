import type { ImageUsage, PropValue, ScanResult } from './types.js'

export type WarningCode =
  | 'missing-alt'
  | 'empty-alt'
  | 'no-dimensions'
  | 'no-placeholder'
  | 'missing-file'
  | 'multiple-priority'
  | 'widths-without-sizes'
  | 'local-without-vik'

export const WARNING_CODES: WarningCode[] = [
  'missing-alt',
  'empty-alt',
  'no-dimensions',
  'no-placeholder',
  'missing-file',
  'multiple-priority',
  'widths-without-sizes',
  'local-without-vik',
]

const WARNING_TEXT: Record<WarningCode, string> = {
  'missing-alt': 'no alt text',
  'empty-alt': 'empty alt (fine only for purely decorative images)',
  'no-dimensions': 'no width/height — the browser cannot reserve space (layout shift)',
  'no-placeholder': 'no placeholder (blurhash/thumbhash/placeholder/placeholderColor)',
  'missing-file': 'referenced file does not exist',
  'multiple-priority': 'more than one `priority` image in the same file',
  'widths-without-sizes': '`widths` without `sizes` or `width` — the browser assumes 100vw',
  'local-without-vik':
    'local image imported without `?vik` — build-time placeholders are available for free',
}

export interface ScanWarning {
  code: WarningCode
  message: string
  usage: ImageUsage
}

export interface SourceSummaryRow {
  source: string
  usages: number
  components: number
  withSize: number
  withPlaceholder: number
  eager: number
}

export interface FileSummaryRow {
  file: string
  usages: number
  components: number
  directives: number
  composables: number
}

export interface ScanSummary {
  totalUsages: number
  bySource: SourceSummaryRow[]
  byFile: FileSummaryRow[]
  propUsage: { prop: string; count: number }[]
  warnings: ScanWarning[]
  fixablePlaceholders: number
}

const FIXABLE_KINDS = new Set(['public', 'local-import', 'server', 'cdn', 'remote'])

export const VIMAGE_PROPS = new Set([
  'src',
  'image',
  'alt',
  'width',
  'height',
  'blurhash',
  'thumbhash',
  'placeholder',
  'placeholderMode',
  'placeholderColor',
  'widths',
  'densities',
  'sizes',
  'breakpoints',
  'sources',
  'lazy',
  'rootMargin',
  'threshold',
  'fit',
  'focal',
  'maxRetries',
  'retryDelay',
  'fetchpriority',
  'decoding',
  'priority',
  'respectSaveData',
  'layout',
  'cdn',
  'loader',
  'loaderRoute',
  'fadeIn',
])

function isTrue(value: PropValue | undefined): boolean {
  return (
    !!value &&
    (value.kind === 'dynamic' ||
      value.value === true ||
      value.value === '' ||
      value.value === 'true')
  )
}

function isSpread(usage: ImageUsage): boolean {
  return 'v-bind' in usage.props || '...' in usage.props
}

export function sourceLabel(usage: ImageUsage): string {
  return usage.source.kind === 'cdn' && usage.source.provider
    ? `cdn:${usage.source.provider}`
    : usage.source.kind
}

export function isPlaceholderFixable(usage: ImageUsage): boolean {
  if (usage.kind !== 'component' || usage.hasPlaceholder || isSpread(usage)) return false
  if (!FIXABLE_KINDS.has(usage.source.kind)) return false
  return usage.source.fileExists !== false
}

function hasSize(usage: ImageUsage): boolean {
  return ('width' in usage.props && 'height' in usage.props) || 'image' in usage.props
}

function isEager(usage: ImageUsage): boolean {
  const lazy = usage.props['lazy']
  return (
    isTrue(usage.props['priority']) ||
    (lazy?.kind === 'static' && (lazy.value === false || lazy.value === 'false'))
  )
}

export function collectWarnings(usages: ImageUsage[]): ScanWarning[] {
  const warnings: ScanWarning[] = []
  const add = (code: WarningCode, usage: ImageUsage) =>
    warnings.push({ code, message: WARNING_TEXT[code], usage })
  const priorityByFile = new Map<string, ImageUsage[]>()

  for (const usage of usages) {
    if (
      (usage.source.kind === 'public' ||
        usage.source.kind === 'local-import' ||
        usage.source.kind === 'server') &&
      usage.source.fileExists === false
    ) {
      add('missing-file', usage)
    }
    if (usage.kind !== 'component') continue
    const spread = isSpread(usage)
    const alt = usage.props['alt']
    if (!alt && !spread) add('missing-alt', usage)
    else if (alt?.kind === 'static' && alt.value === '') add('empty-alt', usage)

    const layout = usage.props['layout']
    const isFill = layout?.kind === 'static' && layout.value === 'fill'
    if (!spread && !isFill && !hasSize(usage)) add('no-dimensions', usage)
    if (!spread && !usage.hasPlaceholder) add('no-placeholder', usage)
    if (
      'widths' in usage.props &&
      !('sizes' in usage.props) &&
      !('width' in usage.props) &&
      !isFill
    ) {
      add('widths-without-sizes', usage)
    }
    if (usage.source.kind === 'local-import') add('local-without-vik', usage)
    if (isTrue(usage.props['priority'])) {
      const list = priorityByFile.get(usage.file) ?? []
      list.push(usage)
      priorityByFile.set(usage.file, list)
    }
  }

  for (const list of priorityByFile.values()) {
    if (list.length > 1) for (const usage of list.slice(1)) add('multiple-priority', usage)
  }
  return warnings
}

export function summarize(result: ScanResult): ScanSummary {
  const sources = new Map<string, SourceSummaryRow>()
  const files = new Map<string, FileSummaryRow>()
  const props = new Map<string, number>()

  for (const usage of result.usages) {
    const label = sourceLabel(usage)
    const row = sources.get(label) ?? {
      source: label,
      usages: 0,
      components: 0,
      withSize: 0,
      withPlaceholder: 0,
      eager: 0,
    }
    row.usages++
    if (usage.kind === 'component') {
      row.components++
      if (hasSize(usage)) row.withSize++
      if (usage.hasPlaceholder) row.withPlaceholder++
      if (isEager(usage)) row.eager++
      for (const prop of Object.keys(usage.props)) {
        if (VIMAGE_PROPS.has(prop)) props.set(prop, (props.get(prop) ?? 0) + 1)
      }
    }
    sources.set(label, row)

    const fileRow = files.get(usage.file) ?? {
      file: usage.file,
      usages: 0,
      components: 0,
      directives: 0,
      composables: 0,
    }
    fileRow.usages++
    if (usage.kind === 'component') fileRow.components++
    else if (usage.kind === 'directive') fileRow.directives++
    else fileRow.composables++
    files.set(usage.file, fileRow)
  }

  return {
    totalUsages: result.usages.length,
    bySource: [...sources.values()].sort(
      (a, b) => b.usages - a.usages || a.source.localeCompare(b.source),
    ),
    byFile: [...files.values()].sort((a, b) => b.usages - a.usages || a.file.localeCompare(b.file)),
    propUsage: [...props.entries()]
      .map(([prop, count]) => ({ prop, count }))
      .sort((a, b) => b.count - a.count || a.prop.localeCompare(b.prop)),
    warnings: collectWarnings(result.usages),
    fixablePlaceholders: result.usages.filter(isPlaceholderFixable).length,
  }
}

export function truncate(value: string, max = 48): string {
  const single = value.replace(/\s+/g, ' ')
  return single.length > max ? `${single.slice(0, max - 1)}…` : single
}

export function renderTable(headers: string[], rows: string[][], numeric: boolean[] = []): string {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => (row[i] ?? '').length)),
  )
  const pad = (cell: string, i: number) =>
    numeric[i] ? cell.padStart(widths[i]!) : cell.padEnd(widths[i]!)
  const line = (cells: string[]) => `  ${cells.map(pad).join('  ')}`.trimEnd()
  return [
    line(headers),
    `  ${widths.map((w) => '─'.repeat(w)).join('  ')}`,
    ...rows.map(line),
  ].join('\n')
}

function renderMarkdownTable(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => cell.replace(/\|/g, '\\|')
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n')
}

export function usageValue(usage: ImageUsage): string {
  return usage.source.value ?? usage.source.expression ?? ''
}

function propList(usage: ImageUsage): string {
  return Object.keys(usage.props).join(', ')
}

function sourceRows(summary: ScanSummary): string[][] {
  return summary.bySource.map((row) => [
    row.source,
    String(row.usages),
    String(row.components),
    row.components ? String(row.withSize) : '—',
    row.components ? String(row.withPlaceholder) : '—',
    row.components ? String(row.eager) : '—',
  ])
}

const SOURCE_HEADERS = ['Source', 'Usages', 'VImage', 'w/ size', 'w/ placeholder', 'eager']
const FILE_HEADERS = ['File', 'Usages', 'VImage', 'v-lazy-img', 'composables']
const DETAIL_HEADERS = ['Location', 'Usage', 'Source', 'Value', 'Props']

function fileRows(summary: ScanSummary, top: number): string[][] {
  return summary.byFile
    .slice(0, top)
    .map((row) => [
      row.file,
      String(row.usages),
      String(row.components),
      String(row.directives),
      String(row.composables),
    ])
}

function detailRows(result: ScanResult): string[][] {
  return result.usages.map((usage) => [
    `${usage.file}:${usage.line}`,
    usage.name,
    sourceLabel(usage),
    truncate(usageValue(usage)),
    truncate(propList(usage), 60),
  ])
}

function groupWarnings(warnings: ScanWarning[]): Map<WarningCode, ScanWarning[]> {
  const grouped = new Map<WarningCode, ScanWarning[]>()
  for (const code of WARNING_CODES) {
    const list = warnings.filter((warning) => warning.code === code)
    if (list.length > 0) grouped.set(code, list)
  }
  return grouped
}

export interface RenderOptions {
  details: boolean
  top: number
}

export function renderText(
  result: ScanResult,
  summary: ScanSummary,
  options: RenderOptions,
): string {
  const out: string[] = []
  out.push(
    `[vue-image-kit] scan — ${summary.totalUsages} usage${summary.totalUsages === 1 ? '' : 's'} in ${result.filesWithUsages} file${result.filesWithUsages === 1 ? '' : 's'} (${result.filesScanned} scanned)`,
  )
  if (summary.totalUsages === 0) {
    out.push('', '  No VImage, v-lazy-img, useImage or useBackgroundImage usages found.')
    return out.join('\n')
  }

  out.push(
    '',
    'By source',
    renderTable(SOURCE_HEADERS, sourceRows(summary), [false, true, true, true, true, true]),
  )
  out.push(
    '',
    summary.byFile.length > options.top ? `Top ${options.top} files` : 'Files',
    renderTable(FILE_HEADERS, fileRows(summary, options.top), [false, true, true, true, true]),
  )
  if (summary.propUsage.length > 0) {
    out.push(
      '',
      'VImage props',
      `  ${summary.propUsage.map(({ prop, count }) => `${prop} ${count}`).join(' · ')}`,
    )
  }

  const grouped = groupWarnings(summary.warnings)
  if (grouped.size > 0) {
    out.push('', 'Warnings')
    for (const [code, list] of grouped) {
      out.push(`  ${String(list.length).padStart(4)} × ${code} — ${WARNING_TEXT[code]}`)
      const shown = options.details ? list : list.slice(0, 3)
      for (const warning of shown) out.push(`         ${warning.usage.file}:${warning.usage.line}`)
      if (shown.length < list.length)
        out.push(`         … ${list.length - shown.length} more (use --details)`)
    }
  }
  if (summary.fixablePlaceholders > 0) {
    out.push(
      '',
      `  ${summary.fixablePlaceholders} usage${summary.fixablePlaceholders === 1 ? '' : 's'} without a placeholder can be filled in by \`vue-image-kit placeholders\`.`,
    )
  }
  const dynamic = result.usages.filter((usage) => usage.source.kind === 'dynamic').length
  if (dynamic > 0) {
    out.push(
      `  ${dynamic} usage${dynamic === 1 ? ' has a source' : 's have sources'} that can't be resolved statically (shown as "dynamic").`,
    )
  }
  if (result.parseErrors.length > 0) {
    out.push('', 'Parse errors')
    for (const error of result.parseErrors) out.push(`  ${error.file}: ${error.message}`)
  }
  if (options.details) {
    out.push('', 'Usages', renderTable(DETAIL_HEADERS, detailRows(result)))
  }
  return out.join('\n')
}

export function renderMarkdown(
  result: ScanResult,
  summary: ScanSummary,
  options: RenderOptions,
): string {
  const out: string[] = [
    '# vue-image-kit usage report',
    '',
    `${summary.totalUsages} usages in ${result.filesWithUsages} files (${result.filesScanned} scanned).`,
    '',
    '## By source',
    '',
    renderMarkdownTable(SOURCE_HEADERS, sourceRows(summary)),
    '',
    '## Files',
    '',
    renderMarkdownTable(FILE_HEADERS, fileRows(summary, options.details ? Infinity : options.top)),
  ]
  if (summary.propUsage.length > 0) {
    out.push(
      '',
      '## VImage props',
      '',
      renderMarkdownTable(
        ['Prop', 'Usages'],
        summary.propUsage.map(({ prop, count }) => [`\`${prop}\``, String(count)]),
      ),
    )
  }
  const grouped = groupWarnings(summary.warnings)
  if (grouped.size > 0) {
    out.push('', '## Warnings', '')
    for (const [code, list] of grouped) {
      out.push(`- **${code}** (${list.length}) — ${WARNING_TEXT[code]}`)
      for (const warning of list) out.push(`  - \`${warning.usage.file}:${warning.usage.line}\``)
    }
  }
  out.push(
    '',
    '## Usages',
    '',
    renderMarkdownTable(
      DETAIL_HEADERS,
      detailRows(result).map((row) =>
        row.map((cell, i) => (i === 0 || i === 3 ? `\`${cell}\`` : cell)),
      ),
    ),
  )
  return `${out.join('\n')}\n`
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function renderCsv(result: ScanResult): string {
  const headers = [
    'file',
    'line',
    'usage',
    'kind',
    'source',
    'provider',
    'value',
    'file_exists',
    'has_placeholder',
    'props',
  ]
  const rows = result.usages.map((usage) => [
    usage.file,
    String(usage.line),
    usage.name,
    usage.kind,
    usage.source.kind,
    usage.source.provider ?? '',
    usageValue(usage),
    usage.source.fileExists === undefined ? '' : String(usage.source.fileExists),
    String(usage.hasPlaceholder),
    JSON.stringify(usage.props),
  ])
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

export function renderJson(result: ScanResult, summary: ScanSummary): string {
  return `${JSON.stringify(
    {
      root: result.root,
      filesScanned: result.filesScanned,
      filesWithUsages: result.filesWithUsages,
      summary: {
        totalUsages: summary.totalUsages,
        bySource: summary.bySource,
        byFile: summary.byFile,
        propUsage: summary.propUsage,
        fixablePlaceholders: summary.fixablePlaceholders,
      },
      warnings: summary.warnings.map((warning) => ({
        code: warning.code,
        message: warning.message,
        file: warning.usage.file,
        line: warning.usage.line,
      })),
      usages: result.usages.map(({ absFile: _absFile, edit: _edit, ...usage }) => usage),
      registration: result.registration,
      parseErrors: result.parseErrors,
    },
    null,
    2,
  )}\n`
}
