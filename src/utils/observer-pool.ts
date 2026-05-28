// Shared IntersectionObserver pool.
// Components with identical rootMargin+threshold share ONE observer
// instead of each creating their own — critical for pages with 50+ images.

interface PoolEntry {
  observer: IntersectionObserver
  callbacks: Map<Element, () => void>
}

const pool = new Map<string, PoolEntry>()

/** Disconnect all observers and clear the pool. Used in tests to reset state between cases. */
export function clearObserverPool(): void {
  for (const entry of pool.values()) {
    entry.observer.disconnect()
  }
  pool.clear()
}

function poolKey(rootMargin: string, threshold: number): string {
  return `${rootMargin}|${threshold}`
}

/**
 * Adds `el` to the shared observer for the given config.
 * Returns an unsubscribe function — call it in onUnmounted.
 */
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
                // One-shot: unobserve immediately after first intersection
                entry.observer.unobserve(e.target)
                entry.callbacks.delete(e.target)
              }
            }
          }
          // GC: remove pool entry when no more elements are watched
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
