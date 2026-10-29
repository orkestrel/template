import * as setup from './setup.js'
import { describe, expect, it } from 'vitest'

// tests/setup.test.ts — proves `tests/setup.ts`, `setupFiles[0]` for every Vitest project. The
// module exports only the fixtures the mirrored tests share and runs nothing when it loads.

describe('setup', () => {
	it('exports only the shared fixtures', () => {
		expect(Object.keys(setup)).toEqual(['createPlainTemplate'])
	})

	it('creates a structural template that fills its name placeholder', () => {
		const plain = setup.createPlainTemplate()
		expect(plain.id).toBe('plain')
		expect(plain.fill({ name: 'Ada' })).toBe('Hi Ada')
		expect(plain.validate({ name: 'Ada' })).toEqual({ valid: true, missing: [], extra: [] })
		expect(plain.definition()).toEqual({
			id: 'plain',
			name: 'plain',
			content: 'Hi {{name}}',
			placeholders: [],
		})
		expect(plain.parameters()).toBeUndefined()
	})
})
