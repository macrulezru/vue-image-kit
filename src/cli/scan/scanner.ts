import { readFileSync } from 'node:fs'
import { basename, extname, relative } from 'node:path'
import {
  camelize,
  child,
  children,
  collectBindings,
  emptyBindings,
  evaluate,
  objectHasSpread,
  objectKeys,
  objectProperty,
  propertyKey,
  str,
  unwrapNode,
  walk,
  type AstNode,
  type Evaluated,
  type ScriptBindings,
} from './ast.js'
import { classifyEvaluated, type ClassifyContext } from './classify.js'
import { findSourceFiles, toPosix } from './files.js'
import type {
  EditTarget,
  ImageSource,
  ImageUsage,
  PropValue,
  ScanOptions,
  ScanResult,
  SourceEntry,
} from './types.js'
import { loadCdnModule, type CdnModule } from '../cdn-bridge.js'

type CompilerSfc = typeof import('vue/compiler-sfc')

const COMPONENT_EXPORT = 'VImage'
const DIRECTIVE_EXPORT = 'vLazyImg'
const PLUGIN_EXPORTS = new Set(['VImageKitPlugin', 'default'])
const COMPOSABLES = new Set(['useImage', 'useBackgroundImage'])
const RENDER_FUNCTIONS = new Set(['h', 'createVNode'])
const TRIGGER_RE =
  /VImage|v-image|useImage|useBackgroundImage|lazy-img|vLazyImg|PLACEHOLDERS_KEY|vueImageKit/
const NUXT_CONFIG_RE = /^nuxt\.config\.(ts|js|mjs|mts)$/

const PLACEHOLDER_PROPS = ['blurhash', 'thumbhash', 'placeholder', 'placeholderColor', 'image']

const NODE_ELEMENT = 1
const NODE_ATTRIBUTE = 6
const NODE_DIRECTIVE = 7

interface TemplateNode {
  type: number
  tag?: string
  props?: TemplateProp[]
  children?: TemplateNode[]
  loc: { start: { offset: number; line: number; column: number }; end: { offset: number } }
}

interface TemplateProp {
  type: number
  name: string
  value?: { content: string }
  arg?: { content: string; isStatic?: boolean }
  exp?: { content: string; loc: { start: { offset: number } } }
  loc: { start: { offset: number; line: number }; end: { offset: number } }
}

interface FileContext {
  absFile: string
  relFile: string
  source: string
  bindings: ScriptBindings
  classify: ClassifyContext
  componentTags: Set<string>
  directiveNames: Set<string>
  packageNames: Set<string>
  usages: ImageUsage[]
  registrations: string[]
}

export async function loadCompiler(): Promise<CompilerSfc> {
  try {
    return await import('vue/compiler-sfc')
  } catch {
    console.error(
      '\n[vue-image-kit] Could not load "vue/compiler-sfc" — run this command from a project that has vue installed.\n',
    )
    process.exit(1)
  }
}

function kebab(name: string): string {
  return name.replace(/\B([A-Z])/g, '-$1').toLowerCase()
}

function addTag(tags: Set<string>, name: string): void {
  tags.add(name)
  const hyphenated = kebab(name)
  if (hyphenated.includes('-')) tags.add(hyphenated)
}

function babelPlugins(file: string): ('typescript' | 'jsx')[] {
  const ext = extname(file).toLowerCase()
  if (ext === '.tsx') return ['typescript', 'jsx']
  if (ext === '.jsx') return ['jsx']
  if (ext === '.ts' || ext === '.mts' || ext === '.cts') return ['typescript']
  return ['jsx']
}

function parseProgram(
  compiler: CompilerSfc,
  code: string,
  plugins: ('typescript' | 'jsx')[],
): AstNode | null {
  try {
    const file = compiler.babelParse(code, {
      sourceType: 'module',
      plugins,
      errorRecovery: true,
    }) as unknown as AstNode
    return child(file, 'program') ?? null
  } catch {
    return null
  }
}

export function createProgramParser(compiler: CompilerSfc): (code: string) => AstNode | null {
  return (code) => parseProgram(compiler, code, ['typescript'])
}

function parseExpression(compiler: CompilerSfc, code: string): AstNode | undefined {
  const program = parseProgram(compiler, `(${code}\n)`, ['typescript'])
  const statement = program ? children(program, 'body')[0] : undefined
  return statement?.type === 'ExpressionStatement' ? child(statement, 'expression') : undefined
}

