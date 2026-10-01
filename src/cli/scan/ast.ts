export interface AstNode {
  type: string
  start?: number | null
  end?: number | null
  loc?: { start: { line: number; column: number } } | null
  [key: string]: unknown
}

export function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}

export function child(node: AstNode, key: string): AstNode | undefined {
  const value = node[key]
  return isNode(value) ? value : undefined
}

export function children(node: AstNode, key: string): AstNode[] {
  const value = node[key]
  return Array.isArray(value) ? value.filter(isNode) : []
}

export function str(node: AstNode, key: string): string | undefined {
  const value = node[key]
  return typeof value === 'string' ? value : undefined
}

const SKIPPED_KEYS = new Set([
  'loc',
  'start',
  'end',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'extra',
  'range',
])

export function walk(root: AstNode, visit: (node: AstNode, parent: AstNode | null) => void): void {
  const stack: { node: AstNode; parent: AstNode | null }[] = [{ node: root, parent: null }]
  while (stack.length > 0) {
    const { node, parent } = stack.pop()!
    visit(node, parent)
    for (const key of Object.keys(node)) {
      if (SKIPPED_KEYS.has(key)) continue
      const value = node[key]
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i--) {
          if (isNode(value[i])) stack.push({ node: value[i] as AstNode, parent: node })
        }
      } else if (isNode(value)) {
        stack.push({ node: value, parent: node })
      }
    }
  }
}

export interface ImportBinding {
  source: string
  imported: string
}

export interface ScriptBindings {
  imports: Map<string, ImportBinding>
  constants: Map<string, AstNode>
}

export function emptyBindings(): ScriptBindings {
  return { imports: new Map(), constants: new Map() }
}

export function collectBindings(
  program: AstNode,
  into: ScriptBindings = emptyBindings(),
): ScriptBindings {
  for (const statement of children(program, 'body')) {
    if (statement.type === 'ImportDeclaration') {
      const source = str(child(statement, 'source') ?? { type: '' }, 'value')
      if (source === undefined) continue
      for (const specifier of children(statement, 'specifiers')) {
        const local = str(child(specifier, 'local') ?? { type: '' }, 'name')
        if (!local) continue
        if (specifier.type === 'ImportDefaultSpecifier') {
          into.imports.set(local, { source, imported: 'default' })
        } else if (specifier.type === 'ImportNamespaceSpecifier') {
          into.imports.set(local, { source, imported: '*' })
        } else {
          const importedNode = child(specifier, 'imported')
          const imported = importedNode
            ? (str(importedNode, 'name') ?? str(importedNode, 'value') ?? local)
            : local
          into.imports.set(local, { source, imported })
        }
      }
    } else if (statement.type === 'VariableDeclaration' && statement['kind'] === 'const') {
      for (const declarator of children(statement, 'declarations')) {
        const id = child(declarator, 'id')
        const init = child(declarator, 'init')
        if (id?.type === 'Identifier' && init) {
          const name = str(id, 'name')
          if (name) into.constants.set(name, init)
        }
      }
    }
  }
  return into
}

export type Evaluated =
  | { t: 'string'; value: string }
  | { t: 'number'; value: number }
  | { t: 'boolean'; value: boolean }
  | { t: 'null' }
  | { t: 'import'; specifier: string; imported: string; member?: string }
  | { t: 'object'; node: AstNode }
  | { t: 'array'; node: AstNode }

export function unwrapNode(node: AstNode): AstNode {
  let current = node
  while (
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSNonNullExpression' ||
    current.type === 'ParenthesizedExpression' ||
    current.type === 'TSTypeAssertion'
  ) {
    const inner = child(current, 'expression')
    if (!inner) break
    current = inner
  }
  return current
}

export function evaluate(
  node: AstNode | undefined,
  bindings: ScriptBindings,
  depth = 0,
): Evaluated | undefined {
  if (!node || depth > 8) return undefined
  const expr = unwrapNode(node)
  switch (expr.type) {
    case 'StringLiteral':
      return { t: 'string', value: String(expr['value']) }
    case 'NumericLiteral':
      return { t: 'number', value: Number(expr['value']) }
    case 'BooleanLiteral':
      return { t: 'boolean', value: Boolean(expr['value']) }
    case 'NullLiteral':
      return { t: 'null' }
    case 'TemplateLiteral': {
      if (children(expr, 'expressions').length > 0) return undefined
      const quasi = children(expr, 'quasis')[0]
      const value = quasi ? (quasi['value'] as { cooked?: string } | undefined)?.cooked : ''
      return typeof value === 'string' ? { t: 'string', value } : undefined
    }
    case 'UnaryExpression': {
      const argument = evaluate(child(expr, 'argument'), bindings, depth + 1)
      if (expr['operator'] === '-' && argument?.t === 'number')
        return { t: 'number', value: -argument.value }
      return undefined
    }
    case 'ObjectExpression':
      return { t: 'object', node: expr }
    case 'ArrayExpression':
      return { t: 'array', node: expr }
    case 'Identifier': {
      const name = str(expr, 'name')
      if (!name) return undefined
      const imported = bindings.imports.get(name)
      if (imported) return { t: 'import', specifier: imported.source, imported: imported.imported }
      const constant = bindings.constants.get(name)
      return constant ? evaluate(constant, bindings, depth + 1) : undefined
    }
    case 'MemberExpression': {
      const object = evaluate(child(expr, 'object'), bindings, depth + 1)
      const property = child(expr, 'property')
      const key =
        expr['computed'] === true
          ? (() => {
              const evaluated = evaluate(property, bindings, depth + 1)
              return evaluated?.t === 'string' ? evaluated.value : undefined
            })()
          : property
            ? str(property, 'name')
            : undefined
      if (!object || key === undefined) return undefined
      if (object.t === 'import' && object.member === undefined) return { ...object, member: key }
      if (object.t === 'object')
        return evaluate(objectProperty(object.node, key), bindings, depth + 1)
      return undefined
    }
    default:
      return undefined
  }
}

export function propertyKey(property: AstNode): string | undefined {
  if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod') return undefined
  const key = child(property, 'key')
  if (!key) return undefined
  if (property['computed'] === true)
    return key.type === 'StringLiteral' ? str(key, 'value') : undefined
  return str(key, 'name') ?? str(key, 'value')
}

export function objectProperty(object: AstNode, name: string): AstNode | undefined {
  for (const property of children(object, 'properties')) {
    if (propertyKey(property) === name) return child(property, 'value')
  }
  return undefined
}

export function objectHasSpread(object: AstNode): boolean {
  return children(object, 'properties').some((property) => property.type === 'SpreadElement')
}

export function objectKeys(object: AstNode): string[] {
  return children(object, 'properties')
    .map(propertyKey)
    .filter((key): key is string => key !== undefined)
}

export function camelize(name: string): string {
  return name.replace(/-(\w)/g, (_, char: string) => char.toUpperCase())
}
