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
} from './types.js'
import { createContract, resolveField, schemaToParameters } from '@orkestrel/contract'
import { DEFAULT_LOCALE, DEFAULT_MISSING_POLICY, UNSAFE_FIELD_SEGMENTS } from './constants.js'
import { fillTemplate, placeholderShape } from './helpers.js'

/**
 * A named, versionable template — `{{name}}` tokens in `content`, filled
 * against a values record.
 *
 * @remarks
 * `missing` / `locale` seed this instance's default {@link TemplateFillOptions},
 * overridable per `fill` call. Its `parameters()` contract (built from
 * `placeholders` via `placeholderShape`) compiles once, in the constructor.
 *
 * @example
 * ```ts
 * const greeting = new Template({ name: 'greeting', content: 'Hi {{name}}' })
 * greeting.fill({ name: 'Ada' }) // 'Hi Ada'
 * ```
 */
export class Template implements TemplateInterface {
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly summary?: string
	readonly description?: string
	readonly category?: string
	readonly tags?: readonly string[]
	readonly #missing: MissingPolicy
	readonly #locale: string
	readonly #contract: ContractInterface<unknown>

	constructor(options: TemplateOptions) {
		this.id = typeof options.id === 'string' ? options.id : crypto.randomUUID()
		this.name = options.name
		this.content = options.content
		this.placeholders = options.placeholders ?? []
		this.summary = options.summary
		this.description = options.description
		this.category = options.category
		this.tags = options.tags
		this.#missing = options.missing ?? DEFAULT_MISSING_POLICY
		this.#locale = options.locale ?? DEFAULT_LOCALE
		this.#contract = createContract(placeholderShape(this.placeholders))
	}

	/**
	 * The plain, JSON-serializable data this template carries.
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
			summary: this.summary,
			description: this.description,
			category: this.category,
			tags: this.tags,
		}
	}

	/**
	 * Substitute every `{{name}}` token in `content` against `values`.
	 *
	 * @param values - The values tokens resolve against
	 * @param options - Per-call overrides for this instance's `missing` / `locale` defaults
	 * @returns The substituted content
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
	 * Report which required placeholders would stay unresolved, and which
	 * `values` keys go unused, without producing output.
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

		for (const placeholder of this.placeholders) {
			if (placeholder.required === false) continue
			if (placeholder.fallback !== undefined) continue

			const path = placeholder.path ?? placeholder.name
			const segments = Array.isArray(path) ? path : [path]
			const unsafe = segments.some((segment) => UNSAFE_FIELD_SEGMENTS.includes(segment))
			const value = unsafe ? undefined : resolveField(record, path)
			if (value === undefined) missing.push(placeholder.name)
		}

		const declared = new Set(this.placeholders.map((placeholder) => placeholder.name))
		const extra = Object.keys(record).filter((key) => !declared.has(key))

		return { valid: missing.length === 0, missing, extra }
	}

	/**
	 * Project this template's placeholders to the open tool-parameters record
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
