import type { TemplateInterface } from '@src/core'
import { Template } from '@src/core'
import { describe, expect, it } from 'vitest'

// The Template entity — id assignment (explicit / generated) and independence
// across instances. Factory-level assertions live in factories.test.ts.

describe('Template', () => {
	it('round-trips an explicit id', () => {
		const instance: TemplateInterface = new Template({ id: 'example' })

		expect(instance.id).toBe('example')
	})

	it('generates a non-empty id when none is given', () => {
		const instance = new Template()

		expect(typeof instance.id).toBe('string')
		expect(instance.id.length).toBeGreaterThan(0)
	})

	it('gives distinct instances distinct generated ids', () => {
		const a = new Template()
		const b = new Template()

		expect(a.id).not.toBe(b.id)
	})
})
