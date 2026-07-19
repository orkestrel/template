import type { ContractShape } from '@orkestrel/contract'
import type {
	TemplateFillOptions,
	TemplateFillValues,
	TemplatePlaceholder,
} from './types.js'
import { isFiniteNumber, objectShape, optionalShape, resolveField, stringShape } from '@orkestrel/contract'
import { DEFAULT_LOCALE, DEFAULT_MISSING_POLICY, FILL_PATTERN, UNSAFE_FIELD_SEGMENTS } from './constants.js'
import { TemplateError } from './errors.js'

// The templates pure-leaf inventory (AGENTS §5/§7) — every function here is a
// referentially-transparent computation with no instance state, exported and
// independently unit-testable. `Template#fill` / `#validate` route through
// these leaves rather than duplicating the substitution logic.

/**
 * Format a resolved fill value for substitution into a template's `content`.
 *
 * @remarks
 * A finite number renders with the given locale's thousand grouping (via
 * `toLocaleString`); every other value — including `null` — String-coerces.
 * `null` therefore renders as the literal string `'null'`, intentionally
 * mirroring `interpolateMessage`'s coercion parity (see `fillTemplate`).
 *
 * @param value - The resolved value to format
 * @param locale - The locale used for finite-number formatting
 * @returns The formatted string
 *
 * @example
 * ```ts
 * import { formatValue } from '@src/core'
 *
 * formatValue(5010, 'en-US') // '5,010'
 * formatValue(null, 'en-US') // 'null'
 * ```
 */
export function formatValue(value: unknown, locale: string): string {
	if (isFiniteNumber(value)) return value.toLocaleString(locale)
	return String(value)
}

/**
 * Substitute every `{{name}}` token in `content` in a single pass.
 *
 * @remarks
 * Uses a fresh `RegExp` clone of `FILL_PATTERN` per call (never sharing its
 * `lastIndex`) and a single `String#replace` scan — substituted output is
 * never re-scanned. For each token: the matching declared
 * {@link TemplatePlaceholder} (exact `name`) supplies its `path` (falling
 * back to the token split on `.`); ANY path segment in `UNSAFE_FIELD_SEGMENTS`
 * makes the token unresolved without ever calling `resolveField` (a
 * prototype-pollution guard). A resolved value formats via `formatValue`; an
 * unresolved value falls back to the placeholder's `fallback` when declared;
 * otherwise `options.missing` governs — `'literal'` re-emits the original
 * `{{name}}` text, `'empty'` emits `''`, and `'error'` emits `''` for every
 * token but collects EVERY unresolved required token (an undeclared token, or
 * a declared token with `required !== false`) and throws one
 * {@link TemplateError} coded `MISSING` listing them all, in first-appearance
 * order, once the scan completes. An escaped `\{{` emits a literal `{{`.
 *
 * PARITY: called with no declared `placeholders` and `{ missing: 'empty' }`,
 * this reproduces `interpolateMessage` (`@src/core` sibling
 * `interpret`) vector-for-vector. KNOWN DIVERGENCE: `FILL_PATTERN`'s token
 * class (`[^{}]`) excludes `{`, where `interpolateMessage`'s (`[^}]`) allows
 * it — a token containing `{` therefore behaves differently here.
 *
 * @param content - The template content carrying `{{name}}` tokens
 * @param values - The values tokens resolve against
 * @param options - `missing` (default `'error'`), `locale` (default `'en-US'`), and the declared `placeholders` (default none) tokens resolve against
 * @returns The substituted content
 *
 * @example
 * ```ts
 * import { fillTemplate } from '@src/core'
 *
 * fillTemplate('Hi {{name}}', { name: 'Ada' }) // 'Hi Ada'
 * fillTemplate('Limit {{limit}}', { limit: 5010 }, { missing: 'empty' }) // 'Limit 5,010'
 * ```
 */
export function fillTemplate(
	content: string,
	values?: TemplateFillValues,
	options?: TemplateFillOptions & { readonly placeholders?: readonly TemplatePlaceholder[] },
): string {
	const placeholders = options?.placeholders ?? []
	const missing = options?.missing ?? DEFAULT_MISSING_POLICY
	const locale = options?.locale ?? DEFAULT_LOCALE
	const record = values ?? {}

	const missingNames: string[] = []
	const seen = new Set<string>()

	const pattern = new RegExp(FILL_PATTERN.source, FILL_PATTERN.flags)
	const result = content.replace(pattern, (matchText: string, token: string | undefined) => {
		if (token === undefined) return '{{'

		const declared = placeholders.find((placeholder) => placeholder.name === token)
		const path = declared?.path ?? token.split('.')
		const segments = Array.isArray(path) ? path : [path]
		const unsafe = segments.some((segment) => UNSAFE_FIELD_SEGMENTS.includes(segment))
		const value = unsafe ? undefined : resolveField(record, path)

		if (value !== undefined) return formatValue(value, locale)
		if (declared?.fallback !== undefined) return formatValue(declared.fallback, locale)

		if (missing === 'literal') return matchText
		if (missing === 'empty') return ''

		const required = declared === undefined || declared.required !== false
		if (required && !seen.has(token)) {
			seen.add(token)
			missingNames.push(token)
		}
		return ''
	})

	if (missing === 'error' && missingNames.length > 0) {
		throw new TemplateError(
			'MISSING',
			`Missing required placeholder(s): ${missingNames.join(', ')}`,
			{ missing: missingNames },
		)
	}

	return result
}

/**
 * Build the `@orkestrel/contract` object shape describing a template's
 * declared placeholders.
 *
 * @remarks
 * Each placeholder becomes a `stringShape` carrying its `description`;
 * `required === false` wraps it in `optionalShape`. Used by `Template` to
 * compile its `parameters()` contract once per instance.
 *
 * @param placeholders - The declared placeholders to shape
 * @returns The contract shape for `createContract`
 *
 * @example
 * ```ts
 * import { placeholderShape } from '@src/core'
 * import { createContract } from '@orkestrel/contract'
 *
 * const contract = createContract(placeholderShape([{ name: 'city' }]))
 * ```
 */
export function placeholderShape(placeholders: readonly TemplatePlaceholder[]): ContractShape {
	const properties: Record<string, ContractShape> = {}
	for (const placeholder of placeholders) {
		const field = stringShape({ description: placeholder.description })
		properties[placeholder.name] = placeholder.required === false ? optionalShape(field) : field
	}
	return objectShape(properties)
}