function toPropValue(evaluated: Evaluated | undefined, expression: string): PropValue {
  if (evaluated?.t === 'string' || evaluated?.t === 'number' || evaluated?.t === 'boolean') {
    return { kind: 'static', value: evaluated.value }
  }
  if (evaluated?.t === 'null') return { kind: 'static', value: null }
  return { kind: 'dynamic', expression: expression.trim() }
}

function hasPlaceholder(props: Record<string, PropValue>): boolean {
  if (PLACEHOLDER_PROPS.some((name) => name in props)) return true
  const mode = props['placeholderMode']
  return (
    mode?.kind === 'dynamic' ||
    (mode?.kind === 'static' && (mode.value === 'color' || mode.value === 'shimmer'))
  )
}

function isServerLoader(props: Record<string, PropValue>): boolean {
  const loader = props['loader']
  return loader?.kind === 'static' && loader.value === 'server'
}

function componentSource(
  props: Record<string, PropValue>,
  evaluatedProps: Map<string, { evaluated: Evaluated | undefined; expression: string }>,
  ctx: FileContext,
): ImageSource {
  const serverLoader = isServerLoader(props)
  const image = evaluatedProps.get('image')
  if (image) {
    if (image.evaluated?.t === 'object') {
      const src = objectProperty(image.evaluated.node, 'src')
      if (src)
        return classifyEvaluated(
          evaluate(src, ctx.bindings),
          image.expression,
          ctx.classify,
          serverLoader,
        )
    }
    if (image.evaluated?.t === 'import') return { kind: 'vik', value: image.evaluated.specifier }
    return { kind: 'vik', expression: image.expression }
  }
  const src = evaluatedProps.get('src')
  if (!src) return { kind: 'none' }
  return classifyEvaluated(src.evaluated, src.expression, ctx.classify, serverLoader)
}

function editTarget(node: TemplateNode, source: string): EditTarget {
  const props = node.props ?? []
  const tagEnd = node.loc.start.offset + 1 + (node.tag?.length ?? 0)
  const last = props.reduce<TemplateProp | null>(
    (latest, prop) => (!latest || prop.loc.end.offset > latest.loc.end.offset ? prop : latest),
    null,
  )
  const insertOffset = last ? last.loc.end.offset : tagEnd
  let indent: string | null = null
  if (last && source.slice(node.loc.start.offset, insertOffset).includes('\n')) {
    const lineStart = source.lastIndexOf('\n', last.loc.start.offset - 1) + 1
    const leading = source.slice(lineStart, last.loc.start.offset)
    if (/^[ \t]*$/.test(leading)) indent = leading
  }
  const attributes = props.map((prop) => {
    const text = source.slice(prop.loc.start.offset, prop.loc.end.offset)
    const raw = text.split('=')[0]!.trim()
    const name =
      prop.type === NODE_DIRECTIVE && prop.name === 'bind' && prop.arg
        ? camelize(prop.arg.content)
        : camelize(prop.name)
    return { name, raw, start: prop.loc.start.offset, end: prop.loc.end.offset }
  })
  return { insertOffset, tagEnd, indent, attributes }
}

function pushUsage(ctx: FileContext, usage: Omit<ImageUsage, 'file' | 'absFile'>): void {
  ctx.usages.push({ file: ctx.relFile, absFile: ctx.absFile, ...usage })
}

const SOURCE_PLACEHOLDER_KEYS = ['blurhash', 'thumbhash', 'placeholder', 'placeholderColor']

function jsQuote(attributeQuote: string): string {
  return attributeQuote === "'" ? '"' : "'"
}

