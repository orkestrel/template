import type { TemplateInterface } from '@src/core'
import { isTemplateError, Template, TemplateManager } from '@src/core'
import { captureError, createRecorder } from '@orkestrel/test'
import { describe, expect, it } from 'vitest'

describe('TemplateManager#register', () => {
	it('registers a TemplateOptions bag and returns the constructed instance', () => {
		const manager = new TemplateManager()

		const instance = manager.register({ id: 'greeting', name: 'greeting', content: 'Hi {{name}}' })

		expect(instance).toBeInstanceOf(Template)
		expect(instance.id).toBe('greeting')
		expect(manager.template('greeting')).toBe(instance)
	})

	it('throws TemplateError coded CONFLICT on a duplicate id without replace', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'greeting', name: 'greeting', content: 'Hi' })

		const error = captureError(() =>
			manager.register({ id: 'greeting', name: 'greeting', content: 'Hi again' }),
		)

		expect(isTemplateError(error) && error.code === 'CONFLICT').toBe(true)
	})

	it('replace: true overwrites the existing entry (old instance gone)', () => {
		const manager = new TemplateManager()
		const original = manager.register({ id: 'greeting', name: 'greeting', content: 'Hi' })

		const replacement = manager.register(
			{ id: 'greeting', name: 'greeting', content: 'Hi again' },
			{ replace: true },
		)

		expect(manager.template('greeting')).toBe(replacement)
		expect(manager.template('greeting')).not.toBe(original)
		expect(manager.template('greeting')?.content).toBe('Hi again')
	})

	it('applies manager missing/locale defaults when registering a TemplateOptions bag', () => {
		const manager = new TemplateManager({ missing: 'empty', locale: 'de-DE' })

		const instance = manager.register({ id: 'greeting', name: 'greeting', content: 'Hi {{name}}' })

		expect(instance.fill({})).toBe('Hi ')
	})

	it("keeps a pre-built TemplateInterface instance's own defaults untouched", () => {
		const manager = new TemplateManager({ missing: 'empty' })
		const prebuilt = new Template({
			id: 'greeting',
			name: 'greeting',
			content: 'Hi {{name}}',
			missing: 'literal',
		})

		const instance = manager.register(prebuilt)

		expect(instance).toBe(prebuilt)
		expect(instance.fill({})).toBe('Hi {{name}}')
	})

	it('emits register with the registered instance', () => {
		const manager = new TemplateManager()
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('register', recorder.handler)

		const instance = manager.register({ id: 'greeting', name: 'greeting', content: 'Hi' })

		expect(recorder.count).toBe(1)
		expect(recorder.calls[0]).toEqual([instance])
	})
})

describe('TemplateManager#template', () => {
	it('returns undefined for an unknown id', () => {
		const manager = new TemplateManager()

		expect(manager.template('missing')).toBeUndefined()
	})

	it('returns the registered instance for a known id', () => {
		const manager = new TemplateManager()
		const instance = manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(manager.template('a')).toBe(instance)
	})
})

describe('TemplateManager#templates', () => {
	it('returns a new array identity on every call, proving copy semantics', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(manager.templates()).not.toBe(manager.templates())
	})

	it('returns a snapshot unaffected by later registration', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		const snapshot = manager.templates()
		manager.register({ id: 'b', name: 'b', content: 'B' })

		expect(snapshot).toHaveLength(1)
		expect(manager.templates()).toHaveLength(2)
	})
})

describe('TemplateManager#find', () => {
	it('filters by exact name match', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'greeting', content: 'A' })
		manager.register({ id: 'b', name: 'farewell', content: 'B' })

		expect(manager.find({ name: 'greeting' }).map((t) => t.id)).toEqual(['a'])
	})

	it('filters by exact category match', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A', category: 'social' })
		manager.register({ id: 'b', name: 'b', content: 'B', category: 'formal' })

		expect(manager.find({ category: 'formal' }).map((t) => t.id)).toEqual(['b'])
	})

	it('filters by tag membership', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A', tags: ['x', 'y'] })
		manager.register({ id: 'b', name: 'b', content: 'B', tags: ['z'] })

		expect(manager.find({ tag: 'y' }).map((t) => t.id)).toEqual(['a'])
	})

	it('combines query fields with AND semantics', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'greeting', content: 'A', category: 'social', tags: ['x'] })
		manager.register({ id: 'b', name: 'greeting', content: 'B', category: 'formal', tags: ['x'] })

		expect(manager.find({ name: 'greeting', category: 'social' }).map((t) => t.id)).toEqual(['a'])
	})

	it('returns every registered template when no query is supplied', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		expect(
			manager
				.find()
				.map((t) => t.id)
				.sort(),
		).toEqual(['a', 'b'])
	})
})

describe('TemplateManager#has / #count', () => {
	it('has reports registered ids and not unregistered ones', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(manager.has('a')).toBe(true)
		expect(manager.has('b')).toBe(false)
	})

	it('count reflects the number of registered templates', () => {
		const manager = new TemplateManager()
		expect(manager.count).toBe(0)

		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		expect(manager.count).toBe(2)
	})
})

