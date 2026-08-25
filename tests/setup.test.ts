import { describe, expect, it } from 'vitest'
import { isBrowserVuePath } from './setup.js'

describe('isBrowserVuePath', () => {
	it('accepts a browser Vue SFC path under every separator family', () => {
		expect(isBrowserVuePath('app/browser/components/Widget.vue')).toBe(true)
		expect(isBrowserVuePath('app\\browser\\components\\Widget.vue')).toBe(true)
	})

	it('refuses a sibling environment and a prefix lookalike', () => {
		expect(isBrowserVuePath('app/server/components/Widget.vue')).toBe(false)
		expect(isBrowserVuePath('app/browserish/components/Widget.vue')).toBe(false)
	})
})
