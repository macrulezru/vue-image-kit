import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { loadConfig } from '../config.js'
import { scanProject } from '../scan/scanner.js'
import {
  renderCsv,
  renderJson,
  renderMarkdown,
  renderText,
  summarize,
  WARNING_CODES,
  type WarningCode,
} from '../scan/report.js'
import { DISCOVERY_HELP, DISCOVERY_OPTIONS, resolveDiscovery } from './discovery.js'

export const SCAN_HELP = `
vue-image-kit scan — report how vue-image-kit is used across the project

Finds every <VImage> (template, JSX, h()), v-lazy-img directive and
useImage()/useBackgroundImage() call, works out where each image comes from
(local import, public/, CDN, remote URL, ?vik manifest, dynamic) and prints a
summary with warnings.

Usage:
  npx vue-image-kit scan [options]

Options:
${DISCOVERY_HELP}
  --details            Also list every usage, and every location for each warning
  --top <n>            Number of files shown in the files table (default: 10)
  --format <fmt>       table (default), json, md or csv
  --out <file>         Write the report to a file instead of stdout
  --fail-on <codes>    Exit with code 1 if any of these warnings are found (comma-separated, or "any")
                       Codes: ${WARNING_CODES.join(', ')}
  --help               Show this help

Examples:
  npx vue-image-kit scan
  npx vue-image-kit scan --details --format md --out image-report.md
  npx vue-image-kit scan --fail-on missing-alt,missing-file
`

const FORMATS = new Set(['table', 'json', 'md', 'csv'])

export async function runScanCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ...DISCOVERY_OPTIONS,
      details: { type: 'boolean', default: false },
      top: { type: 'string' },
      format: { type: 'string' },
      out: { type: 'string' },
      'fail-on': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    console.log(SCAN_HELP)
    return 0
  }

  const format = values.format ?? 'table'
  if (!FORMATS.has(format))
    throw new Error(`--format must be one of table, json, md, csv (got "${format}")`)
  const top = values.top !== undefined ? parseInt(values.top, 10) : 10
  if (isNaN(top) || top < 1) throw new Error('--top must be a positive integer')

  let failOn: WarningCode[] = []
  if (values['fail-on']) {
    const requested = values['fail-on'].split(',').map((code) => code.trim())
    failOn = requested.includes('any') ? WARNING_CODES : (requested as WarningCode[])
    const unknown = failOn.filter((code) => !WARNING_CODES.includes(code))
    if (unknown.length > 0) throw new Error(`Unknown --fail-on code(s): ${unknown.join(', ')}`)
  }

  const fileConfig = await loadConfig(values.root ? resolve(values.root) : process.cwd())
  const options = await resolveDiscovery(values, fileConfig.scan)
  const result = await scanProject(options)
  const summary = summarize(result)
  const renderOptions = { details: values.details, top }

  const output =
    format === 'json'
      ? renderJson(result, summary)
      : format === 'md'
        ? renderMarkdown(result, summary, renderOptions)
        : format === 'csv'
          ? renderCsv(result)
          : `${renderText(result, summary, renderOptions)}\n`

  if (values.out) {
    const outPath = resolve(values.out)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, output, 'utf8')
    console.log(`[vue-image-kit] scan report written to ${values.out}`)
  } else {
    process.stdout.write(output)
  }

  const failing = summary.warnings.filter((warning) => failOn.includes(warning.code))
  if (failing.length > 0) {
    console.error(
      `[vue-image-kit] ${failing.length} warning(s) matched --fail-on (${[...new Set(failing.map((w) => w.code))].join(', ')})`,
    )
    return 1
  }
  return 0
}
