import { execFileSync } from 'node:child_process'
import type { EditTarget } from '../scan/types.js'
import type { PlaceholderData, PlaceholderMode } from './compute.js'

export interface InsertEdit {
  target: EditTarget
  attributes: string[]
  remove?: string[]
}

export const REPLACEABLE_PROPS = [
  'blurhash',
  'thumbhash',
  'placeholder',
  'placeholderColor',
  'placeholderMode',
]

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function placeholderAttributes(
  data: PlaceholderData,
  mode: PlaceholderMode,
  addSize: boolean,
): string[] {
  const attributes: string[] = []
  if (addSize && data.width && data.height) {
    attributes.push(`:width="${data.width}"`, `:height="${data.height}"`)
  }
  if (mode === 'blurhash' && data.blurhash)
    attributes.push(`blurhash="${escapeAttribute(data.blurhash)}"`)
  else if (mode === 'thumbhash' && data.thumbhash)
    attributes.push(`thumbhash="${escapeAttribute(data.thumbhash)}"`)
  else if (data.color && (mode === 'color' || (!data.blurhash && !data.thumbhash))) {
    attributes.push(`placeholder-color="${escapeAttribute(data.color)}"`)
  }
  return attributes
}

interface TextOperation {
  start: number
  end: number
  text: string
}

function removalStart(source: string, start: number): number {
  let index = start
  while (index > 0 && /\s/.test(source[index - 1]!)) index--
  return index
}

function operationsFor(source: string, edit: InsertEdit): TextOperation[] {
  const remove = new Set(edit.remove ?? [])
  const { attributes, tagEnd, indent } = edit.target
  const removed = attributes.filter((attribute) => remove.has(attribute.name))
  const kept = attributes.filter((attribute) => !remove.has(attribute.name))
  const operations: TextOperation[] = removed.map((attribute) => ({
    start: removalStart(source, attribute.start),
    end: attribute.end,
    text: '',
  }))
  if (edit.attributes.length > 0) {
    const insertAt =
      removed.length === 0
        ? edit.target.insertOffset
        : kept.reduce((max, attribute) => Math.max(max, attribute.end), tagEnd)
    const text =
      indent === null
        ? edit.attributes.map((attribute) => ` ${attribute}`).join('')
        : edit.attributes.map((attribute) => `\n${indent}${attribute}`).join('')
    operations.push({ start: insertAt, end: insertAt, text })
  }
  return operations
}

export function applyEdits(source: string, edits: InsertEdit[]): string {
  const operations = edits
    .flatMap((edit) => operationsFor(source, edit))
    .sort((a, b) => b.start - a.start || b.end - a.end)
  let result = source
  for (const operation of operations) {
    result = result.slice(0, operation.start) + operation.text + result.slice(operation.end)
  }
  return result
}

export function dirtyFiles(root: string, files: string[]): string[] | null {
  if (files.length === 0) return []
  try {
    const output = execFileSync('git', ['status', '--porcelain', '--', ...files], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
      .split('\n')
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
  } catch {
    return null
  }
}
