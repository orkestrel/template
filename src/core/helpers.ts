import type { FieldPath } from '@orkestrel/contract'
import type {
	TemplateFillContext,
	TemplateFillValues,
	TemplatePlaceholder,
	TemplateTokenResolution,
} from './types.js'
import { isFiniteNumber, resolveField } from '@orkestrel/contract'
import {
	DEFAULT_LOCALE,
	DEFAULT_MISSING_POLICY,
	FILL_PATTERN,
	UNSAFE_FIELD_SEGMENTS,
} from './constants.js'
import { TemplateError } from './errors.js'

// The templates pure-leaf inventory — every function here is a
// referentially-transparent computation with no instance state, exported and
// independently unit-testable. `Template#fill` / `#validate` route through
// these leaves rather than duplicating the substitution logic.

/**
 * Formats a resolved fill value for substitution into a template's `content`.
 *
 * @remarks
 * A finite number renders with the given locale's thousand grouping (through
 * `toLocaleString`); every other value — including `null` — String-coerces.
 * `null` therefore renders as the literal string `'null'`, matching
 * `String(value)` exactly, so a resolved `null` is visible in the output
 * rather than silently empty. An
 * invalid BCP-47 `locale` tag throws a `RangeError` from the underlying
 * `toLocaleString` call when `value` is a finite number — this is a caller
 * error (an invalid locale argument), by design, and is not caught here.
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
 * Resolves a field path against a fill-values record, refusing any path that
 * touches a prototype-pollution-unsafe segment.
 *
 * @remarks
 * A prototype-pollution guard shared by `fillTemplate` and `Template#validate`
 * so the two stay in lockstep: `path` normalizes to a segment array (a bare
 * string `path` becomes a single-segment array); if ANY segment appears in
 * `UNSAFE_FIELD_SEGMENTS` (`'__proto__'`, `'constructor'`, `'prototype'`), the
 * lookup is refused and `undefined` is returned WITHOUT ever calling
 * `resolveField` — a path like `['__proto__', 'polluted']` can never reach
 * the record's actual prototype chain through this function. Every other
 * path resolves through `@orkestrel/contract`'s `resolveField`.
 *
 * @param record - The fill-values record to resolve against
 * @param path - The field path — a single segment or a segment array
 * @returns The resolved value, or `undefined` when unresolved or the path is unsafe
 *
 * @example
 * ```ts
 * import { resolveSafeField } from '@src/core'
 *
 * resolveSafeField({ a: { b: 1 } }, ['a', 'b']) // 1
 * resolveSafeField({}, ['__proto__', 'polluted']) // undefined
 * ```
 */
export function resolveSafeField(record: TemplateFillValues, path: FieldPath): unknown {
	const segments = Array.isArray(path) ? path : [path]
	if (segments.some((segment) => UNSAFE_FIELD_SEGMENTS.includes(segment))) return undefined
	return resolveField(record, path)
}

/**
 * Resolves one `{{name}}` token against the declared placeholders and the
 * fill-values record.
 *
 * @remarks
 * The single implementation of the token rule `fillTemplate` and
 * `Template#validate` both apply, so the two can never drift: the declared
 * {@link TemplatePlaceholder} sharing the token's `name` (exact match)
 * supplies its `path`, falling back to the token split on `.`; the value
 * resolves through `resolveSafeField`, so any segment in
 * `UNSAFE_FIELD_SEGMENTS` yields `undefined` without ever calling
 * `resolveField`; `required` is `true` for an undeclared token and for a
 * declared placeholder whose `required` is not `false`. The token is passed
 * already trimmed. `fallback` is not applied here — it is read from
 * `declared` by each caller, because `fill` substitutes it and `validate`
 * only counts it.
 *
 * @param record - The fill-values record the token resolves against
 * @param placeholders - The declared placeholders the token matches by name
 * @param token - The trimmed token text, without its `{{` / `}}` delimiters
 * @returns The {@link TemplateTokenResolution} for the token
 *
 * @example
 * ```ts
 * import { resolveToken } from '@src/core'
 *
 * resolveToken({ name: 'Ada' }, [], 'name').value // 'Ada'
 * resolveToken({}, [{ name: 'nickname', required: false }], 'nickname').required // false
 * ```
 */
export function resolveToken(
	record: TemplateFillValues,
	placeholders: readonly TemplatePlaceholder[],
	token: string,
): TemplateTokenResolution {
	const declared = placeholders.find((placeholder) => placeholder.name === token)
	const path = declared?.path ?? token.split('.')
	return {
		value: resolveSafeField(record, path),
		declared,
		required: declared === undefined || declared.required !== false,
	}
}

/**
 * Substitutes every `{{name}}` token in `content` in a single pass.
 *
 * @remarks
 * Uses a fresh `RegExp` clone of `FILL_PATTERN` per call (never sharing its
 * `lastIndex`) and a single `String#replace` scan — substituted output is
 * never re-scanned. Each token resolves through `resolveToken`, the one rule
 * `Template#validate` also applies: the matching declared
 * {@link TemplatePlaceholder} (exact `name`) supplies its `path` (falling
 * back to the token split on `.`); ANY path segment in `UNSAFE_FIELD_SEGMENTS`
 * makes the token unresolved without ever calling `resolveField` (a
 * prototype-pollution guard). A resolved value formats through `formatValue`; an
 * unresolved value falls back to the placeholder's `fallback` when declared;
 * otherwise `options.missing` governs — `'literal'` re-emits the original
 * `{{name}}` text, `'empty'` emits `''`, and `'error'` emits `''` for every
 * token but collects EVERY unresolved required token (an undeclared token, or
 * a declared token with `required !== false`) and throws one
 * {@link TemplateError} coded `MISSING` listing them all, in first-appearance
 * order, once the scan completes. An escaped `\{{` emits a literal `{{`.
 *
 * Called with no declared `placeholders` and `{ missing: 'empty' }`, this is a
 * bare interpolation over `content` — every token resolves by dotted path
 * against the values record and every unresolved token emits `''`.
 * `FILL_PATTERN`'s token class (`[^{}]`) excludes `{`, so a token containing
 * `{` never matches and the surrounding `{{` stays literal.
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
	options?: TemplateFillContext,
): string {
	const placeholders = options?.placeholders ?? []
	const missing = options?.missing ?? DEFAULT_MISSING_POLICY
	const locale = options?.locale ?? DEFAULT_LOCALE
	const record = values ?? {}

	const missingNames: string[] = []
	const seen = new Set<string>()

	const pattern = new RegExp(FILL_PATTERN.source, FILL_PATTERN.flags)
	const result = content.replace(pattern, (matchText: string, rawToken: string | undefined) => {
		if (rawToken === undefined) return '{{'
		const token = rawToken.trim()

		const { value, declared, required } = resolveToken(record, placeholders, token)

		if (value !== undefined) return formatValue(value, locale)
		if (declared?.fallback !== undefined) return formatValue(declared.fallback, locale)

		if (missing === 'literal') return matchText
		if (missing === 'empty') return ''

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
