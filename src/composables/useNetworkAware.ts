import { ref, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

interface NetworkInformation extends EventTarget {
  saveData?: boolean
  effectiveType?: string
}

function getConnection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined
  const nav = navigator as Navigator & { connection?: NetworkInformation }
  return nav.connection
}

export function isSaveDataEnabled(): boolean {
  return getConnection()?.saveData ?? false
}

interface UseNetworkAwareReturn {
  saveData: Ref<boolean>
  effectiveType: Ref<string | undefined>
}

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
