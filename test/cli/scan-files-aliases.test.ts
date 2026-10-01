import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  createMatcher,
  findSourceFiles,
  globToRegExp,
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
} from '../../src/cli/scan/files'
import {
  defaultAliases,
  resolveAliases,
  resolveModulePath,
  stripJsonComments,
  tsconfigAliases,
} from '../../src/cli/scan/aliases'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vik-files-'))
  dirs.push(dir)
  return dir
}

function write(root: string, path: string, content = ''): void {
  mkdirSync(join(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), content, 'utf8')
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('globToRegExp', () => {
  it('handles **, *, ? and brace alternatives', () => {
    expect(globToRegExp('**/*.vue').test('a/b/C.vue')).toBe(true)
    expect(globToRegExp('**/*.vue').test('C.vue')).toBe(true)
    expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false)
    expect(globToRegExp('src/?.ts').test('src/a.ts')).toBe(true)
    expect(globToRegExp('**/*.{vue,ts}').test('x/y.ts')).toBe(true)
    expect(globToRegExp('**/*.{vue,ts}').test('x/y.js')).toBe(false)
    expect(globToRegExp('**/node_modules/**').test('a/node_modules/b/c.js')).toBe(true)
  })

  it('combines include and exclude lists', () => {
    const matches = createMatcher(DEFAULT_INCLUDE, DEFAULT_EXCLUDE)
    expect(matches('src/App.vue')).toBe(true)
    expect(matches('src/types.d.ts')).toBe(false)
    expect(matches('src/App.spec.ts')).toBe(false)
    expect(matches('dist/index.js')).toBe(false)
    expect(matches('src/style.css')).toBe(false)
  })
})

describe('findSourceFiles', () => {
  it('walks the tree, skipping excluded directories entirely', () => {
    const root = tempDir()
    write(root, 'src/App.vue')
    write(root, 'src/deep/nested/Card.vue')
    write(root, 'node_modules/lib/x.vue')
    write(root, '.nuxt/app.vue')
    write(root, 'dist/a.js')
    write(root, 'src/readme.md')
    const files = findSourceFiles(root, DEFAULT_INCLUDE, DEFAULT_EXCLUDE).map((file) =>
      file.slice(root.length + 1).replace(/\\/g, '/'),
    )
    expect(files).toEqual(['src/App.vue', 'src/deep/nested/Card.vue'])
  })
})

describe('aliases', () => {
  it('strips comments and trailing commas but keeps "/*" inside strings', () => {
    const text = '{\n  // comment\n  "paths": { "@/*": ["./src/*"], }, /* block */\n}'
    expect(JSON.parse(stripJsonComments(text))).toEqual({ paths: { '@/*': ['./src/*'] } })
  })

  it('reads tsconfig paths, following a relative extends', () => {
    const root = tempDir()
    write(
      root,
      'tsconfig.base.json',
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '~/*': ['./app/*'] } } }),
    )
    write(
      root,
      'tsconfig.json',
      '{ "extends": "./tsconfig.base.json", "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }',
    )
    const aliases = tsconfigAliases(root)
    expect(aliases['@']).toBe(join(root, 'src'))
    expect(aliases['~']).toBe(join(root, 'app'))
  })

  it('defaults to @ → src for Vue and ~/@ → srcDir for Nuxt', () => {
    const vue = tempDir()
    mkdirSync(join(vue, 'src'))
    expect(defaultAliases(vue)).toEqual({ '@': join(vue, 'src') })

    const nuxt = tempDir()
    write(nuxt, 'nuxt.config.ts', 'export default {}')
    write(nuxt, 'app/app.vue')
    expect(defaultAliases(nuxt)).toMatchObject({
      '~': join(nuxt, 'app'),
      '@': join(nuxt, 'app'),
      '~~': nuxt,
    })
  })

  it('lets explicit aliases win and resolves them against the root', async () => {
    const root = tempDir()
    mkdirSync(join(root, 'src'))
    const aliases = await resolveAliases(root, { '@': 'client' }, false)
    expect(aliases['@']).toBe(join(root, 'client'))
  })

  it('resolves relative, aliased and query-suffixed specifiers', () => {
    const aliases = { '@': '/project/src', '@assets': '/project/assets' }
    expect(resolveModulePath('./a.png', '/project/src/App.vue', aliases)).toBe(
      resolve('/project/src', 'a.png'),
    )
    expect(resolveModulePath('@/img/a.png?vik', '/x.vue', aliases)).toBe(
      join('/project/src', 'img/a.png'),
    )
    expect(resolveModulePath('@assets/b.png', '/x.vue', aliases)).toBe(
      join('/project/assets', 'b.png'),
    )
    expect(resolveModulePath('@macrulez/vue-image-kit', '/x.vue', aliases)).toBeNull()
  })
})
