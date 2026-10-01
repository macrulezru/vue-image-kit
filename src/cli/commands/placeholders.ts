import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { loadConfig } from '../config.js'
import { loadSharp, loadThumbhash } from '../deps.js'
import { loadCdnModule } from '../cdn-bridge.js'
import { createProgramParser, loadCompiler, scanProject } from '../scan/scanner.js'
import { findNuxtConfig, nuxtSrcDir } from '../scan/aliases.js'
import { loadCache, saveCache } from '../placeholders/cache.js'
import type { PlaceholderMode } from '../placeholders/compute.js'
import { runPlaceholders, type PlaceholdersReport, type SkipReason } from '../placeholders/run.js'
import {
  DEFAULT_PACKAGE_NAME,
  DISCOVERY_HELP,
  DISCOVERY_OPTIONS,
  resolveDiscovery,
} from './discovery.js'

export const PLACEHOLDERS_HELP = `
vue-image-kit placeholders — generate blurhash/thumbhash/dominant-color placeholders
for <VImage> usages that don't have one yet

Every <VImage> whose source can be resolved statically (a public/ path, a local
import, a CDN or remote URL) gets its placeholder computed from the real image.
The result is delivered one of two ways, chosen per usage:
  • manifest — written to a placeholders manifest that <VImage> looks up at
    runtime by src (needs the manifest registered once, see below);
  • source  — written straight into the template as props, used for local
    imports (their runtime URL is a hashed build URL) and whenever no
    manifest registration is found in the project.

Usage:
  npx vue-image-kit placeholders [options]

Options:
${DISCOVERY_HELP}
  --manifest <path>    Placeholders manifest, .ts or .json (default: src/image-placeholders.ts)
  --mode <mode>        blurhash (default), thumbhash or color (the image's dominant color)
  --remote             Also download CDN/remote images (off by default — a project may reference thousands)
  --hosts <list>       With --remote: only these hosts (comma-separated; subdomains included)
  --limit <n>          With --remote: download at most n images in this run
  --concurrency <n>    Parallel image jobs (default: 4)
  --timeout <ms>       Per-request timeout for remote images (default: 15000)
  --max-bytes <n>      Skip remote images larger than this many bytes (default: 15728640)
  --dry-run            Show what would change without writing anything
  --no-write           Never edit source files — only write the manifest
  --force-write        Edit source files even if they have uncommitted changes
  --no-cache           Recompute every placeholder, ignoring the cache
  --refresh-remote     Re-download remote images even if they are cached
  --replace            Also redo usages that already have a placeholder: their static blurhash/
                       thumbhash/placeholder/placeholder-color/placeholder-mode attributes are
                       removed and replaced by the --mode placeholder (bound values and :image are kept)
  --help               Show this help

Registering the manifest:
  app.use(VImageKitPlugin, { placeholders })           // import placeholders from './image-placeholders'
  vueImageKit: { placeholders: './image-placeholders.ts' }   // nuxt.config.ts

Examples:
  npx vue-image-kit placeholders --dry-run
  npx vue-image-kit placeholders --mode color
  npx vue-image-kit placeholders --remote --hosts res.cloudinary.com --limit 200
`

const MODES = new Set<PlaceholderMode>(['blurhash', 'thumbhash', 'color'])

const SKIP_TEXT: Record<SkipReason, string> = {
  'has-placeholder': 'already have a placeholder (use --replace to redo static ones)',
  'dynamic-placeholder': 'have a placeholder bound to an expression, which --replace leaves alone',
  dynamic: 'have a dynamic src',
  'not-supported': 'use a source that has no image file (data: URI, empty src)',
  'missing-file': 'point at a file that does not exist',
  'remote-disabled': 'are CDN/remote images (add --remote)',
  'host-not-allowed': 'are on a host outside --hosts',
  limit: 'were over the --limit',
  'not-editable': 'are not in a .vue template (JSX/h()) and need the manifest registered',
  failed: 'failed to process',
  'write-disabled': 'need a source edit, skipped by --no-write',
  dirty: 'are in files with uncommitted changes (commit/stash, or use --force-write)',
}

