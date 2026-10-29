import type { TemplateInterface } from '@src/core'

// ── Environment-agnostic base setup ──────────────────────────────────────────
//
// The fleet-wide helpers live in `@orkestrel/test`. What remains here is what is
// specific to this package.

/** Creates a structural template implementation for manager registration. */
export function createPlainTemplate(): TemplateInterface {
	return {
		id: 'plain',
		name: 'plain',
		content: 'Hi {{name}}',
		placeholders: [],
		definition() {
			return { id: 'plain', name: 'plain', content: 'Hi {{name}}', placeholders: [] }
		},
		fill(values) {
			return `Hi ${String(values?.name ?? '')}`
		},
		validate() {
			return { valid: true, missing: [], extra: [] }
		},
		parameters() {
			return undefined
		},
	}
}
