import { isAbsolute, relative, resolve } from 'node:path'

export function isInsideDir(file: string, dir: string): boolean {
  const rel = relative(resolve(dir), resolve(file))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

export function createRunQueue(run: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null
  let again = false
  return () => {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          await run()
        } while (again)
      } finally {
        again = false
        running = null
      }
    })()
    return running
  }
}
