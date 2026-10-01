import { execFileSync } from 'node:child_process'
import type { EditTarget } from '../scan/types.js'
import type { PlaceholderData, PlaceholderMode } from './compute.js'

export interface InsertEdit {
  target: EditTarget
  attributes: string[]
}

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

export function applyEdits(source: string, edits: InsertEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.target.insertOffset - a.target.insertOffset)
  let result = source
  for (const edit of ordered) {
    if (edit.attributes.length === 0) continue
    const { insertOffset, indent } = edit.target
    const inserted =
      indent === null
        ? edit.attributes.map((attribute) => ` ${attribute}`).join('')
        : edit.attributes.map((attribute) => `\n${indent}${attribute}`).join('')
    result = result.slice(0, insertOffset) + inserted + result.slice(insertOffset)
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
