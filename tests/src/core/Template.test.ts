import { describe, it, expect } from 'vitest'
import { Template, createTemplate } from '@scsr/core'

describe('Template', () => {
	describe('constructor', () => {
		it('creates with required fields', () => {
			const template = new Template({
				id: 'test',
				name: 'Test Template',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: true }],
			})

			expect(template.id).toBe('test')
			expect(template.name).toBe('Test Template')
			expect(template.content).toBe('Hello, {{name}}!')
			expect(template.placeholders).toHaveLength(1)
		})

		it('creates with optional fields', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Content',
				placeholders: [],
				summary: 'A summary',
				description: 'A description',
				category: 'test-category',
				tags: ['tag1', 'tag2'],
			})

			expect(template.summary).toBe('A summary')
			expect(template.description).toBe('A description')
			expect(template.category).toBe('test-category')
			expect(template.tags).toEqual(['tag1', 'tag2'])
		})

		it('returns undefined for missing optional fields', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Content',
				placeholders: [],
			})

			expect(template.summary).toBeUndefined()
			expect(template.description).toBeUndefined()
			expect(template.category).toBeUndefined()
			expect(template.tags).toBeUndefined()
		})
	})

	describe('factory', () => {
		it('creates via createTemplate', () => {
			const template = createTemplate({
				id: 'factory-test',
				name: 'Factory Test',
				content: '{{greeting}}',
				placeholders: [{ name: 'greeting' }],
			})

			expect(template.id).toBe('factory-test')
			expect(template.name).toBe('Factory Test')
		})
	})

	describe('placeholders getter', () => {
		it('returns a copy of placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: '{{a}} {{b}}',
				placeholders: [{ name: 'a' }, { name: 'b' }],
			})

			const placeholders1 = template.placeholders
			const placeholders2 = template.placeholders

			expect(placeholders1).not.toBe(placeholders2)
			expect(placeholders1).toEqual(placeholders2)
		})
	})

	describe('tags getter', () => {
		it('returns a copy of tags', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Content',
				placeholders: [],
				tags: ['a', 'b'],
			})

			const tags1 = template.tags
			const tags2 = template.tags

			expect(tags1).not.toBe(tags2)
			expect(tags1).toEqual(tags2)
		})
	})

	describe('fill', () => {
		it('fills single placeholder', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: true }],
			})

			expect(template.fill({ name: 'Alice' })).toBe('Hello, Alice!')
		})

		it('fills multiple placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: '{{greeting}}, {{name}}! Welcome to {{place}}.',
				placeholders: [
					{ name: 'greeting', required: true },
					{ name: 'name', required: true },
					{ name: 'place', required: true },
				],
			})

			const result = template.fill({
				greeting: 'Hello',
				name: 'Bob',
				place: 'Earth',
			})

			expect(result).toBe('Hello, Bob! Welcome to Earth.')
		})

		it('uses default values for optional placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}! Welcome to {{place}}.',
				placeholders: [
					{ name: 'name', required: true },
					{ name: 'place', value: 'the system' },
				],
			})

			expect(template.fill({ name: 'Alice' })).toBe('Hello, Alice! Welcome to the system.')
		})

		it('overrides default values when provided', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Welcome to {{place}}.',
				placeholders: [{ name: 'place', value: 'the system' }],
			})

			expect(template.fill({ place: 'Earth' })).toBe('Welcome to Earth.')
		})

		it('throws for missing required placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: true }],
			})

			expect(() => template.fill({})).toThrow('Missing required placeholders: name')
		})

		it('throws for multiple missing required placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: '{{a}} {{b}} {{c}}',
				placeholders: [
					{ name: 'a', required: true },
					{ name: 'b', required: true },
					{ name: 'c', required: true },
				],
			})

			expect(() => template.fill({ a: 'A' })).toThrow('Missing required placeholders: b, c')
		})

		it('handles placeholders with whitespace in braces', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{ name }}!',
				placeholders: [{ name: 'name', required: true }],
			})

			expect(template.fill({ name: 'Alice' })).toBe('Hello, Alice!')
		})

		it('handles same placeholder multiple times', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: '{{name}} said hello to {{name}}',
				placeholders: [{ name: 'name', required: true }],
			})

			expect(template.fill({ name: 'Alice' })).toBe('Alice said hello to Alice')
		})

		it('leaves unfilled placeholders when not in schema', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}! {{unknown}}',
				placeholders: [{ name: 'name', required: true }],
			})

			expect(template.fill({ name: 'Alice' })).toBe('Hello, Alice! {{unknown}}')
		})

		it('handles empty content', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: '',
				placeholders: [],
			})

			expect(template.fill({})).toBe('')
		})

		it('handles content with no placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Static content',
				placeholders: [],
			})

			expect(template.fill({})).toBe('Static content')
		})

		it('treats placeholder without explicit required as required', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name' }], // no required field, defaults to true
			})

			expect(() => template.fill({})).toThrow('Missing required placeholders: name')
		})

		it('allows missing placeholder when required is explicitly false', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: false }],
			})

			// Since no default value and not provided, the placeholder stays
			expect(template.fill({})).toBe('Hello, {{name}}!')
		})
	})

	describe('validate', () => {
		it('returns valid when all required placeholders provided', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: true }],
			})

			const result = template.validate({ name: 'Alice' })

			expect(result.valid).toBe(true)
			expect(result.missing).toEqual([])
			expect(result.extra).toEqual([])
		})

		it('returns invalid when required placeholders missing', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: true }],
			})

			const result = template.validate({})

			expect(result.valid).toBe(false)
			expect(result.missing).toEqual(['name'])
		})

		it('reports extra placeholders', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: true }],
			})

			const result = template.validate({ name: 'Alice', unknown: 'value' })

			expect(result.valid).toBe(true)
			expect(result.extra).toEqual(['unknown'])
		})

		it('valid when optional placeholder with default is missing', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Welcome to {{place}}.',
				placeholders: [{ name: 'place', value: 'the system' }],
			})

			const result = template.validate({})

			expect(result.valid).toBe(true)
			expect(result.missing).toEqual([])
		})

		it('valid when required: false placeholder is missing', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: 'Hello, {{name}}!',
				placeholders: [{ name: 'name', required: false }],
			})

			const result = template.validate({})

			expect(result.valid).toBe(true)
			expect(result.missing).toEqual([])
		})

		it('reports multiple missing and extra', () => {
			const template = new Template({
				id: 'test',
				name: 'Test',
				content: '{{a}} {{b}} {{c}}',
				placeholders: [
					{ name: 'a', required: true },
					{ name: 'b', required: true },
					{ name: 'c', required: true },
				],
			})

			const result = template.validate({ a: 'A', x: 'X', y: 'Y' })

			expect(result.valid).toBe(false)
			expect(result.missing).toEqual(['b', 'c'])
			expect(result.extra).toEqual(['x', 'y'])
		})
	})
})
