import type { TemplateInterface, TemplateOptions } from './types.js'

/**
 * A working `Template` — pure data, no behavior.
 *
 * @example
 * ```ts
 * const instance = new Template({ id: 'example' })
 * ```
 */
export class Template implements TemplateInterface {
	readonly id: string

	constructor(options: TemplateOptions = {}) {
		this.id = typeof options.id === 'string' ? options.id : crypto.randomUUID()
	}
}
