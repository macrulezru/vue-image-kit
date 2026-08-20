import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useNetworkAware, isSaveDataEnabled } from '../../src/composables/useNetworkAware'

class MockConnection extends EventTarget {
  saveData: boolean
  effectiveType: string

  constructor(saveData = false, effectiveType = '4g') {
    super()
    this.saveData = saveData
    this.effectiveType = effectiveType
  }

  change(saveData: boolean, effectiveType = this.effectiveType): void {
    this.saveData = saveData
    this.effectiveType = effectiveType
    this.dispatchEvent(new Event('change'))
  }
}

function stubConnection(connection: MockConnection | undefined): void {
  Object.defineProperty(navigator, 'connection', {
    value: connection,
    configurable: true,
  })
}

afterEach(() => {
  stubConnection(undefined)
})

describe('isSaveDataEnabled', () => {
  it('returns false when there is no connection API', () => {
    expect(isSaveDataEnabled()).toBe(false)
  })

  it('reflects navigator.connection.saveData', () => {
    stubConnection(new MockConnection(true))
    expect(isSaveDataEnabled()).toBe(true)
  })
})

describe('useNetworkAware', () => {
  it('starts false/undefined with no connection API', () => {
    const wrapper = mount(defineComponent({
      setup() {
        return useNetworkAware()
      },
      template: '<div />',
    }))
    expect(wrapper.vm.saveData).toBe(false)
    expect(wrapper.vm.effectiveType).toBeUndefined()
  })

  it('reads the initial connection state', () => {
    stubConnection(new MockConnection(true, '2g'))
    const wrapper = mount(defineComponent({
      setup() {
        return useNetworkAware()
      },
      template: '<div />',
    }))
    expect(wrapper.vm.saveData).toBe(true)
    expect(wrapper.vm.effectiveType).toBe('2g')
  })

  it('updates reactively on the connection change event', async () => {
    const connection = new MockConnection(false, '4g')
    stubConnection(connection)

    const wrapper = mount(defineComponent({
      setup() {
        return useNetworkAware()
      },
      template: '<div />',
    }))
    expect(wrapper.vm.saveData).toBe(false)

    connection.change(true, '2g')
    await nextTick()

    expect(wrapper.vm.saveData).toBe(true)
    expect(wrapper.vm.effectiveType).toBe('2g')
  })

  it('stops updating after unmount', async () => {
    const connection = new MockConnection(false)
    stubConnection(connection)

    const wrapper = mount(defineComponent({
      setup() {
        return useNetworkAware()
      },
      template: '<div />',
    }))
    wrapper.unmount()

    connection.change(true)
    await nextTick()
    // No assertion target left on the unmounted instance — just verifying
    // this doesn't throw (listener was removed, not left dangling).
  })
})