describe('TemplateManager#remove', () => {
	it('remove(id) returns true and removes a registered template', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(manager.remove('a')).toBe(true)
		expect(manager.has('a')).toBe(false)
	})

	it('remove(id) returns false for an unregistered id', () => {
		const manager = new TemplateManager()

		expect(manager.remove('missing')).toBe(false)
	})

	it('remove(ids[]) removes every present id and reports false when one is missing', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		expect(manager.remove(['a', 'missing'])).toBe(false)
		expect(manager.has('a')).toBe(false)
		expect(recorder.count).toBe(1)
	})

	it('remove(ids[]) removes every listed id and returns true when all present', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		expect(manager.remove(['a', 'b'])).toBe(true)
		expect(manager.count).toBe(0)
	})

	it('remove() removes every registered template and returns void', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		const result = manager.remove()

		expect(result).toBeUndefined()
		expect(manager.count).toBe(0)
	})

	it('emits remove with the removed instance for remove(id)', () => {
		const manager = new TemplateManager()
		const instance = manager.register({ id: 'a', name: 'a', content: 'A' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		manager.remove('a')

		expect(recorder.count).toBe(1)
		expect(recorder.calls[0]).toEqual([instance])
	})

	it('emits remove once per removed instance for remove(ids[])', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		manager.remove(['a', 'b'])

		expect(recorder.count).toBe(2)
	})

	it('emits remove for each present id when the batch remove reports false (missing id)', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		manager.remove(['a', 'missing'])

		expect(recorder.count).toBe(1)
	})

	it('emits remove once per registered template for remove()', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		manager.remove()

		expect(recorder.count).toBe(2)
	})

	it('remove(ids[]) over templates() purges the registry, emitting remove per instance', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		expect(manager.remove(manager.templates().map((one) => one.id))).toBe(true)

		expect(manager.count).toBe(0)
		expect(recorder.count).toBe(2)
	})
})

describe('TemplateManager#clear', () => {
	it('removes every registered template', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		manager.clear()

		expect(manager.count).toBe(0)
	})

	it('emits clear with no payload', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		const recorder = createRecorder<[]>()
		manager.emitter.on('clear', recorder.handler)

		manager.clear()

		expect(recorder.count).toBe(1)
		expect(recorder.calls[0]).toEqual([])
	})
})

describe('TemplateManager — constructor seeding', () => {
	it('seeds templates() from options.templates', () => {
		const manager = new TemplateManager({
			templates: [{ id: 'a', name: 'a', content: 'A' }],
		})

		expect(manager.has('a')).toBe(true)
		expect(manager.count).toBe(1)
	})

	it('does NOT emit register for seeded templates, even with a recorder wired via hooks at construction', () => {
		const recorder = createRecorder<[template: TemplateInterface]>()

		const manager = new TemplateManager({
			templates: [{ id: 'a', name: 'a', content: 'A' }],
			on: { register: recorder.handler },
		})

		expect(recorder.count).toBe(0)
		expect(manager.has('a')).toBe(true)
	})
})

describe('TemplateManager — fill/validate/parameters delegation', () => {
	it('fill delegates to the stored template', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'Hi {{name}}' })

		expect(manager.fill('a', { name: 'Ada' })).toBe('Hi Ada')
	})

	it('fill throws TemplateError coded NOTFOUND for an unknown id', () => {
		const manager = new TemplateManager()

		const error = captureError(() => manager.fill('missing'))

		expect(isTemplateError(error) && error.code === 'NOTFOUND').toBe(true)
	})

	it('validate delegates to the stored template', () => {
		const manager = new TemplateManager()
		manager.register({
			id: 'a',
			name: 'a',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		expect(manager.validate('a', {}).missing).toEqual(['name'])
	})

	it('validate throws TemplateError coded NOTFOUND for an unknown id', () => {
		const manager = new TemplateManager()

		const error = captureError(() => manager.validate('missing'))

		expect(isTemplateError(error) && error.code === 'NOTFOUND').toBe(true)
	})

	it('parameters delegates to the stored template', () => {
		const manager = new TemplateManager()
		manager.register({
			id: 'a',
			name: 'a',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		expect(manager.parameters('a')).toBeDefined()
	})

	it('parameters throws TemplateError coded NOTFOUND for an unknown id', () => {
		const manager = new TemplateManager()

		const error = captureError(() => manager.parameters('missing'))

		expect(isTemplateError(error) && error.code === 'NOTFOUND').toBe(true)
	})

	it('a manager-registered TemplateOptions bag inherits the manager missing default through fill', () => {
		const manager = new TemplateManager({ missing: 'empty' })
		manager.register({ id: 'a', name: 'a', content: 'Hi {{name}}' })

		expect(manager.fill('a', {})).toBe('Hi ')
	})
})

describe('TemplateManager — structural passthrough (R7)', () => {
	it('registers a plain object implementing TemplateInterface as-is (not a Template instance)', () => {
		const manager = new TemplateManager()
		const plain: TemplateInterface = {
			id: 'plain',
			name: 'plain',
			content: 'Hi {{name}}',
			placeholders: [],
			definition() {
				return {
					id: 'plain',
					name: 'plain',
					content: 'Hi {{name}}',
					placeholders: [],
				}
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

		const registered = manager.register(plain)

		expect(registered).toBe(plain)
		expect(manager.template('plain')).toBe(plain)
	})

	it('a TemplateOptions bag still instantiates with manager defaults', () => {
		const manager = new TemplateManager({ missing: 'empty', locale: 'de-DE' })

		const instance = manager.register({ id: 'bag', name: 'bag', content: 'Hi {{name}}' })

		expect(instance).toBeInstanceOf(Template)
		expect(instance.fill({})).toBe('Hi ')
	})
})
