import type { TemplateErrorCode } from './types.js'
import { holds, INTRINSICS, isObject } from '@orkestrel/contract'

// Misuse of the template layer `throw`s a `TemplateError` carrying a
// machine-readable `code`, so a `catch` branches on `error.code`.

/**
 * Represents an error thrown by the template layer — a machine-readable
 * {@link TemplateErrorCode} and an optional `context` record naming the
 * offending id or placeholder name.
 *
 * @remarks
 * Thrown for: a required placeholder staying unresolved under the `error`
 * {@link MissingPolicy} (`MISSING`), an unknown template id
 * (`NOTFOUND`), `createTemplate` handed invalid data (`INVALID`), and
 * `TemplateManagerInterface#register` handed an id already present without
 * `options.replace` (`CONFLICT`).
 */
export class TemplateError extends Error {
	readonly code: TemplateErrorCode
	readonly context?: Readonly<Record<string, unknown>>

	constructor(
		code: TemplateErrorCode,
		message: string,
		context?: Readonly<Record<string, unknown>>,
	) {
		super(message)
		INTRINSICS.define(this, Symbol.for('@orkestrel/template.TemplateError'), { value: this })
		this.name = 'TemplateError'
		this.code = code
		if (context !== undefined) this.context = context
	}
}

/**
 * Narrows an unknown caught value to a {@link TemplateError}.
 *
 * @remarks
 * Recognizes self-branded errors from other package copies and subclasses, and
 * refuses transparent proxies and unbranded look-alikes.
 *
 * @param value - The value to test (typically a `catch` binding)
 * @returns True if `value` is a {@link TemplateError}; false otherwise
 *
 * @example
 * ```ts
 * import { isTemplateError } from '@src/core'
 *
 * try {
 * 	manager.fill('missing')
 * } catch (error) {
 * 	if (isTemplateError(error) && error.code === 'NOTFOUND') return
 * }
 * ```
 */
export function isTemplateError(value: unknown): value is TemplateError {
	return holds(() => {
		if (!(value instanceof Error) || INTRINSICS.prototype(value) === Error.prototype) return false
		if (
			INTRINSICS.describe(value, Symbol.for('@orkestrel/template.TemplateError'))?.value !== value
		)
			return false
		const code: unknown = INTRINSICS.reflect.read(value, 'code')
		const context: unknown = INTRINSICS.reflect.read(value, 'context')
		return (
			(code === 'MISSING' || code === 'NOTFOUND' || code === 'INVALID' || code === 'CONFLICT') &&
			(context === undefined || isObject(context))
		)
	})
}