function collectSourceEntries(
  sourcesNode: AstNode,
  ctx: FileContext,
  expressionOffset: number | null,
  attributeQuote: string,
  serverLoader: boolean,
): SourceEntry[] {
  const entries: SourceEntry[] = []
  const absolute = (offset: number | null | undefined) =>
    expressionOffset === null || offset === null || offset === undefined
      ? null
      : expressionOffset + offset - 1
  const quote = jsQuote(attributeQuote)

  for (const property of children(sourcesNode, 'properties')) {
    const key = propertyKey(property)
    const valueNode = child(property, 'value')
    if (key === undefined || !valueNode) continue
    const inner = unwrapNode(valueNode)
    const expression = `sources.${key}`

    if (inner.type === 'ObjectExpression') {
      const keys = objectKeys(inner)
      const src = objectProperty(inner, 'src')
      const source = src
        ? classifyEvaluated(evaluate(src, ctx.bindings), expression, ctx.classify, serverLoader)
        : ({ kind: 'dynamic', expression } as ImageSource)
      const properties = children(inner, 'properties')
      const last = properties[properties.length - 1]
      const insertOffset = absolute(last ? last.end : (inner.start ?? 0) + 1)
      entries.push({
        key,
        source,
        hasPlaceholder: SOURCE_PLACEHOLDER_KEYS.some((name) => keys.includes(name)),
        hasSize: keys.includes('width') || keys.includes('height'),
        ...(insertOffset !== null && !objectHasSpread(inner)
          ? { edit: { kind: 'object', insertOffset, hasProperties: properties.length > 0, quote } }
          : {}),
      })
      continue
    }

    const result = evaluate(valueNode, ctx.bindings)
    const start = absolute(inner.start)
    const end = absolute(inner.end)
    entries.push({
      key,
      source: classifyEvaluated(result, expression, ctx.classify, serverLoader),
      hasPlaceholder: false,
      hasSize: false,
      ...(inner.type === 'StringLiteral' && start !== null && end !== null
        ? { edit: { kind: 'string', start, end, quote } }
        : {}),
    })
  }
  return entries
}

function handleTemplateComponent(
  node: TemplateNode,
  ctx: FileContext,
  compiler: CompilerSfc,
  editable: boolean,
): void {
  const props: Record<string, PropValue> = {}
  const evaluated = new Map<string, { evaluated: Evaluated | undefined; expression: string }>()
  let sources: SourceEntry[] | undefined

  for (const prop of node.props ?? []) {
    if (prop.type === NODE_ATTRIBUTE) {
      const name = camelize(prop.name)
      const value = prop.value ? prop.value.content : true
      props[name] = { kind: 'static', value }
      if (typeof value === 'string')
        evaluated.set(name, { evaluated: { t: 'string', value }, expression: value })
    } else if (prop.type === NODE_DIRECTIVE && prop.name === 'bind') {
      const expression = prop.exp?.content ?? ''
      if (!prop.arg) {
        props['v-bind'] = { kind: 'dynamic', expression }
        continue
      }
      if (prop.arg.isStatic === false) continue
      const name = camelize(prop.arg.content)
      const result = expression
        ? evaluate(parseExpression(compiler, expression), ctx.bindings)
        : { t: 'boolean' as const, value: true }
      props[name] = toPropValue(result, expression)
      evaluated.set(name, { evaluated: result, expression })
      if (name === 'sources' && result?.t === 'object') {
        const literal = unwrapNode(parseExpression(compiler, expression) ?? result.node)
        const direct = literal.type === 'ObjectExpression' && prop.exp
        sources = collectSourceEntries(
          direct ? literal : result.node,
          ctx,
          direct ? prop.exp!.loc.start.offset : null,
          direct ? (ctx.source[prop.exp!.loc.start.offset - 1] ?? '"') : '"',
          isServerLoader(props),
        )
      }
    }
  }

  pushUsage(ctx, {
    line: node.loc.start.line,
    column: node.loc.start.column,
    kind: 'component',
    name: COMPONENT_EXPORT,
    props,
    source: componentSource(props, evaluated, ctx),
    hasPlaceholder: hasPlaceholder(props),
    ...(editable ? { edit: editTarget(node, ctx.source) } : {}),
    ...(sources && sources.length > 0 ? { sources } : {}),
  })
}

