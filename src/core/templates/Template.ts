import type { ContractInterface } from '@orkestrel/contract'
import type {
	MissingPolicy,
	TemplateDefinition,
	TemplateFillOptions,
	TemplateFillValues,
	TemplateInterface,
	TemplateOptions,
	TemplatePlaceholder,
	TemplateValidationResult,
} from '../types.js'
import { createContract, schemaToParameters } from '@orkestrel/contract'
import { DEFAULT_LOCALE, DEFAULT_MISSING_POLICY, FILL_PATTERN } from '../constants.js'
import { fillTemplate, resolveToken } from '../helpers.js'
import { placeholderShape } from '../shapers.js'
import { TemplateError } from '../errors.js'

/**
 * Represents a named, versionable template — `{{name}}` tokens in `content`,
 * filled against a values record.
 *
 * @remarks
 * `missing` / `locale` seed this instance's default {@link TemplateFillOptions},
 * overridable per `fill` call. Its `parameters()` contract (built from
 * `placeholders` through `placeholderShape`) compiles once, in the constructor.
 *
 * @throws {@link TemplateError} Thrown when `options.placeholders` declares a duplicate `name` or an empty `path` (coded `INVALID`)
 *
 * @example
 * ```ts
 * const greeting = new Template({ name: 'greeting', content: 'Hi {{name}}' })
 * greeting.fill({ name: 'Ada' }) // 'Hi Ada'
 * ```
 */
export class Template implements TemplateInterface {
	readonly #missing: MissingPolicy
	readonly #locale: string
	readonly #contract: ContractInterface<unknown>
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly summary?: string
	readonly description?: string
	readonly category?: string
	readonly tags?: readonly string[]

	constructor(options: TemplateOptions) {
		const placeholders = options.placeholders ?? []
		const seenNames = new Set<string>()
		for (const placeholder of placeholders) {
			if (seenNames.has(placeholder.name)) {
				throw new TemplateError('INVALID', `Duplicate placeholder name: ${placeholder.name}`, {
					name: placeholder.name,
				})
			}
			seenNames.add(placeholder.name)
			if (Array.isArray(placeholder.path) && placeholder.path.length === 0) {
				throw new TemplateError(
					'INVALID',
					`Placeholder path must not be empty: ${placeholder.name}`,
					{ name: placeholder.name },
				)
			}
		}

		this.id = typeof options.id === 'string' ? options.id : crypto.randomUUID()
		this.name = options.name
		this.content = options.content
		this.placeholders = placeholders
		if (options.summary !== undefined) this.summary = options.summary
		if (options.description !== undefined) this.description = options.description
		if (options.category !== undefined) this.category = options.category
		if (options.tags !== undefined) this.tags = options.tags
		this.#missing = options.missing ?? DEFAULT_MISSING_POLICY
		this.#locale = options.locale ?? DEFAULT_LOCALE
		this.#contract = createContract(placeholderShape(this.placeholders))
	}

	/**
	 * Returns the plain, JSON-serializable data this template carries.
	 *
	 * @returns The {@link TemplateDefinition} record
	 *
	 * @example
	 * ```ts
	 * const instance = new Template({ name: 'greeting', content: 'Hi {{name}}' })
	 * instance.definition().name // 'greeting'
	 * ```
	 */
	definition(): TemplateDefinition {
		return {
			id: this.id,
			name: this.name,
			content: this.content,
			placeholders: this.placeholders,
			...(this.summary !== undefined ? { summary: this.summary } : {}),
			...(this.description !== undefined ? { description: this.description } : {}),
			...(this.category !== undefined ? { category: this.category } : {}),
			...(this.tags !== undefined ? { tags: this.tags } : {}),
		}
	}

	/**
	 * Substitutes every `{{name}}` token in `content` against `values`.
	 *
	 * @param values - The values tokens resolve against
	 * @param options - Per-call overrides for this instance's `missing` / `locale` defaults
	 * @returns The substituted content
	 * @throws {@link TemplateError} Thrown when a required placeholder stays unresolved under the `'error'` policy (coded `MISSING`)
	 *
	 * @example
	 * ```ts
	 * const instance = new Template({ name: 'greeting', content: 'Hi {{name}}' })
	 * instance.fill({ name: 'Ada' }) // 'Hi Ada'
	 * ```
	 */
	fill(values?: TemplateFillValues, options?: TemplateFillOptions): string {
		return fillTemplate(this.content, values, {
			missing: options?.missing ?? this.#missing,
			locale: options?.locale ?? this.#locale,
			placeholders: this.placeholders,
		})
	}

	/**
	 * Reports which required placeholders would stay unresolved, and which
	 * `values` keys go unused, without producing output.
	 *
	 * @remarks
	 * Content-token driven: scans `this.content` for every `{{name}}` token
	 * (skipping escaped `\{{` matches) the same way `fill` does, so `validate`
	 * predicts `fill`'s `'error'`-{@link MissingPolicy} outcome exactly — a
	 * token reported here as missing is precisely a token that would throw
	 * under `fill(values, { missing: 'error' })`. For each distinct token
	 * (first-appearance order, trimmed): `resolveToken` applies the one shared
	 * token rule `fill` also applies — a declared {@link TemplatePlaceholder}
	 * sharing its `name` supplies `path` (falling back to the token split on
	 * `.`), and the value resolves through `resolveSafeField`. The token is `missing`
	 * only when the value is unresolved AND no `fallback` is declared AND the
	 * placeholder is required (`required !== false`, including undeclared
	 * tokens). `extra` lists every `values` key with no declared placeholder.
	 *
	 * @param values - The values to check
	 * @returns The {@link TemplateValidationResult}
	 *
	 * @example
	 * ```ts
	 * const instance = new Template({
	 * 	name: 'greeting',
	 * 	content: 'Hi {{name}}',
	 * 	placeholders: [{ name: 'name' }],
	 * })
	 * instance.validate({}).missing // ['name']
	 * ```
	 */
	validate(values?: TemplateFillValues): TemplateValidationResult {
		const record = values ?? {}
		const missing: string[] = []
		const seen = new Set<string>()

		const pattern = new RegExp(FILL_PATTERN.source, FILL_PATTERN.flags)
		for (const match of this.content.matchAll(pattern)) {
			const rawToken = match[1]
			if (rawToken === undefined) continue
			const token = rawToken.trim()
			if (seen.has(token)) continue
			seen.add(token)

			const { value, declared, required } = resolveToken(record, this.placeholders, token)

			if (value === undefined && declared?.fallback === undefined && required) {
				missing.push(token)
			}
		}

		const declaredNames = new Set(this.placeholders.map((placeholder) => placeholder.name))
		const extra = Object.keys(record).filter((key) => !declaredNames.has(key))

		return { valid: missing.length === 0, missing, extra }
	}

	/**
	 * Projects this template's placeholders to the open tool-parameters record
	 * shape.
	 *
	 * @returns The compiled parameters record, or `undefined` when `schemaToParameters` yields none
	 *
	 * @example
	 * ```ts
	 * const instance = new Template({
	 * 	name: 'greeting',
	 * 	content: 'Hi {{name}}',
	 * 	placeholders: [{ name: 'name' }],
	 * })
	 * instance.parameters()
	 * ```
	 */
	parameters(): Readonly<Record<string, unknown>> | undefined {
		return schemaToParameters(this.#contract.schema)
	}
}
