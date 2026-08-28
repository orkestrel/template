import type { FieldPath } from '@orkestrel/contract'
import type { EmitterErrorHandler, EmitterHooks, EmitterInterface } from '@orkestrel/emitter'

// @orkestrel/template — a stateful template manager/filler: named templates
// with `{{placeholder}}` tokens, a single-pass fill engine, and an id-keyed
// registry manager. Types are the source of truth (AGENTS §2); every
// discriminant names its axis, never `kind` / `type` (AGENTS §4.4): `code`
// splits coded errors, `missing` (a `MissingPolicy`) splits fill strategy.

// === Template data model — pure JSON-serializable, versionable

/**
 * One placeholder a {@link TemplateDefinition}'s `content` declares — its
 * lookup name, an optional field path into the values record, whether it is
 * required, and a literal fallback.
 *
 * @remarks
 * `name` is the `{{name}}` token as written in `content`. `path`, when
 * present, resolves the fill value through a (possibly nested)
 * {@link FieldPath} rather than a flat `name` lookup on the values record.
 * `required` defaults to `true` when omitted — an unresolved required
 * placeholder is governed by the active {@link MissingPolicy}. `fallback` is
 * a literal substituted when the value is unresolved, regardless of
 * `required`.
 */
export interface TemplatePlaceholder {
	readonly name: string
	readonly path?: FieldPath
	readonly required?: boolean
	readonly fallback?: unknown
	readonly description?: string
}

/**
 * A named, versionable template record — pure data, no behavior.
 *
 * @remarks
 * `content` is the raw string carrying `{{name}}` tokens (see
 * `FILL_PATTERN` in `constants.ts`); `placeholders` declares every token's
 * lookup rule. `summary` / `description` / `category` / `tags` are optional
 * catalog metadata for `TemplateManagerInterface#find`.
 */
export interface TemplateDefinition {
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly summary?: string
	readonly description?: string
	readonly category?: string
	readonly tags?: readonly string[]
}

/**
 * How {@link TemplateInterface#fill} handles an unresolved required
 * placeholder.
 *
 * @remarks
 * `error` — throws a {@link TemplateError} coded `MISSING`. `empty` —
 * substitutes an empty string. `literal` — substitutes the placeholder's own
 * `{{name}}` token back into the output, unchanged.
 */
export type MissingPolicy = 'error' | 'empty' | 'literal'

/** The values a {@link TemplateInterface#fill} / `#validate` call resolves placeholders against. */
export type TemplateFillValues = Readonly<Record<string, unknown>>

/** Per-call options for `TemplateInterface#fill` / `TemplateManagerInterface#fill`. */
export interface TemplateFillOptions {
	readonly missing?: MissingPolicy
	readonly locale?: string
}

/**
 * The full option bag `fillTemplate` takes — the per-call
 * {@link TemplateFillOptions} plus the declared placeholders tokens resolve
 * against.
 *
 * @remarks
 * `Template#fill` supplies `placeholders` from its own declaration; a direct
 * `fillTemplate` caller supplies them per call, and omitting them fills
 * against undeclared tokens alone.
 */
export interface TemplateFillContext extends TemplateFillOptions {
	readonly placeholders?: readonly TemplatePlaceholder[]
}

/**
 * One `{{name}}` token's resolution — the single token rule `fillTemplate`
 * and `TemplateInterface#validate` share.
 *
 * @remarks
 * `value` is the resolved fill value, `undefined` when the path is
 * unresolved or refused by the prototype-pollution guard. `declared` is the
 * matching {@link TemplatePlaceholder}, `undefined` for an undeclared token.
 * `required` is `true` for an undeclared token and for a declared
 * placeholder whose `required` is not `false`. A declared `fallback` is left
 * on `declared` rather than applied here, because `fill` substitutes it and
 * `validate` only counts it.
 */
export interface TemplateTokenResolution {
	readonly value: unknown
	readonly declared: TemplatePlaceholder | undefined
	readonly required: boolean
}

/** The outcome of `TemplateInterface#validate` — which required placeholders are unresolved, and which supplied values are unused. */
export interface TemplateValidationResult {
	readonly valid: boolean
	readonly missing: readonly string[]
	readonly extra: readonly string[]
}

/**
 * Options for `createTemplate` / the `Template` constructor.
 *
 * @remarks
 * `id` defaults to a generated id when omitted. `placeholders` defaults to
 * an empty list. `missing` / `locale` seed the instance's default
 * {@link TemplateFillOptions}, overridable per-call.
 */
export interface TemplateOptions {
	readonly id?: string
	readonly name: string
	readonly content: string
	readonly placeholders?: readonly TemplatePlaceholder[]
	readonly summary?: string
	readonly description?: string
	readonly category?: string
	readonly tags?: readonly string[]
	readonly missing?: MissingPolicy
	readonly locale?: string
}

