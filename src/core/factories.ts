import type {
	TemplateInterface,
	TemplateManagerInterface,
	TemplateManagerOptions,
	TemplateOptions,
} from './types.js'
import { Template } from './Template.js'
import { TemplateManager } from './TemplateManager.js'

/**
 * Creates a template.
 *
 * @param options - The template's `name` / `content`, an optional `id`
 *   (defaults to a generated UUID), `placeholders`, catalog metadata, and
 *   `missing` / `locale` fill defaults
 * @returns A working {@link TemplateInterface}
 *
 * @example
 * ```ts
 * import { createTemplate } from '@src/core'
 *
 * const greeting = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })
 * greeting.fill({ name: 'Ada' }) // 'Hi Ada'
 * ```
 */
export function createTemplate(options: TemplateOptions): TemplateInterface {
	return new Template(options)
}

/**
 * Creates a template registry.
 *
 * @param options - Optional initial `templates` seed collection and
 *   manager-wide `missing` / `locale` fill defaults, emitter `on` hooks, and
 *   an `error` handler
 * @returns A working {@link TemplateManagerInterface}
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
