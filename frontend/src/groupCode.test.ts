import { describe, expect, it } from 'vitest'

import { isValidGroupCode, normalizeGroupCode } from './groupCode'

describe('group codes', () => {
  it('normalizes spaces and typographic dashes without changing digits', () => {
    expect(normalizeGroupCode(' 220 031 — 22 ')).toBe('220031-22')
  })

  it('accepts only the documented numeric formats', () => {
    expect(isValidGroupCode('222222')).toBe(true)
    expect(isValidGroupCode('220031‑22')).toBe(true)
    expect(isValidGroupCode('ИВТ-101')).toBe(false)
    expect(isValidGroupCode('220031-2')).toBe(false)
  })
})