/**
 * Options for `TemplateManagerInterface#register`.
 *
 * @remarks
 * `replace` overwrites an existing entry sharing the registered id instead of
 * throwing a {@link TemplateError} coded `CONFLICT`.
 */
export interface TemplateRegisterOptions {
	readonly replace?: boolean
}

/** A query for `TemplateManagerInterface#find` — every supplied field must match. */
export interface TemplateQuery {
	readonly name?: string
	readonly category?: string
	readonly tag?: string
}

/**
 * The template contract (AGENTS §22 — exact bijection with `Template`).
 *
 * @remarks
 * `definition` returns the plain {@link TemplateDefinition} data. `fill`
 * substitutes every `{{name}}` token in `content` against `values`,
 * honoring `options.missing` for unresolved required placeholders. `validate`
 * reports which required placeholders are unresolved (`missing`) and which
 * supplied `values` keys are unused (`extra`) without producing output.
 * `parameters` projects this template's placeholders to the open
 * tool-parameters record shape (`schemaToParameters`'s return type from
 * `@orkestrel/contract`).
 */
export interface TemplateInterface {
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly summary?: string
	readonly description?: string
	readonly category?: string
	readonly tags?: readonly string[]
	definition(): TemplateDefinition
	fill(values?: TemplateFillValues, options?: TemplateFillOptions): string
	validate(values?: TemplateFillValues): TemplateValidationResult
	parameters(): Readonly<Record<string, unknown>> | undefined
}

// === Manager — event map, options, interface

/**
 * The push observation surface of a {@link TemplateManagerInterface} (AGENTS
 * §13) — an id-keyed registry, so `register` / `remove` are the events
 * (never ordered-list `append`/`prepend`).
 */
export type TemplateManagerEventMap = {
	/** A template was registered — carries the registered template. */
	readonly register: readonly [template: TemplateInterface]
	/** A template was removed — carries the removed template. */
	readonly remove: readonly [template: TemplateInterface]
	/** The registry was cleared. */
	readonly clear: readonly []
}

/**
 * Options for `createTemplateManager` / the `TemplateManager` constructor.
 *
 * @remarks
 * `templates` seeds the registry — either constructed {@link TemplateInterface}
 * instances or plain {@link TemplateOptions} bags. `missing` / `locale` are
 * the manager-wide default {@link TemplateFillOptions}, overridable per-call.
 * `on` — initial event listeners (AGENTS §8/§13). `error` — the emitter's
 * listener-error handler.
 */
export interface TemplateManagerOptions {
	readonly templates?: ReadonlyArray<TemplateInterface | TemplateOptions>
	readonly missing?: MissingPolicy
	readonly locale?: string
	readonly on?: EmitterHooks<TemplateManagerEventMap>
	readonly error?: EmitterErrorHandler
}

/**
 * The template registry — a self-owning, id-keyed record-holder (AGENTS §9.1
 * singular/plural accessors, §9.2 batch overloads).
 *
 * @remarks
 * `register` accepts either a constructed {@link TemplateInterface} or a
 * plain {@link TemplateOptions} bag (constructed internally), and throws a
 * {@link TemplateError} coded `CONFLICT` when the id already exists unless
 * `options.replace` is `true`. `template` throws `NOTFOUND` for an unknown
 * id. `remove`'s batch form is all-or-nothing: any missing id in the list
 * leaves the collection untouched and returns `false`.
 */
export interface TemplateManagerInterface {
	readonly emitter: EmitterInterface<TemplateManagerEventMap>
	readonly size: number
	register(
		template: TemplateInterface | TemplateOptions,
		options?: TemplateRegisterOptions,
	): TemplateInterface
	template(id: string): TemplateInterface
	templates(): readonly TemplateInterface[]
	find(query?: TemplateQuery): readonly TemplateInterface[]
	has(id: string): boolean
	remove(ids: readonly string[]): boolean
	remove(id: string): boolean
	remove(): void
	clear(): void
	fill(id: string, values?: TemplateFillValues, options?: TemplateFillOptions): string
	validate(id: string, values?: TemplateFillValues): TemplateValidationResult
	parameters(id: string): Readonly<Record<string, unknown>> | undefined
}

// === Errors

/**
 * Coded misuse / failure conditions thrown as a {@link TemplateError}.
 *
 * @remarks
 * `MISSING` — a required placeholder stayed unresolved under the `error`
 * {@link MissingPolicy}. `NOTFOUND` — `TemplateManagerInterface#template`
 * (or `fill` / `validate` / `parameters` by id) was handed an unknown id.
 * `INVALID` — `createTemplate` was handed data that fails validation.
 * `CONFLICT` — `register` was handed an id already present without
 * `options.replace`.
 */
export type TemplateErrorCode = 'MISSING' | 'NOTFOUND' | 'INVALID' | 'CONFLICT'
