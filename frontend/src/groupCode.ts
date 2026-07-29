const GROUP_CODE_PATTERN = /^\d{6}(?:-\d{2})?$/
const DASH_PATTERN = /[‐‑‒–—−]+/g

export function normalizeGroupCode(value: string): string {
  return value.trim().replace(DASH_PATTERN, '-').replace(/\s+/g, '')
}

export function isValidGroupCode(value: string): boolean {
  return GROUP_CODE_PATTERN.test(normalizeGroupCode(value))
}

export const GROUP_CODE_HINT =
  'Введите шесть цифр, при необходимости — дефис и ещё две цифры.'
