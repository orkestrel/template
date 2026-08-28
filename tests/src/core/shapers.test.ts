import type { TemplatePlaceholder } from '@src/core'
import { placeholderShape } from '@src/core'
import { createContract } from '@orkestrel/contract'
import { describe, expect, it } from 'vitest'

// The template shape leaf — `placeholderShape` compiles declared placeholders
// into the `@orkestrel/contract` object shape `Template#parameters` projects.

describe('placeholderShape', () => {
	it('builds a contract shape where required placeholders are required and optional ones are not', () => {
		const placeholders: readonly TemplatePlaceholder[] = [
			{ name: 'city', description: 'The city' },
			{ name: 'nickname', required: false },
		]
		const contract = createContract(placeholderShape(placeholders))
		expect(contract.schema.required).toContain('city')
		expect(contract.schema.required ?? []).not.toContain('nickname')
		expect(contract.schema.properties?.city?.description).toBe('The city')
	})

	it('builds an empty object shape for no placeholders', () => {
		const contract = createContract(placeholderShape([]))
		expect(contract.schema.required ?? []).toEqual([])
	})
})
