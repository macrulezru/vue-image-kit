
interface PoolEntry {
  observer: IntersectionObserver
  callbacks: Map<Element, () => void>
}

const pool = new Map<string, PoolEntry>()

export function clearObserverPool(): void {
  for (const entry of pool.values()) {
    entry.observer.disconnect()
  }
  pool.clear()
}

function poolKey(rootMargin: string, threshold: number): string {
  return `${rootMargin}|${threshold}`
}

export function observeShared(
  el: Element,
  rootMargin: string,
  threshold: number,
  onIntersect: () => void,
): () => void {
  const key = poolKey(rootMargin, threshold)

  if (!pool.has(key)) {
    const entry: PoolEntry = {
      callbacks: new Map(),
      observer: new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              const cb = entry.callbacks.get(e.target)
              if (cb) {
                cb()
                entry.observer.unobserve(e.target)
                entry.callbacks.delete(e.target)
              }
            }
          }
          if (entry.callbacks.size === 0) {
            entry.observer.disconnect()
            pool.delete(key)
          }
        },
        { rootMargin, threshold },
      ),
    }
    pool.set(key, entry)
  }

  const entry = pool.get(key)!
  entry.callbacks.set(el, onIntersect)
  entry.observer.observe(el)

  return () => {
    entry.observer.unobserve(el)
    entry.callbacks.delete(el)
    if (entry.callbacks.size === 0) {
      entry.observer.disconnect()
      pool.delete(key)
    }
  }
}
