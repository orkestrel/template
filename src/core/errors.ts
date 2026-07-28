import type { TemplateErrorCode } from './types.js'

// AGENTS §12: misuse of the template layer `throw`s a `TemplateError`
// carrying a machine-readable `code`, so a `catch` branches on `error.code`.

/**
 * An error thrown by the template layer.
 *
 * @remarks
 * Thrown for: a required placeholder staying unresolved under the `error`
 * {@link MissingPolicy} (`MISSING`), an unknown template id
 * (`NOTFOUND`), `createTemplate` handed invalid data (`INVALID`), and
 * `TemplateManagerInterface#register` handed an id already present without
 * `options.replace` (`CONFLICT`). `context`, when present, carries the
 * offending id / name.
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
		this.name = 'TemplateError'
		this.code = code
		if (context !== undefined) this.context = context
	}
}

/**
 * Narrow an unknown caught value to a {@link TemplateError}.
 *
 * @param value - The value to test (typically a `catch` binding)
 * @returns `true` when `value` is a {@link TemplateError}
 *
 * @example
 * ```ts
 * import { isTemplateError } from '@src/core'
 *
 * try {
 * 	manager.template('missing')
 * } catch (error) {
 * 	if (isTemplateError(error) && error.code === 'NOTFOUND') return
 * }
 * ```
 */
export function isTemplateError(value: unknown): value is TemplateError {
	return value instanceof TemplateError
}