function handleTemplateDirective(
  prop: TemplateProp,
  ctx: FileContext,
  compiler: CompilerSfc,
): void {
  const expression = prop.exp?.content ?? ''
  const result = expression
    ? evaluate(parseExpression(compiler, expression), ctx.bindings)
    : undefined
  const props: Record<string, PropValue> = {}
  let source: ImageSource
  if (result?.t === 'object') {
    for (const key of objectKeys(result.node)) {
      const value = objectProperty(result.node, key)
      props[key] = toPropValue(evaluate(value, ctx.bindings), expression)
    }
    const src = objectProperty(result.node, 'src')
    source = src
      ? classifyEvaluated(evaluate(src, ctx.bindings), expression, ctx.classify, false)
      : { kind: 'dynamic', expression }
  } else {
    props['src'] = toPropValue(result, expression)
    source = classifyEvaluated(result, expression, ctx.classify, false)
  }
  pushUsage(ctx, {
    line: prop.loc.start.line,
    column: 0,
    kind: 'directive',
    name: 'v-lazy-img',
    props,
    source,
    hasPlaceholder: 'placeholder' in props,
  })
}

function walkTemplate(node: TemplateNode, ctx: FileContext, compiler: CompilerSfc): void {
  if (node.type === NODE_ELEMENT && node.tag) {
    if (ctx.componentTags.has(node.tag)) handleTemplateComponent(node, ctx, compiler, true)
    for (const prop of node.props ?? []) {
      if (prop.type === NODE_DIRECTIVE && ctx.directiveNames.has(prop.name))
        handleTemplateDirective(prop, ctx, compiler)
    }
  }
  for (const childNode of node.children ?? []) walkTemplate(childNode, ctx, compiler)
}

function objectProps(
  object: AstNode | undefined,
  ctx: FileContext,
  codeOf: (node: AstNode) => string,
) {
  const props: Record<string, PropValue> = {}
  const evaluated = new Map<string, { evaluated: Evaluated | undefined; expression: string }>()
  if (!object || object.type !== 'ObjectExpression') return { props, evaluated }
  if (objectHasSpread(object)) props['...'] = { kind: 'dynamic', expression: '...' }
  for (const key of objectKeys(object)) {
    const valueNode = objectProperty(object, key)
    const expression = valueNode ? codeOf(valueNode) : ''
    const result = evaluate(valueNode, ctx.bindings)
    props[key] = toPropValue(result, expression)
    evaluated.set(key, { evaluated: result, expression })
  }
  return { props, evaluated }
}

function isPackageImport(name: string, ctx: FileContext, allowed: Set<string>): boolean {
  const binding = ctx.bindings.imports.get(name)
  return !!binding && ctx.packageNames.has(binding.source) && allowed.has(binding.imported)
}

function composableName(callee: AstNode, ctx: FileContext): string | null {
  if (callee.type !== 'Identifier') return null
  const name = str(callee, 'name')!
  const binding = ctx.bindings.imports.get(name)
  if (binding)
    return ctx.packageNames.has(binding.source) && COMPOSABLES.has(binding.imported)
      ? binding.imported
      : null
  return COMPOSABLES.has(name) ? name : null
}

