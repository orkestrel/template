import type { MissingPolicy } from './types.js'

// Frozen default data for the template module (AGENTS §5 — constants are
// UPPER_SNAKE_CASE data, the sole home for module-scope literal defaults).

/**
 * The single-pass `{{name}}` substitution pattern shared by `Template#fill`
 * and `Template#validate`.
 *
 * @remarks
 * Global-flagged, two-alternative pattern: a match of the FIRST alternative
 * (`\{{` — a literal backslash followed by `{{`) means "emit a literal
 * `{{`" — the escape hatch for content that must show `{{` without
 * triggering substitution. A match that instead populates capture group 1
 * (`\{{\s*([^{}]+?)\s*\}\}`) means "substitute the named token" — group 1 is
 * the trimmed placeholder name looked up against the fill values. Every call
 * site builds a fresh `RegExp` from `.source` / `.flags` rather than sharing
 * this instance's mutable `lastIndex` across scans.
 */
export const FILL_PATTERN = /\\\{\{|\{\{\s*([^{}]+?)\s*\}\}/g

/** Default `missing` policy for `Template#fill` / `TemplateManager#fill` when unspecified. */
export const DEFAULT_MISSING_POLICY: MissingPolicy = 'error'

/** Default `locale` for `Template#fill` / `TemplateManager#fill` when unspecified. */
export const DEFAULT_LOCALE = 'en-US'

/**
 * Prototype-pollution-unsafe field-path segments — a fill lookup refuses to
 * resolve ANY path containing one, treating the placeholder as unresolved.
 */
export const UNSAFE_FIELD_SEGMENTS: readonly string[] = Object.freeze([
	'__proto__',
	'constructor',
	'prototype',
])
