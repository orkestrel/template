import type {
	TemplateInterface,
	TemplateManagerInterface,
	TemplateManagerOptions,
	TemplateOptions,
} from './types.js'
import { Template } from './templates/Template.js'
import { TemplateManager } from './templates/TemplateManager.js'

/**
 * Creates a working {@link TemplateInterface} from a {@link TemplateOptions}
 * bag, backed by the `Template` class.
 *
 * @param options - The template's `name` / `content`, an optional `id`
 *   (defaults to a generated UUID), `placeholders`, catalog metadata, and
 *   `missing` / `locale` fill defaults
 * @returns A working {@link TemplateInterface}
 * @throws {@link TemplateError} Thrown when `options.placeholders` declares a duplicate `name` or an empty `path` (coded `INVALID`)
 *
 * @example Create a template and a registry
 * ```ts
 * import { createTemplate, createTemplateManager } from '@orkestrel/template'
 *
 * const greeting = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })
 * greeting.fill({ name: 'Ada' }) // 'Hi Ada'
 *
 * const templates = createTemplateManager({
 * 	templates: [
 * 		{ id: 'greeting', name: 'greeting', content: 'Hi {{name}}', category: 'mail' },
 * 		{ id: 'farewell', name: 'farewell', content: 'Bye {{name}}', category: 'mail' },
 * 		{ id: 'alert', name: 'alert', content: 'Alert: {{reason}}', category: 'ops' },
 * 	],
 * })
 * templates.fill('greeting', { name: 'Ada' }) // 'Hi Ada'
 * templates.find({ category: 'mail' }).map((one) => one.id) // ['greeting', 'farewell']
 * templates.has('alert') // true
 * templates.has('missing') // false
 * ```
 */
export function createTemplate(options: TemplateOptions): TemplateInterface {
	return new Template(options)
}

/**
 * Creates a working {@link TemplateManagerInterface}, optionally seeded with
 * the templates the options carry, backed by the `TemplateManager` class.
 *
 * @param options - Optional initial `templates` seed collection and
 *   manager-wide `missing` / `locale` fill defaults, emitter `on` hooks, and
 *   an `error` handler
 * @returns A working {@link TemplateManagerInterface}
 * @throws {@link TemplateError} Thrown when a seeded `options.templates` bag declares a duplicate placeholder `name` or an empty `path` (coded `INVALID`)
 *
 * @example
 * ```ts
 * import { createTemplateManager } from '@src/core'
 *
 * const templates = createTemplateManager({
 * 	templates: [{ id: 'greeting', name: 'greeting', content: 'Hi {{name}}' }],
 * })
 * templates.fill('greeting', { name: 'Ada' }) // 'Hi Ada'
 * ```
 */
export function createTemplateManager(options?: TemplateManagerOptions): TemplateManagerInterface {
	return new TemplateManager(options)
}
