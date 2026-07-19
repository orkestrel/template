import type { TemplateInterface } from '@src/core'
import { isTemplateError, Template, TemplateManager } from '@src/core'
import { createRecorder } from '../../setup.js'
import { describe, expect, it } from 'vitest'

// TemplateManager not yet exported from the @src/core barrel (index.ts) — the
// orchestrator must add `export * from './TemplateManager.js'` to index.ts;
// this test imports the module path directly until that patch lands.

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

		try {
			manager.register({ id: 'greeting', name: 'greeting', content: 'Hi again' })
			expect.unreachable()
		} catch (error) {
			expect(isTemplateError(error)).toBe(true)
			if (isTemplateError(error)) expect(error.code).toBe('CONFLICT')
		}
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
		expect(manager.template('greeting').content).toBe('Hi again')
	})

	it('applies manager missing/locale defaults when registering a TemplateOptions bag', () => {
		const manager = new TemplateManager({ missing: 'empty', locale: 'de-DE' })

		const instance = manager.register({ id: 'greeting', name: 'greeting', content: 'Hi {{name}}' })

		expect(instance.fill({})).toBe('Hi ')
	})

	it('keeps a pre-built TemplateInterface instance\'s own defaults untouched', () => {
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
	it('throws TemplateError coded NOTFOUND for an unknown id', () => {
		const manager = new TemplateManager()

		try {
			manager.template('missing')
			expect.unreachable()
		} catch (error) {
			expect(isTemplateError(error)).toBe(true)
			if (isTemplateError(error)) expect(error.code).toBe('NOTFOUND')
		}
	})
})

describe('TemplateManager#templates', () => {
	it('returns a snapshot unaffected by mutating the returned array', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		const snapshot = manager.templates()
		snapshot.length = 0

		expect(manager.templates()).toHaveLength(1)
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

		expect(manager.find().map((t) => t.id).sort()).toEqual(['a', 'b'])
	})
})

describe('TemplateManager#has / #size', () => {
	it('has reports registered ids and not unregistered ones', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(manager.has('a')).toBe(true)
		expect(manager.has('b')).toBe(false)
	})

	it('size reflects the number of registered templates', () => {
		const manager = new TemplateManager()
		expect(manager.size).toBe(0)

		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		expect(manager.size).toBe(2)
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

	it('remove(ids[]) is all-or-nothing: any missing id leaves the collection untouched', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(manager.remove(['a', 'missing'])).toBe(false)
		expect(manager.has('a')).toBe(true)
	})

	it('remove(ids[]) removes every listed id and returns true when all present', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		expect(manager.remove(['a', 'b'])).toBe(true)
		expect(manager.size).toBe(0)
	})

	it('remove() removes every registered template and returns void', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		manager.register({ id: 'b', name: 'b', content: 'B' })

		const result = manager.remove()

		expect(result).toBeUndefined()
		expect(manager.size).toBe(0)
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

	it('does not emit remove when the batch remove fails (missing id)', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })
		const recorder = createRecorder<[template: TemplateInterface]>()
		manager.emitter.on('remove', recorder.handler)

		manager.remove(['a', 'missing'])

		expect(recorder.count).toBe(0)
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
})

describe('TemplateManager#clear', () => {
	it('removes every registered template', () => {
		const manager = new TemplateManager()
		manager.register({ id: 'a', name: 'a', content: 'A' })

		manager.clear()

		expect(manager.size).toBe(0)
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
		expect(manager.size).toBe(1)
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

		try {
			manager.fill('missing')
			expect.unreachable()
		} catch (error) {
			expect(isTemplateError(error)).toBe(true)
			if (isTemplateError(error)) expect(error.code).toBe('NOTFOUND')
		}
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

		try {
			manager.validate('missing')
			expect.unreachable()
		} catch (error) {
			expect(isTemplateError(error)).toBe(true)
			if (isTemplateError(error)) expect(error.code).toBe('NOTFOUND')
		}
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

		try {
			manager.parameters('missing')
			expect.unreachable()
		} catch (error) {
			expect(isTemplateError(error)).toBe(true)
			if (isTemplateError(error)) expect(error.code).toBe('NOTFOUND')
		}
	})

	it('a manager-registered TemplateOptions bag inherits the manager missing default through fill', () => {
		const manager = new TemplateManager({ missing: 'empty' })
		manager.register({ id: 'a', name: 'a', content: 'Hi {{name}}' })

		expect(manager.fill('a', {})).toBe('Hi ')
	})
})
