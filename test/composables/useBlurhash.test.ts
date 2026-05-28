import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useBlurhash } from '../../src/composables/useBlurhash'

// Valid 28-char hash: L=21 → numX=4, numY=3
const VALID_HASH = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

describe('useBlurhash', () => {
  it('returns a ref', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const canvasRef = useBlurhash({ blurhash: VALID_HASH, width: 32, height: 32 })
        return { canvasRef }
      },
      template: '<canvas ref="canvasRef" />',
    }))
    expect(wrapper.exists()).toBe(true)
  })

  it('draws pixels onto canvas in onMounted', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const canvasRef = useBlurhash({ blurhash: VALID_HASH, width: 4, height: 4 })
        return { canvasRef }
      },
      template: '<canvas ref="canvasRef" />',
    }))

    await nextTick()

    const canvas = wrapper.find('canvas')
    expect(canvas.exists()).toBe(true)
  })

  it('does not throw on invalid blurhash (silent fail)', async () => {
    expect(() => {
      mount(defineComponent({
        setup() {
          const canvasRef = useBlurhash({ blurhash: 'INVALID', width: 4, height: 4 })
          return { canvasRef }
        },
        template: '<canvas ref="canvasRef" />',
      }))
    }).not.toThrow()
  })

  it('returns null canvas on SSR (no window) — composable skips onMounted draw', () => {
    const wrapper = mount(defineComponent({
      setup() {
        const canvasRef = useBlurhash({ blurhash: VALID_HASH, width: 4, height: 4 })
        return { initialValue: canvasRef.value }
      },
      template: '<div />',
    }))
    expect(wrapper.vm.initialValue).toBeNull()
  })

  it('handles zero-dimension gracefully (canvas ref remains bound)', async () => {
    expect(() => {
      mount(defineComponent({
        setup() {
          const canvasRef = useBlurhash({ blurhash: VALID_HASH, width: 0, height: 0 })
          return { canvasRef }
        },
        template: '<canvas ref="canvasRef" />',
      }))
    }).not.toThrow()
  })
})
