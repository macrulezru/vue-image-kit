import { describe, it, expect, vi, afterEach } from 'vitest'
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
      expect(result.map((s) => s.src)).toEqual(['/img-sm.jpg', '/img-md.jpg', '/img-lg.jpg'])
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
      expect(result.map((s) => s.src)).toEqual([
        '/sm.avif',
        '/sm.webp',
        '/sm.jpg',
        '/md.avif',
        '/md.jpg',
      ])
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

  describe('resolveMediaSources — sizes for art-direction sources', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('applies width/height/sizes to every format variant of a ResponsiveSource entry', () => {
      const w = mountWithBreakpoints({ tablet: '(max-width: 1024px)' })
      const result = w.vm.resolveMediaSources({
        tablet: {
          src: { avif: '/t.avif', webp: '/t.webp', fallback: '/t.jpg' },
          width: 1400,
          height: 700,
          sizes: '100vw',
        },
      })
      expect(result).toEqual([
        {
          media: '(max-width: 1024px)',
          src: '/t.avif',
          type: 'image/avif',
          width: 1400,
          height: 700,
          sizes: '100vw',
        },
        {
          media: '(max-width: 1024px)',
          src: '/t.webp',
          type: 'image/webp',
          width: 1400,
          height: 700,
          sizes: '100vw',
        },
        { media: '(max-width: 1024px)', src: '/t.jpg', width: 1400, height: 700, sizes: '100vw' },
      ])
    })

    it("uses a ResponsiveSource's own srcset for the fallback variant only, not the avif/webp variants", () => {
      const w = mountWithBreakpoints({ tablet: '(max-width: 1024px)' })
      const result = w.vm.resolveMediaSources({
        tablet: {
          src: { webp: '/t.webp', fallback: '/t.jpg' },
          srcset: '/t-400.jpg 400w, /t-800.jpg 800w',
        },
      })
      expect(result).toEqual([
        { media: '(max-width: 1024px)', src: '/t.webp', type: 'image/webp' },
        { media: '(max-width: 1024px)', src: '/t-400.jpg 400w, /t-800.jpg 800w' },
      ])
    })

    it('leaves plain string/SrcSet entries with no width/height/sizes keys at all (unchanged DOM contract)', () => {
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      const result = w.vm.resolveMediaSources({ sm: '/sm.jpg' })
      expect(Object.keys(result[0])).toEqual(['media', 'src'])
    })

    it('warns in dev mode on a sources key with no matching breakpoint, naming the key and available breakpoints', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      w.vm.resolveMediaSources({ xxl: '/xxl.jpg' })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"xxl"'))
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sm'))
      warnSpy.mockRestore()
    })

    it('does not warn in production mode on an unknown breakpoint key', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = mountWithBreakpoints({ sm: '(max-width: 640px)' })
      w.vm.resolveMediaSources({ xxl: '/xxl.jpg' })
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('warns in dev mode when only one of width/height is set, and applies neither', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = mountWithBreakpoints({ tablet: '(max-width: 1024px)' })
      const result = w.vm.resolveMediaSources({ tablet: { src: '/t.jpg', width: 1400 } })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('tablet'))
      expect(result[0]).toEqual({ media: '(max-width: 1024px)', src: '/t.jpg' })
      warnSpy.mockRestore()
    })

    it('does not warn when width/height are both set, or both absent', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = mountWithBreakpoints({ tablet: '(max-width: 1024px)' })
      w.vm.resolveMediaSources({ tablet: { src: '/t.jpg', width: 1400, height: 700 } })
      w.vm.resolveMediaSources({ tablet: '/t.jpg' })
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('normalizes an ImageMeta entry the same way as a ResponsiveSource', () => {
      const w = mountWithBreakpoints({ tablet: '(max-width: 1024px)' })
      const result = w.vm.resolveMediaSources({
        tablet: { src: '/t.jpg', avif: '/t.avif', width: 1400, height: 700 },
      })
      expect(result).toEqual([
        {
          media: '(max-width: 1024px)',
          src: '/t.avif',
          type: 'image/avif',
          width: 1400,
          height: 700,
        },
        { media: '(max-width: 1024px)', src: '/t.jpg', width: 1400, height: 700 },
      ])
    })

    it('sorting is unaffected by the added width/height/sizes fields', () => {
      const global = { lg: '(max-width: 1024px)', sm: '(max-width: 640px)' }
      const w = mountWithBreakpoints(global)
      const result = w.vm.resolveMediaSources({
        lg: { src: '/lg.jpg', width: 1024, height: 500 },
        sm: { src: '/sm.jpg', width: 640, height: 400 },
      })
      expect(result.map((s) => s.src)).toEqual(['/sm.jpg', '/lg.jpg'])
    })
  })
})
