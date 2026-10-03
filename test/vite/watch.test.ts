import { describe, it, expect } from 'vitest'
import { createRunQueue, isInsideDir } from '../../src/vite/watch'

describe('isInsideDir', () => {
  it('is true for a file under the directory, at any depth', () => {
    expect(isInsideDir('/p/src/images/a.png', '/p/src/images')).toBe(true)
    expect(isInsideDir('/p/src/images/deep/er/a.png', '/p/src/images')).toBe(true)
  })

  it('is false for the directory itself, a sibling and a parent', () => {
    expect(isInsideDir('/p/src/images', '/p/src/images')).toBe(false)
    expect(isInsideDir('/p/src/images2/a.png', '/p/src/images')).toBe(false)
    expect(isInsideDir('/p/src/a.png', '/p/src/images')).toBe(false)
  })

  it('resolves relative paths against the working directory', () => {
    expect(isInsideDir('./src/images/a.png', './src/images')).toBe(true)
    expect(isInsideDir('./public/a.png', './src/images')).toBe(false)
  })
})

describe('createRunQueue', () => {
  function slowRunner() {
    let calls = 0
    let active = 0
    let maxActive = 0
    const run = async () => {
      calls++
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 20))
      active--
    }
    return { run, stats: () => ({ calls, maxActive }) }
  }

  it('runs once for a single request', async () => {
    const { run, stats } = slowRunner()
    await createRunQueue(run)()
    expect(stats().calls).toBe(1)
  })

  it('never runs two at once and collapses a burst into one follow-up run', async () => {
    const { run, stats } = slowRunner()
    const queue = createRunQueue(run)
    await Promise.all([queue(), queue(), queue(), queue(), queue()])
    expect(stats().maxActive).toBe(1)
    expect(stats().calls).toBe(2)
  })

  it('can be used again after it finished', async () => {
    const { run, stats } = slowRunner()
    const queue = createRunQueue(run)
    await queue()
    await queue()
    expect(stats().calls).toBe(2)
  })

  it('recovers after a failing run', async () => {
    let fail = true
    let calls = 0
    const queue = createRunQueue(async () => {
      calls++
      if (fail) throw new Error('boom')
    })
    await expect(queue()).rejects.toThrow('boom')
    fail = false
    await queue()
    expect(calls).toBe(2)
  })
})
