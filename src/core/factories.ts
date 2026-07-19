import type { TemplateInterface, TemplateOptions } from './types.js'
import { Template } from './Template.js'

/**
 * Create a `TemplateInterface`.
 *
 * @param options - An optional `id` (defaults to a random UUID)
 * @returns A working {@link TemplateInterface}
 *
 * @example
 * ```ts
 * import { createTemplate } from '@src/core'
 *
 * const instance = createTemplate({ id: 'example' })
 * ```
 */
export function createTemplate(options: TemplateOptions = {}): TemplateInterface {
	return new Template(options)
}
