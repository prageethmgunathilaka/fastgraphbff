import { describe, it, expect } from 'vitest'

describe('Simple Test', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle basic string operations', () => {
    const str = 'hello world'
    expect(str).toContain('hello')
    expect(str.length).toBe(11)
  })
}) 