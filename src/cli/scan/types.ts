export type UsageKind = 'component' | 'directive' | 'composable'

export type SourceKind =
  | 'local-import'
  | 'vik'
  | 'public'
  | 'cdn'
  | 'server'
  | 'remote'
  | 'data-uri'
  | 'dynamic'
  | 'none'

export type PropValue =
  | { kind: 'static'; value: string | number | boolean | null }
  | { kind: 'dynamic'; expression: string }

export interface ImageSource {
  kind: SourceKind
  value?: string
  provider?: string
  filePath?: string
  fileExists?: boolean
  expression?: string
}

export interface EditAttribute {
  name: string
  raw: string
  start: number
  end: number
}

export interface EditTarget {
  insertOffset: number
  tagEnd: number
  indent: string | null
  attributes: EditAttribute[]
}

export interface ImageUsage {
  file: string
  absFile: string
  line: number
  column: number
  kind: UsageKind
  name: string
  props: Record<string, PropValue>
  source: ImageSource
  hasPlaceholder: boolean
  edit?: EditTarget
}

export interface RegistrationInfo {
  found: boolean
  where: string[]
}

export interface ScanOptions {
  root: string
  include: string[]
  exclude: string[]
  publicDir: string
  aliases: Record<string, string>
  packageNames: string[]
}

export interface ScanResult {
  root: string
  filesScanned: number
  filesWithUsages: number
  usages: ImageUsage[]
  registration: RegistrationInfo
  parseErrors: { file: string; message: string }[]
}
