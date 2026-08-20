import { describe, it, expect } from 'vitest'
import { checkAltText } from '../../src/utils/a11y'

describe('checkAltText', () => {
  it('flags a missing (undefined/null) alt', () => {
    expect(checkAltText(undefined)).toMatch(/missing/)
    expect(checkAltText(null)).toMatch(/missing/)
  })

  it('does not flag an empty string — the documented decorative-image marker', () => {
    expect(checkAltText('')).toBeNull()
  })

  it('flags whitespace-only alt', () => {
    expect(checkAltText('   ')).toMatch(/whitespace-only/)
    expect(checkAltText('\t\n')).toMatch(/whitespace-only/)
  })

  it('flags alt that looks like a filename', () => {
    expect(checkAltText('photo1.jpg')).toMatch(/filename/)
    expect(checkAltText('IMG_1234.PNG')).toMatch(/filename/)
    expect(checkAltText('hero.webp')).toMatch(/filename/)
    expect(checkAltText('icon.svg')).toMatch(/filename/)
  })

  it('does not flag real descriptive text', () => {
    expect(checkAltText('A golden retriever running on the beach')).toBeNull()
    expect(checkAltText('Team photo from the 2025 offsite')).toBeNull()
  })

  it('does not flag descriptive text that merely contains a dot', () => {
    expect(checkAltText('Q3 2025 revenue chart')).toBeNull()
  })

  it('ignores non-string values instead of throwing', () => {
    expect(checkAltText(42)).toBeNull()
    expect(checkAltText({})).toBeNull()
  })
})