function walkScript(
  program: AstNode,
  ctx: FileContext,
  code: string,
  offset: { line: number },
  isNuxtConfig: boolean,
): void {
  const codeOf = (node: AstNode) => code.slice(node.start ?? 0, node.end ?? 0)
  const lineOf = (node: AstNode) => (node.loc?.start.line ?? 1) + offset.line - 1

  walk(program, (node) => {
    if (node.type === 'CallExpression') {
      const callee = child(node, 'callee')
      const args = children(node, 'arguments')
      if (!callee) return

      const composable = composableName(callee, ctx)
      if (composable) {
        const optionsNode = composable === 'useImage' ? args[0] : args[1]
        const { props } = objectProps(optionsNode, ctx, codeOf)
        const srcNode =
          composable === 'useImage'
            ? args[0]?.type === 'ObjectExpression'
              ? objectProperty(args[0], 'src')
              : undefined
            : args[0]
        const expression = srcNode ? codeOf(srcNode) : ''
        if (srcNode) props['src'] = toPropValue(evaluate(srcNode, ctx.bindings), expression)
        pushUsage(ctx, {
          line: lineOf(node),
          column: node.loc?.start.column ?? 0,
          kind: 'composable',
          name: composable,
          props,
          source: srcNode
            ? classifyEvaluated(evaluate(srcNode, ctx.bindings), expression, ctx.classify, false)
            : { kind: 'dynamic', expression: codeOf(node) },
          hasPlaceholder: false,
        })
        return
      }

      if (callee.type === 'Identifier' && RENDER_FUNCTIONS.has(str(callee, 'name')!)) {
        const target = args[0]
        const targetName = target?.type === 'Identifier' ? str(target, 'name') : undefined
        if (targetName && isPackageImport(targetName, ctx, new Set([COMPONENT_EXPORT]))) {
          const { props, evaluated } = objectProps(args[1], ctx, codeOf)
          pushUsage(ctx, {
            line: lineOf(node),
            column: node.loc?.start.column ?? 0,
            kind: 'component',
            name: COMPONENT_EXPORT,
            props,
            source: componentSource(props, evaluated, ctx),
            hasPlaceholder: hasPlaceholder(props),
          })
        }
        return
      }

      if (callee.type === 'MemberExpression') {
        const method = str(child(callee, 'property') ?? { type: '' }, 'name')
        const first = args[0]
        const firstName = first?.type === 'Identifier' ? str(first, 'name') : undefined
        if (
          method === 'use' &&
          firstName &&
          (firstName === 'VImageKitPlugin' || isPackageImport(firstName, ctx, PLUGIN_EXPORTS))
        ) {
          const options = args[1]
          if (
            options?.type === 'ObjectExpression' &&
            objectKeys(options).includes('placeholders')
          ) {
            ctx.registrations.push(`${ctx.relFile}:${lineOf(node)}`)
          }
        }
        if (
          method === 'provide' &&
          firstName &&
          (firstName === 'PLACEHOLDERS_KEY' ||
            isPackageImport(firstName, ctx, new Set(['PLACEHOLDERS_KEY'])))
        ) {
          ctx.registrations.push(`${ctx.relFile}:${lineOf(node)}`)
        }
      }
      return
    }

    if (node.type === 'JSXElement') {
      const opening = child(node, 'openingElement')
      const nameNode = opening ? child(opening, 'name') : undefined
      const tag = nameNode?.type === 'JSXIdentifier' ? str(nameNode, 'name') : undefined
      if (!opening || !tag || !ctx.componentTags.has(tag)) return
      const props: Record<string, PropValue> = {}
      const evaluated = new Map<string, { evaluated: Evaluated | undefined; expression: string }>()
      for (const attribute of children(opening, 'attributes')) {
        if (attribute.type === 'JSXSpreadAttribute') {
          props['...'] = { kind: 'dynamic', expression: codeOf(attribute) }
          continue
        }
        const attrName = str(child(attribute, 'name') ?? { type: '' }, 'name')
        if (!attrName) continue
        const name = camelize(attrName)
        const value = child(attribute, 'value')
        if (!value) {
          props[name] = { kind: 'static', value: true }
          continue
        }
        const valueNode =
          value.type === 'JSXExpressionContainer' ? child(value, 'expression') : value
        const expression = valueNode ? codeOf(valueNode) : ''
        const result = evaluate(valueNode, ctx.bindings)
        props[name] = toPropValue(result, expression)
        evaluated.set(name, { evaluated: result, expression })
      }
      pushUsage(ctx, {
        line: lineOf(node),
        column: node.loc?.start.column ?? 0,
        kind: 'component',
        name: COMPONENT_EXPORT,
        props,
        source: componentSource(props, evaluated, ctx),
        hasPlaceholder: hasPlaceholder(props),
      })
      return
    }

    if (isNuxtConfig && node.type === 'ObjectProperty') {
      const key = child(node, 'key')
      const keyName = key ? (str(key, 'name') ?? str(key, 'value')) : undefined
      const value = child(node, 'value')
      if (
        keyName === 'vueImageKit' &&
        value?.type === 'ObjectExpression' &&
        objectKeys(value).includes('placeholders')
      ) {
        ctx.registrations.push(`${ctx.relFile}:${lineOf(node)}`)
      }
    }
  })
}

function componentTagsFor(bindings: ScriptBindings, packageNames: Set<string>): Set<string> {
  const tags = new Set<string>()
  const shadowed = bindings.imports.get(COMPONENT_EXPORT)
  if (!shadowed || packageNames.has(shadowed.source)) addTag(tags, COMPONENT_EXPORT)
  for (const [local, binding] of bindings.imports) {
    if (packageNames.has(binding.source) && binding.imported === COMPONENT_EXPORT)
      addTag(tags, local)
  }
  return tags
}

