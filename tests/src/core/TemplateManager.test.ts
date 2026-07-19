import { describe, it, expect } from 'vitest'
import { TemplateManager, createTemplateManager } from '@scsr/core'

describe('TemplateManager', () => {
	describe('constructor', () => {
		it('creates with no options', () => {
			const manager = new TemplateManager()

			expect(manager.count).toBe(0)
		})

		it('creates with initial templates', () => {
			const manager = new TemplateManager({
				templates: [
					{
						id: 'greeting',
						name: 'Greeting',
						content: 'Hello, {{name}}!',
						placeholders: [{ name: 'name', required: true }],
					},
					{
						id: 'farewell',
						name: 'Farewell',
						content: 'Goodbye, {{name}}!',
						placeholders: [{ name: 'name', required: true }],
					},
				],
			})

			expect(manager.count).toBe(2)
		})
	})

	describe('factory', () => {
		it('creates via createTemplateManager', () => {
			const manager = createTemplateManager()

			expect(manager.count).toBe(0)
		})

		it('creates via factory with templates', () => {
			const manager = createTemplateManager({
				templates: [
					{
						id: 'test',
						name: 'Test',
						content: '{{x}}',
						placeholders: [{ name: 'x' }],
					},
				],
			})

			expect(manager.count).toBe(1)
		})
	})

	describe('register', () => {
		it('adds a template', () => {
			const manager = new TemplateManager()

			manager.register({
				id: 'test',
				name: 'Test',
				content: 'Content',
				placeholders: [],
			})

			expect(manager.count).toBe(1)
			expect(manager.has('test')).toBe(true)
		})

		it('overwrites existing template with same id', () => {
			const manager = new TemplateManager()

			manager.register({
				id: 'test',
				name: 'Original',
				content: 'Original content',
				placeholders: [],
			})

			manager.register({
				id: 'test',
				name: 'Updated',
				content: 'Updated content',
				placeholders: [],
			})

			expect(manager.count).toBe(1)
			expect(manager.template('test')?.name).toBe('Updated')
		})
	})

	describe('template', () => {
		it('returns template by id', () => {
			const manager = new TemplateManager({
				templates: [
					{
						id: 'greeting',
						name: 'Greeting',
						content: 'Hello!',
						placeholders: [],
					},
				],
			})

			const template = manager.template('greeting')

			expect(template).toBeDefined()
			expect(template?.id).toBe('greeting')
			expect(template?.name).toBe('Greeting')
		})

		it('returns undefined for unknown id', () => {
			const manager = new TemplateManager()

			expect(manager.template('unknown')).toBeUndefined()
		})
	})

	describe('templates', () => {
		it('returns all templates as array', () => {
			const manager = new TemplateManager({
				templates: [
					{ id: 'a', name: 'A', content: 'A', placeholders: [] },
					{ id: 'b', name: 'B', content: 'B', placeholders: [] },
					{ id: 'c', name: 'C', content: 'C', placeholders: [] },
				],
			})

			const templates = manager.templates()

			expect(templates).toHaveLength(3)
			expect(templates.map((t) => t.id)).toEqual(['a', 'b', 'c'])
		})

		it('returns empty array when no templates', () => {
			const manager = new TemplateManager()

			expect(manager.templates()).toEqual([])
		})
	})

	describe('has', () => {
		it('returns true when template exists', () => {
			const manager = new TemplateManager({
				templates: [{ id: 'test', name: 'Test', content: '', placeholders: [] }],
			})

			expect(manager.has('test')).toBe(true)
		})

		it('returns false when template does not exist', () => {
			const manager = new TemplateManager()

			expect(manager.has('missing')).toBe(false)
		})
	})

	describe('remove', () => {
		it('removes existing template', () => {
			const manager = new TemplateManager({
				templates: [{ id: 'test', name: 'Test', content: '', placeholders: [] }],
			})

			const removed = manager.remove('test')

			expect(removed).toBe(true)
			expect(manager.has('test')).toBe(false)
			expect(manager.count).toBe(0)
		})

		it('returns false for non-existent template', () => {
			const manager = new TemplateManager()

			expect(manager.remove('unknown')).toBe(false)
		})
	})

	describe('clear', () => {
		it('removes all templates', () => {
			const manager = new TemplateManager({
				templates: [
					{ id: 'a', name: 'A', content: '', placeholders: [] },
					{ id: 'b', name: 'B', content: '', placeholders: [] },
				],
			})

			manager.clear()

			expect(manager.count).toBe(0)
		})

		it('is safe on empty manager', () => {
			const manager = new TemplateManager()

			manager.clear()

			expect(manager.count).toBe(0)
		})
	})

	describe('fill', () => {
		it('fills template with values', () => {
			const manager = new TemplateManager({
				templates: [
					{
						id: 'greeting',
						name: 'Greeting',
						content: 'Hello, {{name}}!',
						placeholders: [{ name: 'name', required: true }],
					},
				],
			})

			expect(manager.fill('greeting', { name: 'Alice' })).toBe('Hello, Alice!')
		})

		it('throws for unknown template', () => {
			const manager = new TemplateManager()

			expect(() => manager.fill('unknown', {})).toThrow('Template not found: unknown')
		})

		it('throws for missing required placeholders', () => {
			const manager = new TemplateManager({
				templates: [
					{
						id: 'test',
						name: 'Test',
						content: '{{required}}',
						placeholders: [{ name: 'required', required: true }],
					},
				],
			})

			expect(() => manager.fill('test', {})).toThrow('Missing required placeholders: required')
		})
	})

	describe('validate', () => {
		it('validates template with values', () => {
			const manager = new TemplateManager({
				templates: [
					{
						id: 'test',
						name: 'Test',
						content: '{{a}} {{b}}',
						placeholders: [
							{ name: 'a', required: true },
							{ name: 'b', required: true },
						],
					},
				],
			})

			const result = manager.validate('test', { a: 'A', b: 'B' })

			expect(result.valid).toBe(true)
		})

		it('throws for unknown template', () => {
			const manager = new TemplateManager()

			expect(() => manager.validate('unknown', {})).toThrow('Template not found: unknown')
		})

		it('returns missing and extra fields', () => {
			const manager = new TemplateManager({
				templates: [
					{
						id: 'test',
						name: 'Test',
						content: '{{a}}',
						placeholders: [{ name: 'a', required: true }],
					},
				],
			})

			const result = manager.validate('test', { x: 'X' })

			expect(result.valid).toBe(false)
			expect(result.missing).toEqual(['a'])
			expect(result.extra).toEqual(['x'])
		})
	})

	describe('findByTag', () => {
		it('returns templates with matching tag', () => {
			const manager = new TemplateManager({
				templates: [
					{ id: 'a', name: 'A', content: '', placeholders: [], tags: ['foo', 'bar'] },
					{ id: 'b', name: 'B', content: '', placeholders: [], tags: ['bar'] },
					{ id: 'c', name: 'C', content: '', placeholders: [], tags: ['baz'] },
				],
			})

			const results = manager.findByTag('bar')

			expect(results).toHaveLength(2)
			expect(results.map((t) => t.id)).toEqual(['a', 'b'])
		})

		it('returns empty array for unknown tag', () => {
			const manager = new TemplateManager({
				templates: [{ id: 'a', name: 'A', content: '', placeholders: [], tags: ['foo'] }],
			})

			expect(manager.findByTag('unknown')).toEqual([])
		})

		it('returns empty array when no templates have tags', () => {
			const manager = new TemplateManager({
				templates: [{ id: 'a', name: 'A', content: '', placeholders: [] }],
			})

			expect(manager.findByTag('any')).toEqual([])
		})
	})

	describe('findByCategory', () => {
		it('returns templates with matching category', () => {
			const manager = new TemplateManager({
				templates: [
					{ id: 'a', name: 'A', content: '', placeholders: [], category: 'greetings' },
					{ id: 'b', name: 'B', content: '', placeholders: [], category: 'greetings' },
					{ id: 'c', name: 'C', content: '', placeholders: [], category: 'farewells' },
				],
			})

			const results = manager.findByCategory('greetings')

			expect(results).toHaveLength(2)
			expect(results.map((t) => t.id)).toEqual(['a', 'b'])
		})

		it('returns empty array for unknown category', () => {
			const manager = new TemplateManager({
				templates: [{ id: 'a', name: 'A', content: '', placeholders: [], category: 'foo' }],
			})

			expect(manager.findByCategory('unknown')).toEqual([])
		})

		it('returns empty array when no templates have categories', () => {
			const manager = new TemplateManager({
				templates: [{ id: 'a', name: 'A', content: '', placeholders: [] }],
			})

			expect(manager.findByCategory('any')).toEqual([])
		})
	})
})

