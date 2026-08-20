import { relative } from 'node:path'
import type { ProcessedImage } from './types.js'

function toRelative(absPath: string): string {
  const rel = relative(process.cwd(), absPath).replace(/\\/g, '/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

function formatBytes(bytes: number): string {
  if (bytes < 0) return '—'
  return `${(bytes / 1024).toFixed(1)} KB`
}

// Aggregate totals can run into MB — auto-scales instead of printing e.g. "4213.7 KB".
function formatTotalBytes(bytes: number): string {
  const kb = bytes / 1024
  return kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`
}

function padRight(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - s.length))
}

function padLeft(s: string, width: number): string {
  return ' '.repeat(Math.max(0, width - s.length)) + s
}

/**
 * Prints a detailed per-image block: source path/format/dimensions/size, then
 * one aligned line per output variant (path, format, dimensions, size — with
 * a `(existing)` or `(dry-run — not written)` suffix where relevant).
 */
export function printImageReport(image: ProcessedImage): void {
  console.log(`[vue-image-kit] ${image.name}`)
  console.log(`  Input   ${toRelative(image.srcAbsPath)}`)
  console.log(`          ${image.originalFormat} · ${image.originalWidth}×${image.originalHeight} · ${formatBytes(image.originalSizeBytes)}`)

  if (image.variants.length === 0) return

  console.log('  Output')

  const rows = image.variants.map((v) => ({
    path: toRelative(v.absPath),
    format: v.format,
    dims: `${v.width}×${v.height}`,
    size: formatBytes(v.sizeBytes),
    suffix: v.skipped ? ' (existing)' : v.sizeBytes < 0 ? ' (dry-run — not written)' : '',
  }))

  const pathWidth = Math.max(...rows.map((r) => r.path.length))
  const formatWidth = Math.max(...rows.map((r) => r.format.length))
  const dimsWidth = Math.max(...rows.map((r) => r.dims.length))
  const sizeWidth = Math.max(...rows.map((r) => r.size.length))

  for (const r of rows) {
    console.log(
      `    ${padRight(r.path, pathWidth)}  ${padRight(r.format, formatWidth)}  ${padLeft(r.dims, dimsWidth)}  ${padLeft(r.size, sizeWidth)}${r.suffix}`,
    )
  }
}

/**
 * Prints the batch total after all images in a `generate()` run are
 * processed: image/file counts, total input vs. output size, and how much
 * the *smallest available format* saves vs. the original on average.
 *
 * That last number deliberately isn't "total output vs. total input" — with
 * multiple widths × formats generated per image, total output is naturally
 * many times the single original's size, which would read as "this made
 * things worse" when it didn't. Comparing each image's lightest variant
 * (whichever format ends up smallest) against its original answers the
 * question that actually matters: how much smaller can this get.
 */
export function printBatchSummary(images: ProcessedImage[]): void {
  const fileCount = images.reduce((n, img) => n + img.variants.length, 0)
  console.log(`[vue-image-kit] Done. ${images.length} image(s) → ${fileCount} file(s).`)

  const totalInputBytes = images.reduce((sum, img) => sum + Math.max(img.originalSizeBytes, 0), 0)
  const totalOutputBytes = images.reduce(
    (sum, img) => sum + img.variants.reduce((m, v) => m + Math.max(v.sizeBytes, 0), 0),
    0,
  )
  if (totalInputBytes <= 0 || totalOutputBytes <= 0) return // dry-run or unreadable — nothing meaningful to add

  const totalSmallestBytes = images.reduce((sum, img) => {
    const smallest = img.variants.reduce(
      (min, v) => (v.sizeBytes >= 0 && v.sizeBytes < min ? v.sizeBytes : min),
      Infinity,
    )
    return sum + (smallest === Infinity ? 0 : smallest)
  }, 0)

  console.log(`  Input:  ${images.length} image(s), ${formatTotalBytes(totalInputBytes)} total`)
  console.log(`  Output: ${fileCount} file(s), ${formatTotalBytes(totalOutputBytes)} total`)

  if (totalSmallestBytes > 0) {
    const savingsPct = Math.round((1 - totalSmallestBytes / totalInputBytes) * 100)
    const direction = savingsPct >= 0 ? 'saves' : 'is'
    const magnitude = Math.abs(savingsPct)
    console.log(`  Smallest available format ${direction} ~${magnitude}% ${savingsPct >= 0 ? 'vs. original, on average' : 'bigger than the original, on average'}`)
  }
}
