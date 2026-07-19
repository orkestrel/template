import type { TemplateInterface } from '@src/core'
import { createTemplate, Template } from '@src/core'
import { describe, expect, expectTypeOf, it } from 'vitest'

// The Template factory — that `createTemplate` returns a working TemplateInterface
// backed by a real Template instance.

describe('createTemplate', () => {
	it('returns a Template instance', () => {
		const instance = createTemplate()

		expect(instance).toBeInstanceOf(Template)
	})

	it('honors the id option', () => {
		const instance = createTemplate({ id: 'example' })

		expect(instance.id).toBe('example')
	})

	it('createTemplate returns a TemplateInterface', () => {
		expectTypeOf(createTemplate()).toEqualTypeOf<TemplateInterface>()
	})
})
