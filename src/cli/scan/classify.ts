import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveModulePath, type AliasMap } from './aliases.js'
import { evaluate, objectProperty, type Evaluated, type ScriptBindings } from './ast.js'
import type { ImageSource } from './types.js'

export const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif|gif|svg|tiff?|bmp)$/i

export interface ClassifyContext {
  absFile: string
  aliases: AliasMap
  publicDir: string
  bindings: ScriptBindings
  detectProvider: (url: string) => string | null
}

function stripQueryAndHash(path: string): string {
  return path.split(/[?#]/)[0]!
}

function safeDecode(path: string): string {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}

function withFile(source: ImageSource, filePath: string | null): ImageSource {
  if (!filePath) return source
  return { ...source, filePath, fileExists: existsSync(filePath) }
}

export function classifyString(
  value: string,
  ctx: ClassifyContext,
  serverLoader: boolean,
): ImageSource {
  const trimmed = value.trim()
  if (trimmed === '') return { kind: 'none' }
  if (trimmed.startsWith('data:')) return { kind: 'data-uri', value: `${trimmed.slice(0, 32)}…` }
  if (trimmed.startsWith('blob:')) return { kind: 'dynamic', value: trimmed }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    const absolute = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
    const provider = ctx.detectProvider(absolute)
    return provider ? { kind: 'cdn', value: trimmed, provider } : { kind: 'remote', value: trimmed }
  }

  const aliased = resolveModulePath(trimmed, ctx.absFile, ctx.aliases)
  if (aliased && !trimmed.startsWith('/')) {
    return withFile({ kind: 'local-import', value: trimmed }, stripQueryAndHash(aliased))
  }

  const publicPath = join(ctx.publicDir, safeDecode(stripQueryAndHash(trimmed.replace(/^\/+/, ''))))
  return withFile({ kind: serverLoader ? 'server' : 'public', value: trimmed }, publicPath)
}

export function classifyEvaluated(
  evaluated: Evaluated | undefined,
  expression: string,
  ctx: ClassifyContext,
  serverLoader: boolean,
): ImageSource {
  if (!evaluated) return { kind: 'dynamic', expression }
  switch (evaluated.t) {
    case 'string':
      return classifyString(evaluated.value, ctx, serverLoader)
    case 'import': {
      const [path, query = ''] = evaluated.specifier.split('?')
      const params = new URLSearchParams(query)
      if (params.has('vik')) return { kind: 'vik', value: evaluated.specifier }
      if (evaluated.member !== undefined || params.has('thumbhash'))
        return { kind: 'dynamic', expression }
      if (!IMAGE_EXT_RE.test(path!)) return { kind: 'dynamic', expression }
      return withFile(
        { kind: 'local-import', value: evaluated.specifier },
        resolveModulePath(evaluated.specifier, ctx.absFile, ctx.aliases),
      )
    }
    case 'object': {
      const fallback = objectProperty(evaluated.node, 'fallback')
      if (!fallback) return { kind: 'dynamic', expression }
      return classifyEvaluated(evaluate(fallback, ctx.bindings), expression, ctx, serverLoader)
    }
    case 'null':
      return { kind: 'none' }
    default:
      return { kind: 'dynamic', expression }
  }
}
