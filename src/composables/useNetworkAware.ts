import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

// Not in lib.dom.d.ts yet — the Network Information API is still a draft,
// implemented (unprefixed) in Chromium-based browsers only.
interface NetworkInformation extends EventTarget {
  saveData?: boolean
  effectiveType?: string
}

function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  return nav.connection
}

/**
 * Synchronous, non-reactive save-data check — safe to call anywhere
 * (including outside a component's `setup()`, unlike `useNetworkAware`).
 * `false` on the server and in browsers without the Network Information API
 * (Firefox, Safari) — there's no way to know, so it fails open.
 */
export function isSaveDataEnabled(): boolean {
  return getConnection()?.saveData ?? false
}

interface UseNetworkAwareReturn {
  /** `navigator.connection.saveData` — user opted into data savings in their browser/OS. */
  saveData: Ref<boolean>
  /** `navigator.connection.effectiveType` — `'slow-2g' | '2g' | '3g' | '4g'`, a rough estimate. */
  effectiveType: Ref<string | undefined>
}

/**
 * Reactive wrapper around the Network Information API. Updates on the
 * connection's `change` event (network type changes, save-data toggled).
 * SSR-safe: `saveData` starts `false`, `effectiveType` starts `undefined`.
 */
export function useNetworkAware(): UseNetworkAwareReturn {
  const connection = getConnection()
  const saveData = ref(connection?.saveData ?? false)
  const effectiveType = ref<string | undefined>(connection?.effectiveType)

  function update(): void {
    saveData.value = connection?.saveData ?? false
    effectiveType.value = connection?.effectiveType
  }

  onMounted(() => {
    connection?.addEventListener?.('change', update)
  })
  onUnmounted(() => {
    connection?.removeEventListener?.('change', update)
  })

  return { saveData, effectiveType }
}