function directiveNamesFor(bindings: ScriptBindings, packageNames: Set<string>): Set<string> {
  const names = new Set(['lazy-img'])
  for (const [local, binding] of bindings.imports) {
    if (
      packageNames.has(binding.source) &&
      binding.imported === DIRECTIVE_EXPORT &&
      /^v[A-Z]/.test(local)
    ) {
      names.add(kebab(local.slice(1)))
    }
  }
  return names
}

interface ScanFileArgs {
  absFile: string
  root: string
  options: ScanOptions
  compiler: CompilerSfc
  detectProvider: (url: string) => string | null
}

function scanFile({ absFile, root, options, compiler, detectProvider }: ScanFileArgs) {
  const source = readFileSync(absFile, 'utf8')
  const relFile = toPosix(relative(root, absFile))
  const usages: ImageUsage[] = []
  const registrations: string[] = []
  if (!TRIGGER_RE.test(source)) return { usages, registrations, error: null as string | null }

  const packageNames = new Set(options.packageNames)
  const bindings = emptyBindings()
  const scripts: { program: AstNode; code: string; offset: { line: number } }[] = []
  let template: TemplateNode | null = null
  let error: string | null = null

  if (absFile.endsWith('.vue')) {
    const { descriptor, errors } = compiler.parse(source, { filename: absFile })
    if (errors.length > 0) error = String((errors[0] as { message?: string }).message ?? errors[0])
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block) continue
      const lang = block.lang ?? 'js'
      const plugins: ('typescript' | 'jsx')[] =
        lang === 'tsx' ? ['typescript', 'jsx'] : lang === 'ts' ? ['typescript'] : ['jsx']
      const program = parseProgram(compiler, block.content, plugins)
      if (!program) continue
      collectBindings(program, bindings)
      scripts.push({ program, code: block.content, offset: { line: block.loc.start.line } })
    }
    template = (descriptor.template?.ast as unknown as TemplateNode | undefined) ?? null
  } else {
    const program = parseProgram(compiler, source, babelPlugins(absFile))
    if (!program) return { usages, registrations, error: 'could not parse file' }
    collectBindings(program, bindings)
    scripts.push({ program, code: source, offset: { line: 1 } })
  }

  const ctx: FileContext = {
    absFile,
    relFile,
    source,
    bindings,
    classify: {
      absFile,
      aliases: options.aliases,
      publicDir: options.publicDir,
      bindings,
      detectProvider,
    },
    componentTags: componentTagsFor(bindings, packageNames),
    directiveNames: directiveNamesFor(bindings, packageNames),
    packageNames,
    usages,
    registrations,
  }

  if (template) {
    for (const childNode of template.children ?? []) walkTemplate(childNode, ctx, compiler)
  }
  const isNuxtConfig = NUXT_CONFIG_RE.test(basename(absFile))
  for (const script of scripts)
    walkScript(script.program, ctx, script.code, script.offset, isNuxtConfig)

  usages.sort((a, b) => a.line - b.line)
  return { usages, registrations, error }
}

export interface ScanRuntime {
  compiler?: CompilerSfc
  cdn?: CdnModule | null
}

export async function scanProject(
  options: ScanOptions,
  runtime: ScanRuntime = {},
): Promise<ScanResult> {
  const compiler = runtime.compiler ?? (await loadCompiler())
  const cdn = runtime.cdn !== undefined ? runtime.cdn : await loadCdnModule()
  const detectProvider = (url: string) => cdn?.detectCdnProvider(url) ?? null

  const files = findSourceFiles(options.root, options.include, options.exclude)
  const usages: ImageUsage[] = []
  const registrations: string[] = []
  const parseErrors: { file: string; message: string }[] = []
  let filesWithUsages = 0

  for (const absFile of files) {
    let result
    try {
      result = scanFile({ absFile, root: options.root, options, compiler, detectProvider })
    } catch (err) {
      parseErrors.push({
        file: toPosix(relative(options.root, absFile)),
        message: (err as Error).message,
      })
      continue
    }
    if (result.error)
      parseErrors.push({ file: toPosix(relative(options.root, absFile)), message: result.error })
    if (result.usages.length > 0) filesWithUsages++
    usages.push(...result.usages)
    registrations.push(...result.registrations)
  }

  return {
    root: options.root,
    filesScanned: files.length,
    filesWithUsages,
    usages,
    registration: { found: registrations.length > 0, where: registrations },
    parseErrors,
  }
}
