import type { MissingPolicy } from './types.js'

// Frozen default data for the template module — constants are
// UPPER_SNAKE_CASE data, the sole home for module-scope literal defaults.

/**
 * Holds the single-pass `{{name}}` substitution pattern shared by
 * `Template#fill` and `Template#validate`.
 *
 * @remarks
 * Global-flagged, two-alternative pattern: a match of the first alternative
 * (`\{{` — a literal backslash followed by `{{`) means "emit a literal
 * `{{`" — the escape hatch for content that must show `{{` without
 * triggering substitution. A match that instead populates capture group 1
 * (`\{{([^{}]+?)\}\}`) means "substitute the named token" — group 1 is the
 * untrimmed token text between the braces; every call site trims it
 * (`token.trim()`) before using it as a lookup name, so `'{{ name }}'` still
 * resolves `'name'`. The pattern deliberately does not wrap the token in
 * `\s*` — an unclosed `'{{' + ' '.repeat(n)` with no closing `}}` would
 * otherwise force the regex engine into catastrophic backtracking over the
 * whitespace run (O(n^2)); trimming after the match keeps the same
 * whitespace tolerance without the backtracking hazard. Every call site
 * builds a fresh `RegExp` from `.source` / `.flags` rather than sharing this
 * instance's mutable `lastIndex` across scans.
 */
export const FILL_PATTERN = /\\\{\{|\{\{([^{}]+?)\}\}/g

/**
 * Holds `'error'`, the default `missing` policy for `Template#fill` /
 * `TemplateManager#fill` when unspecified.
 */
export const DEFAULT_MISSING_POLICY: MissingPolicy = 'error'

/**
 * Holds `'en-US'`, the default `locale` for `Template#fill` /
 * `TemplateManager#fill` when unspecified.
 */
export const DEFAULT_LOCALE = 'en-US'

/**
 * Lists the prototype-pollution-unsafe field-path segments `'__proto__'`,
 * `'constructor'`, and `'prototype'` — a fill lookup refuses to resolve a path
 * containing one of them, treating the placeholder as unresolved.
 */
export const UNSAFE_FIELD_SEGMENTS: readonly string[] = Object.freeze([
	'__proto__',
	'constructor',
	'prototype',
])