function positiveInt(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`)
  return parsed
}

export function defaultManifestPath(root: string): string {
  if (findNuxtConfig(root)) return join(nuxtSrcDir(root), 'image-placeholders.ts')
  return existsSync(join(root, 'src'))
    ? join(root, 'src', 'image-placeholders.ts')
    : join(root, 'image-placeholders.ts')
}

function printReport(report: PlaceholdersReport, dryRun: boolean): void {
  const prefix = dryRun ? '(dry-run) ' : ''
  const computed = report.computed.local + report.computed.remote
  console.log(`[vue-image-kit] placeholders — mode: ${report.mode}`)
  console.log(
    `  Images: ${computed} computed (${report.computed.local} local, ${report.computed.remote} remote) · ${report.cached} from cache · ${report.failures.length} failed`,
  )
  if (report.manifestPath) {
    const state = dryRun ? 'would be written' : report.manifestChanged ? 'written' : 'unchanged'
    console.log(`  Manifest: ${report.manifestUsages} usage(s) → ${report.manifestPath} (${state})`)
  }
  if (report.sourceEntries > 0) {
    console.log(
      `  Art-direction sources: ${report.sourceEntries} of the usages above are \`sources\` entries`,
    )
  }
  if (report.codemodUsages > 0) {
    console.log(
      `  ${prefix}Source edits: ${report.codemodUsages} usage(s) in ${report.codemodFiles.length} file(s)${report.replaced > 0 ? `, ${report.replaced} replacing an existing placeholder` : ''}`,
    )
    if (dryRun) {
      for (const item of report.codemodPreview) {
        const removed = item.removed.map((name) => `- ${name}`)
        const added =
          item.attributes.length > 0 ? [`+ ${item.attributes.join(' ')}`] : ['(value → manifest)']
        console.log(`    ${item.file}:${item.line}  ${[...removed, ...added].join('  ')}`)
      }
    } else {
      for (const file of report.codemodFiles) console.log(`    ${file}`)
    }
  }
  const skipped = Object.entries(report.skipped) as [SkipReason, number][]
  if (skipped.length > 0) {
    console.log('  Skipped:')
    for (const [reason, count] of skipped)
      console.log(`    ${String(count).padStart(4)} usage(s) ${SKIP_TEXT[reason]}`)
  }
  for (const failure of report.failures) console.log(`  ✗ ${failure.key}: ${failure.message}`)
  if (report.dirty.length > 0) {
    console.log('  Files with uncommitted changes:')
    for (const file of report.dirty) console.log(`    ${file}`)
  }
  if (!report.registrationFound && report.fellBackToCodemod > 0) {
    console.log(
      `\n  No placeholders manifest registration was found, so public/CDN/remote images ${dryRun ? 'would be' : 'were'} written into the\n` +
        '  templates. Register the manifest once to keep them out of your source instead:\n' +
        '    app.use(VImageKitPlugin, { placeholders })              // Vue\n' +
        "    vueImageKit: { placeholders: './image-placeholders.ts' } // nuxt.config.ts",
    )
  }
}

export async function runPlaceholdersCommand(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      ...DISCOVERY_OPTIONS,
      manifest: { type: 'string' },
      mode: { type: 'string' },
      remote: { type: 'boolean', default: false },
      hosts: { type: 'string' },
      limit: { type: 'string' },
      concurrency: { type: 'string' },
      timeout: { type: 'string' },
      'max-bytes': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'no-write': { type: 'boolean', default: false },
      'force-write': { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
      'refresh-remote': { type: 'boolean', default: false },
      replace: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })

  if (values.help) {
    console.log(PLACEHOLDERS_HELP)
    return 0
  }

  const fileConfig = await loadConfig(values.root ? resolve(values.root) : process.cwd())
  const config = fileConfig.placeholders ?? {}
  const mode = (values.mode ?? config.mode ?? 'blurhash') as PlaceholderMode
  if (!MODES.has(mode))
    throw new Error(`--mode must be blurhash, thumbhash or color (got "${values.mode}")`)

  const scanOptions = await resolveDiscovery(values, { ...(fileConfig.scan ?? {}), ...config })
  const manifestSetting = values.manifest ?? config.manifest
  const manifest = manifestSetting
    ? isAbsolute(manifestSetting)
      ? manifestSetting
      : resolve(scanOptions.root, manifestSetting)
    : defaultManifestPath(scanOptions.root)
  const typeImport =
    scanOptions.packageNames.find((name) => name !== DEFAULT_PACKAGE_NAME) ?? DEFAULT_PACKAGE_NAME

  const sharp = await loadSharp('placeholders')
  const rgbaToThumbHash = mode === 'thumbhash' ? await loadThumbhash('placeholders') : undefined
  const cdn = await loadCdnModule()
  const compiler = await loadCompiler()
  const scan = await scanProject(scanOptions, { cdn, compiler })
  const cache = values['no-cache']
    ? { version: 1 as const, entries: {} }
    : loadCache(scanOptions.root)

  const report = await runPlaceholders(
    scan,
    {
      root: scanOptions.root,
      mode,
      manifest,
      typeImport,
      remote: values.remote || config.remote === true,
      hosts: (values.hosts?.split(',') ?? config.hosts ?? [])
        .map((host) => host.trim())
        .filter(Boolean),
      limit: positiveInt(values.limit, '--limit') ?? config.limit ?? 0,
      concurrency: positiveInt(values.concurrency, '--concurrency') ?? config.concurrency ?? 4,
      timeout: positiveInt(values.timeout, '--timeout') ?? config.timeout ?? 15000,
      maxBytes:
        positiveInt(values['max-bytes'], '--max-bytes') ?? config.maxBytes ?? 15 * 1024 * 1024,
      dryRun: values['dry-run'],
      write: !values['no-write'],
      forceWrite: values['force-write'],
      refreshRemote: values['refresh-remote'],
      replace: values.replace || config.replace === true,
    },
    {
      sharp,
      ...(rgbaToThumbHash ? { rgbaToThumbHash } : {}),
      cdn,
      cache,
      parseProgram: createProgramParser(compiler),
    },
  )

  if (!values['dry-run']) saveCache(scanOptions.root, cache)
  printReport(report, values['dry-run'])
  return report.failures.length > 0 ? 1 : 0
}
