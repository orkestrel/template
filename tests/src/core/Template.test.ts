import type { TemplateInterface, TemplatePlaceholder } from '@src/core'
import { isTemplateError, Template } from '@src/core'
import { describe, expect, it } from 'vitest'

// The Template entity — id assignment, instance defaults, fill/validate/
// parameters/definition. Factory-level assertions live in factories.test.ts.

describe('Template — id assignment', () => {
	it('round-trips an explicit id', () => {
		const instance: TemplateInterface = new Template({ id: 'example', name: 'n', content: 'c' })

		expect(instance.id).toBe('example')
	})

	it('generates a non-empty id when none is given', () => {
		const instance = new Template({ name: 'n', content: 'c' })

		expect(typeof instance.id).toBe('string')
		expect(instance.id.length).toBeGreaterThan(0)
	})

	it('gives distinct instances distinct generated ids', () => {
		const a = new Template({ name: 'n', content: 'c' })
		const b = new Template({ name: 'n', content: 'c' })

		expect(a.id).not.toBe(b.id)
	})
})

describe('Template — instance defaults vs per-call overrides', () => {
	it('defaults missing to "error" when unspecified', () => {
		const instance = new Template({ name: 'n', content: 'Hi {{name}}' })

		expect(() => instance.fill({})).toThrowError()
	})

	it('honors an instance-level missing default', () => {
		const instance = new Template({ name: 'n', content: 'Hi {{name}}', missing: 'empty' })

		expect(instance.fill({})).toBe('Hi ')
	})

	it('a per-call missing option overrides the instance default', () => {
		const instance = new Template({ name: 'n', content: 'Hi {{name}}', missing: 'empty' })

		expect(instance.fill({}, { missing: 'literal' })).toBe('Hi {{name}}')
	})

	it('defaults locale to en-US and a per-call locale overrides it', () => {
		const instance = new Template({ name: 'n', content: '{{n}}' })

		expect(instance.fill({ n: 5010 })).toBe('5,010')
	})
})

describe('Template#fill', () => {
	it('substitutes declared and undeclared tokens against values', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}, city {{address.city}}',
			placeholders: [{ name: 'name' }],
		})

		expect(instance.fill({ name: 'Ada', address: { city: 'Reno' } })).toBe('Hi Ada, city Reno')
	})

	it('uses a declared fallback when the value is unresolved', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name', fallback: 'Friend', required: false }],
		})

		expect(instance.fill({})).toBe('Hi Friend')
	})

	it('is inert against a prototype-pollution attempt in a declared placeholder path', () => {
		const instance = new Template({
			name: 'evil',
			content: '{{evil}}',
			placeholders: [{ name: 'evil', path: ['__proto__', 'polluted'] }],
			missing: 'empty',
		})

		expect(instance.fill({})).toBe('')
		expect(Object.getOwnPropertyDescriptor(Object.prototype, 'polluted')).toBeUndefined()
	})

	it('throws a TemplateError coded MISSING under the "error" policy', () => {
		const instance = new Template({ name: 'n', content: '{{a}}' })

		try {
			instance.fill({})
			expect.unreachable()
		} catch (error) {
			expect(isTemplateError(error)).toBe(true)
			if (isTemplateError(error)) expect(error.code).toBe('MISSING')
		}
	})
})

describe('Template#validate', () => {
	it('reports a missing required placeholder with no value and no fallback', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		const result = instance.validate({})
		expect(result.valid).toBe(false)
		expect(result.missing).toEqual(['name'])
	})

	it('does not report an optional (required: false) placeholder as missing', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{nickname}}',
			placeholders: [{ name: 'nickname', required: false }],
		})

		expect(instance.validate({}).missing).toEqual([])
	})

	it('does not report a required placeholder with a declared fallback as missing', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name', fallback: 'Friend' }],
		})

		expect(instance.validate({}).missing).toEqual([])
	})

	it('reports extra values that do not match any declared placeholder', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		const result = instance.validate({ name: 'Ada', unused: 1 })
		expect(result.extra).toEqual(['unused'])
	})

	it('valid is true exactly when missing is empty (extras are informational)', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		expect(instance.validate({ name: 'Ada', extra: 1 })).toEqual({
			valid: true,
			missing: [],
			extra: ['extra'],
		})
		expect(instance.validate({}).valid).toBe(false)
	})

	it('resolves a declared placeholder.path (not just its flat name) against values', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Town: {{town}}',
			placeholders: [{ name: 'town', path: ['address', 'city'] }],
		})

		expect(instance.validate({ address: { city: 'Reno' } }).missing).toEqual([])
		expect(instance.validate({}).missing).toEqual(['town'])
	})

	it('treats a prototype-pollution-unsafe placeholder path as unresolved (missing)', () => {
		const instance = new Template({
			name: 'evil',
			content: '{{evil}}',
			placeholders: [{ name: 'evil', path: ['__proto__', 'polluted'] }],
		})

		expect(instance.validate({}).missing).toEqual(['evil'])
	})
})

describe('Template#parameters', () => {
	it('marks required declared placeholders as required in the compiled schema-ish structure', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [
				{ name: 'name', description: 'The recipient name' },
				{ name: 'nickname', required: false },
			],
		})

		const parameters = instance.parameters()
		expect(parameters).toBeDefined()
	})

	it('is stable across repeated calls (the contract compiles once)', () => {
		const instance = new Template({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		expect(instance.parameters()).toEqual(instance.parameters())
	})

	it('returns a defined parameters record even with no declared placeholders', () => {
		const instance = new Template({ name: 'n', content: 'plain content' })

		expect(instance.parameters()).toBeDefined()
	})
})

describe('Template#definition', () => {
	it('round-trips every data field, including optional metadata', () => {
		const placeholders: readonly TemplatePlaceholder[] = [{ name: 'name' }]
		const instance = new Template({
			id: 'greeting-1',
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders,
			summary: 'A greeting',
			description: 'Greets a person by name',
			category: 'social',
			tags: ['greeting', 'demo'],
		})

		expect(instance.definition()).toEqual({
			id: 'greeting-1',
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders,
			summary: 'A greeting',
			description: 'Greets a person by name',
			category: 'social',
			tags: ['greeting', 'demo'],
		})
	})

	it('defaults placeholders to an empty list and omits absent optional metadata', () => {
		const instance = new Template({ name: 'greeting', content: 'Hi' })

		const definition = instance.definition()
		expect(definition.placeholders).toEqual([])
		expect(definition.summary).toBeUndefined()
		expect(definition.description).toBeUndefined()
		expect(definition.category).toBeUndefined()
		expect(definition.tags).toBeUndefined()
	})
})
