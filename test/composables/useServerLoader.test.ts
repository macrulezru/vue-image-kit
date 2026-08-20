import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useServerRoute, SERVER_ROUTE_KEY, DEFAULT_SERVER_ROUTE } from '../../src/composables/useServerLoader'

function mountWith(localOverride?: string, provided?: string) {
  return mount(
    defineComponent({
      setup() {
        const route = useServerRoute(localOverride)
        return { route }
      },
      template: '<div />',
    }),
    {
      global: {
        provide: provided !== undefined ? { [SERVER_ROUTE_KEY as symbol]: provided } : {},
      },
    },
  )
}

describe('useServerRoute', () => {
  it('falls back to the handler default when nothing is provided or overridden', () => {
    const w = mountWith()
    expect(w.vm.route).toBe(DEFAULT_SERVER_ROUTE)
  })

  it('uses the plugin/module-provided route when no local override is given', () => {
    const w = mountWith(undefined, '/api/images')
    expect(w.vm.route).toBe('/api/images')
  })

  it('a local override wins over the provided route', () => {
    const w = mountWith('/custom/route', '/api/images')
    expect(w.vm.route).toBe('/custom/route')
  })
})
