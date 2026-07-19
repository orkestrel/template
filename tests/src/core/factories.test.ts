import type { TemplateInterface, TemplateManagerInterface } from '@src/core'
import { createTemplate, createTemplateManager, Template, TemplateManager } from '@src/core'
import { createRecorder } from '../../setup.js'
import { describe, expect, expectTypeOf, it } from 'vitest'

// The Template / TemplateManager factories — that createTemplate / createTemplateManager
// return working instances backed by the real Template / TemplateManager classes.

describe('createTemplate', () => {
	it('returns a Template instance', () => {
		const instance = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })

		expect(instance).toBeInstanceOf(Template)
	})

	it('honors the id option', () => {
		const instance = createTemplate({ id: 'example', name: 'greeting', content: 'Hi' })

		expect(instance.id).toBe('example')
	})

	it('generates an id when omitted', () => {
		const instance = createTemplate({ name: 'greeting', content: 'Hi' })

		expect(typeof instance.id).toBe('string')
		expect(instance.id.length).toBeGreaterThan(0)
	})

	it('fills content against values', () => {
		const instance = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })

		expect(instance.fill({ name: 'Ada' })).toBe('Hi Ada')
	})

	it('createTemplate returns a TemplateInterface', () => {
		expectTypeOf(
			createTemplate({ name: 'greeting', content: 'Hi' }),
		).toEqualTypeOf<TemplateInterface>()
	})
})

describe('createTemplateManager', () => {
	it('returns a TemplateManager instance', () => {
		const manager = createTemplateManager()

		expect(manager).toBeInstanceOf(TemplateManager)
	})

	it('registers and retrieves a template', () => {
		const manager = createTemplateManager()

		const instance = manager.register({ id: 'a', name: 'a', content: 'Hi {{name}}' })

		expect(manager.template('a')).toBe(instance)
		expect(manager.fill('a', { name: 'Ada' })).toBe('Hi Ada')
	})

	it('seeds templates() from options.templates', () => {
		const manager = createTemplateManager({
			templates: [{ id: 'a', name: 'a', content: 'A' }],
		})

		expect(manager.has('a')).toBe(true)
		expect(manager.size).toBe(1)
	})

	it('applies manager missing/locale defaults to option-bags registered through it', () => {
		const manager = createTemplateManager({ missing: 'empty', locale: 'de-DE' })

		const instance = manager.register({ id: 'a', name: 'a', content: 'Hi {{name}}' })

		expect(instance.fill({})).toBe('Hi ')
	})

	it('wires on hooks at construction, observed on a register event', () => {
		const recorder = createRecorder<[template: TemplateInterface]>()

		const manager = createTemplateManager({ on: { register: recorder.handler } })
		const instance = manager.register({ id: 'a', name: 'a', content: 'A' })

		expect(recorder.count).toBe(1)
		expect(recorder.calls[0]).toEqual([instance])
	})

	it('createTemplateManager returns a TemplateManagerInterface', () => {
		expectTypeOf(createTemplateManager()).toEqualTypeOf<TemplateManagerInterface>()
	})
})
