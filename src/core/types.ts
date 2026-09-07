import type { FieldPath } from '@orkestrel/contract'
import type { EmitterErrorHandler, EmitterHooks, EmitterInterface } from '@orkestrel/emitter'

// @orkestrel/template — a stateful template manager/filler: named templates
// with `{{placeholder}}` tokens, a single-pass fill engine, and an id-keyed
// registry manager. Types are the source of truth; every discriminant names
// its axis, never `kind` / `type`: `code` splits coded errors, `missing` (a
// `MissingPolicy`) splits fill strategy.

// === Template data model — pure JSON-serializable, versionable

/**
 * Represents one placeholder a {@link TemplateDefinition}'s `content`
 * declares — its lookup name, an optional field path into the values record,
 * whether it is required, and a literal fallback.
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
 * Represents a named, versionable template record — pure data, no behavior.
 *
 * @remarks
 * `content` is the raw string carrying `{{name}}` tokens (see
 * `FILL_PATTERN` in `constants.ts`); `placeholders` declares every token's
 * lookup rule. `category` and `tags` are the fields
 * `TemplateManagerInterface#find` filters on, alongside `name`. `summary` and
 * `description` are catalog metadata that `definition()` carries and no query
 * reads.
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
 * Names how {@link TemplateInterface#fill} handles an unresolved required
 * placeholder.
 *
 * @remarks
 * `error` — throws a {@link TemplateError} coded `MISSING`. `empty` —
 * substitutes an empty string. `literal` — substitutes the placeholder's own
 * `{{name}}` token back into the output, unchanged.
 */
export type MissingPolicy = 'error' | 'empty' | 'literal'

/** Represents the values a {@link TemplateInterface#fill} / `#validate` call resolves placeholders against. */
export type TemplateFillValues = Readonly<Record<string, unknown>>

/** Carries the per-call options for `TemplateInterface#fill` / `TemplateManagerInterface#fill`. */
export interface TemplateFillOptions {
	readonly missing?: MissingPolicy
	readonly locale?: string
}

/**
 * Carries the full option bag `fillTemplate` takes — the per-call
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
 * Represents one `{{name}}` token's resolution — the single token rule
 * `fillTemplate` and `TemplateInterface#validate` share.
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

/** Reports the outcome of `TemplateInterface#validate` — which required placeholders are unresolved, and which supplied values are unused. */
export interface TemplateValidationResult {
	readonly valid: boolean
	readonly missing: readonly string[]
	readonly extra: readonly string[]
}

/**
 * Carries the options for `createTemplate` / the `Template` constructor.
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
 * Carries the options for `TemplateManagerInterface#register`.
 *
 * @remarks
 * `replace` overwrites an existing entry sharing the registered id instead of
 * throwing a {@link TemplateError} coded `CONFLICT`.
 */
export interface TemplateRegisterOptions {
	readonly replace?: boolean
}

/** Represents a query for `TemplateManagerInterface#find` — every supplied field must match. */
export interface TemplateQuery {
	readonly name?: string
	readonly category?: string
	readonly tag?: string
}

/**
 * Declares the template contract a consumer holds — the readonly template
 * record and the `definition`, `fill`, `validate`, and `parameters` calls
 * over it.
 *
 * @remarks
 * `Template` implements this contract exactly, so the class exposes these
 * members and no other public behavior.
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
	/** Returns the plain, JSON-serializable template data. */
	definition(): TemplateDefinition
	/**
	 * Substitutes every `{{name}}` token in `content` against `values`.
	 *
	 * @remarks
	 * `options.missing` governs an unresolved required placeholder, defaulting
	 * to the instance's own {@link MissingPolicy}.
	 */
	fill(values?: TemplateFillValues, options?: TemplateFillOptions): string
	/**
	 * Reports which required placeholders would stay unresolved, and which
	 * `values` keys go unused.
	 *
	 * @remarks
	 * The unresolved names arrive as `missing` and the unused keys as `extra`,
	 * and neither reading produces output.
	 */
	validate(values?: TemplateFillValues): TemplateValidationResult
	/**
	 * Projects the declared placeholders to the open tool-parameters record
	 * shape.
	 *
	 * @remarks
	 * The shape is `schemaToParameters`'s return type from
	 * `@orkestrel/contract`.
	 */
	parameters(): Readonly<Record<string, unknown>> | undefined
}

