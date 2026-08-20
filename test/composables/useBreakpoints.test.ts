import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useBreakpoints, BREAKPOINTS_KEY } from '../../src/composables/useBreakpoints'
import type { BreakpointMap } from '../../src/types'

function mountWithBreakpoints(globalBp?: BreakpointMap, local?: BreakpointMap) {
  return mount(
    defineComponent({
      setup() {
        const { merged, resolveMediaSources } = useBreakpoints(local)
        return { merged, resolveMediaSources }
      },
      template: '<div />',
    }),
    {
      global: {
        provide: globalBp ? { [BREAKPOINTS_KEY as symbol]: globalBp } : {},
      },
    },
  )
}

describe('useBreakpoints', () => {
  describe('merged breakpoints', () => {
    it('returns empty map when no breakpoints provided', () => {
      const w = mountWithBreakpoints()
      expect(w.vm.merged).toEqual({})
    })

    it('returns global breakpoints when no local provided', () => {
      const global = { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }
      const w = mountWithBreakpoints(global)
      expect(w.vm.merged).toEqual(global)
    })

    it('returns local breakpoints when no global provided', () => {
      const local = { xl: '(min-width: 1440px)' }
      const w = mountWithBreakpoints(undefined, local)
      expect(w.vm.merged).toEqual(local)
    })

    it('merges global and local breakpoints', () => {
      const global = { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }
      const local = { xl: '(min-width: 1440px)' }
      const w = mountWithBreakpoints(global, local)
      expect(w.vm.merged).toEqual({
        sm: '(max-width: 640px)',
        md: '(max-width: 1024px)',
        xl: '(min-width: 1440px)',
      })
    })

    it('local breakpoints override global with same key', () => {
      const global = { sm: '(max-width: 640px)' }
      const local = { sm: '(max-width: 480px)' }
      const w = mountWithBreakpoints(global, local)
      expect(w.vm.merged.sm).toBe('(max-width: 480px)')
    })
  })

  describe('resolveMediaSources', () => {
    it('returns empty array when sources is undefined', () => {
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      expect(w.vm.resolveMediaSources(undefined)).toEqual([])
    })

    it('resolves keys to media queries', () => {
      const global = { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }
      const w = mountWithBreakpoints(global)
      const result = w.vm.resolveMediaSources({ sm: '/img-sm.jpg', md: '/img-md.jpg' })
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ media: '(max-width: 640px)', src: '/img-sm.jpg' })
      expect(result[1]).toEqual({ media: '(max-width: 1024px)', src: '/img-md.jpg' })
    })

    it('skips keys not present in merged breakpoints', () => {
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      const result = w.vm.resolveMediaSources({ sm: '/img-sm.jpg', xxl: '/img-xxl.jpg' })
      expect(result).toHaveLength(1)
      expect(result[0].src).toBe('/img-sm.jpg')
    })

    it('sorts max-width sources ascending (narrower first for <picture>)', () => {
      const global = {
        lg: '(max-width: 1024px)',
        sm: '(max-width: 640px)',
        md: '(max-width: 768px)',
      }
      const w = mountWithBreakpoints(global)
      const result = w.vm.resolveMediaSources({
        lg: '/img-lg.jpg',
        sm: '/img-sm.jpg',
        md: '/img-md.jpg',
      })
      expect(result.map(s => s.src)).toEqual(['/img-sm.jpg', '/img-md.jpg', '/img-lg.jpg'])
    })

    it('places non-max-width queries after max-width queries', () => {
      const global = {
        sm: '(max-width: 640px)',
        wide: '(min-width: 1440px)',
      }
      const w = mountWithBreakpoints(global)
      const result = w.vm.resolveMediaSources({ sm: '/sm.jpg', wide: '/wide.jpg' })
      expect(result).toHaveLength(2)
      expect(result[0].src).toBe('/sm.jpg')
      expect(result[1].src).toBe('/wide.jpg')
    })

    it('returns empty array for empty sources object', () => {
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      expect(w.vm.resolveMediaSources({})).toEqual([])
    })
  })

  describe('resolveMediaSources — art direction + format switching combined', () => {
    it('expands a SrcSet-valued breakpoint into avif/webp/fallback sources under the same media query', () => {
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      const result = w.vm.resolveMediaSources({
        sm: { avif: '/sm.avif', webp: '/sm.webp', fallback: '/sm.jpg' },
      })
      expect(result).toEqual([
        { media: '(max-width: 640px)', src: '/sm.avif', type: 'image/avif' },
        { media: '(max-width: 640px)', src: '/sm.webp', type: 'image/webp' },
        { media: '(max-width: 640px)', src: '/sm.jpg' },
      ])
    })

    it('omits missing avif/webp fields instead of emitting empty sources', () => {
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      const result = w.vm.resolveMediaSources({ sm: { webp: '/sm.webp', fallback: '/sm.jpg' } })
      expect(result).toEqual([
        { media: '(max-width: 640px)', src: '/sm.webp', type: 'image/webp' },
        { media: '(max-width: 640px)', src: '/sm.jpg' },
      ])
    })

    it('keeps each breakpoint group intact and in avif→webp→fallback order across multiple breakpoints', () => {
      const global = { sm: '(max-width: 640px)', md: '(max-width: 1024px)' }
      const w = mountWithBreakpoints(global)
      const result = w.vm.resolveMediaSources({
        md: { avif: '/md.avif', fallback: '/md.jpg' },
        sm: { avif: '/sm.avif', webp: '/sm.webp', fallback: '/sm.jpg' },
      })
      // sm sorts before md (max-width ascending), each group stays together and ordered.
      expect(result.map((s) => s.src)).toEqual(['/sm.avif', '/sm.webp', '/sm.jpg', '/md.avif', '/md.jpg'])
    })

    it('mixes plain-URL and SrcSet breakpoints in the same sources object', () => {
      const global = { sm: '(max-width: 640px)', wide: '(min-width: 1440px)' }
      const w = mountWithBreakpoints(global)
      const result = w.vm.resolveMediaSources({
        sm: '/sm.jpg',
        wide: { webp: '/wide.webp', fallback: '/wide.jpg' },
      })
      expect(result).toEqual([
        { media: '(max-width: 640px)', src: '/sm.jpg' },
        { media: '(min-width: 1440px)', src: '/wide.webp', type: 'image/webp' },
        { media: '(min-width: 1440px)', src: '/wide.jpg' },
      ])
    })
  })
})