describe('emitter', () => {
	const TEMPLATE = {
		id: 'test',
		name: 'Test',
		content: 'Hello {{name}}',
		placeholders: [{ name: 'name', required: true }],
	}

	it('emits register event with template', () => {
		const manager = new TemplateManager()
		const received: { readonly id: string }[] = []
		manager.emitter.on('register', (template) => {
			received.push(template)
		})
		manager.register(TEMPLATE)
		expect(received).toHaveLength(1)
		expect(received[0].id).toBe('test')
	})

	it('emits remove event with id', () => {
		const manager = new TemplateManager({ templates: [TEMPLATE] })
		const received: string[] = []
		manager.emitter.on('remove', (id) => {
			received.push(id)
		})
		manager.remove('test')
		expect(received).toEqual(['test'])
	})

	it('does not emit remove when template does not exist', () => {
		const manager = new TemplateManager()
		let calls = 0
		manager.emitter.on('remove', () => {
			calls++
		})
		manager.remove('nonexistent')
		expect(calls).toBe(0)
	})

	it('emits clear event', () => {
		const manager = new TemplateManager({ templates: [TEMPLATE] })
		let calls = 0
		manager.emitter.on('clear', () => {
			calls++
		})
		manager.clear()
		expect(calls).toBe(1)
	})

	it('unsubscribe stops receiving events', () => {
		const manager = new TemplateManager()
		let calls = 0
		const off = manager.emitter.on('register', () => {
			calls++
		})
		off()
		manager.register(TEMPLATE)
		expect(calls).toBe(0)
	})
})