// === Manager — event map, options, interface

/**
 * Declares the push observation surface of a {@link TemplateManagerInterface}
 * — an id-keyed registry, so `register` / `remove` are the events (never
 * ordered-list `append`/`prepend`).
 */
export type TemplateManagerEventMap = {
	/** Fires when a template is registered — carries the registered template. */
	readonly register: readonly [template: TemplateInterface]
	/** Fires when a template is removed — carries the removed template. */
	readonly remove: readonly [template: TemplateInterface]
	/** Fires when the registry is cleared. */
	readonly clear: readonly []
}

/**
 * Carries the options for `createTemplateManager` / the `TemplateManager`
 * constructor.
 *
 * @remarks
 * `templates` seeds the registry — either constructed {@link TemplateInterface}
 * instances or plain {@link TemplateOptions} bags. `missing` / `locale` are
 * the manager-wide default {@link TemplateFillOptions}, overridable per-call.
 * `on` — initial event listeners. `error` — the emitter's
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
 * Declares the registry contract a consumer holds — a self-owning, id-keyed
 * record-holder with singular and plural accessors over the templates it
 * registers.
 *
 * @remarks
 * `TemplateManager` implements this contract exactly, so the class exposes
 * these members and no other public behavior. The by-id calls split on what
 * an unknown id means to each: `template` reports its absence as `undefined`,
 * while `fill`, `validate`, and `parameters` throw a {@link TemplateError}
 * coded `NOTFOUND`, because each needs a template to proceed.
 */
export interface TemplateManagerInterface {
	readonly emitter: EmitterInterface<TemplateManagerEventMap>
	readonly count: number
	/**
	 * Registers one template, or overwrites the entry sharing its id when
	 * `options.replace` is `true`, and emits `register`.
	 *
	 * @remarks
	 * The template arrives as a constructed {@link TemplateInterface} or as a
	 * plain {@link TemplateOptions} bag, which is constructed internally. A
	 * duplicate id without `options.replace` throws a {@link TemplateError}
	 * coded `CONFLICT`.
	 */
	register(
		template: TemplateInterface | TemplateOptions,
		options?: TemplateRegisterOptions,
	): TemplateInterface
	/** Returns one registered template by id, or `undefined` when the id is unregistered. */
	template(id: string): TemplateInterface | undefined
	/** Lists every registered template. */
	templates(): readonly TemplateInterface[]
	/** Filters registered templates by `name`, `category`, and `tag` — every supplied field must match. */
	find(query?: TemplateQuery): readonly TemplateInterface[]
	/** Reports whether a template with the given id is registered. */
	has(id: string): boolean
	/**
	 * Removes the listed templates by id, one template by id, or every
	 * registered template, emitting `remove` once per removed template.
	 *
	 * @remarks
	 * The batch form removes every present id and reports `true` only when
	 * every listed id was present, so one absent id turns the answer `false`
	 * while the present ids still remove. The no-argument form removes every
	 * registered template and reports nothing.
	 */
	remove(ids: readonly string[]): boolean
	remove(id: string): boolean
	remove(): void
	/** Removes every registered template, emitting `clear`. */
	clear(): void
	/**
	 * Tears the registry down: drops every registered template and destroys the
	 * owned emitter. Idempotent.
	 *
	 * @remarks
	 * Teardown emits nothing, because the emitter is being released.
	 */
	destroy(): void
	/** Fills a registered template by id. */
	fill(id: string, values?: TemplateFillValues, options?: TemplateFillOptions): string
	/** Validates values against a registered template by id. */
	validate(id: string, values?: TemplateFillValues): TemplateValidationResult
	/** Projects a registered template's parameters by id. */
	parameters(id: string): Readonly<Record<string, unknown>> | undefined
}

// === Errors

/**
 * Names the coded misuse / failure conditions thrown as a {@link TemplateError}.
 *
 * @remarks
 * `MISSING` — a required placeholder stayed unresolved under the `error`
 * {@link MissingPolicy}. `NOTFOUND` — `TemplateManagerInterface#fill`,
 * `#validate`, or `#parameters` was handed an unknown id.
 * `INVALID` — `createTemplate` was handed data that fails validation.
 * `CONFLICT` — `register` was handed an id already present without
 * `options.replace`.
 */
export type TemplateErrorCode = 'MISSING' | 'NOTFOUND' | 'INVALID' | 'CONFLICT'
