import type {
	PromptTemplate,
	TemplateFillValues,
	TemplateInterface,
	TemplateValidationResult,
} from '../../types.js'
import { TEMPLATE_PLACEHOLDER_PATTERN } from '../../constants.js'

/**
 * A reusable prompt template with placeholder substitution and validation.
 *
 * @remarks
 * Wraps a `PromptTemplate` data record and provides `fill()` and `validate()`
 * behavior. Placeholders use `{{name}}` syntax — whitespace inside braces
 * is tolerated.
 *
 * @example
 * ```ts
 * const template = new Template({
 *     id: 'greeting',
 *     name: 'Greeting',
 *     content: 'Hello, {{name}}! Welcome to {{place}}.',
 *     placeholders: [
 *         { name: 'name', required: true },
 *         { name: 'place', value: 'the system' },
 *     ],
 * })
 *
 * template.fill({ name: 'Alice' })
 * // "Hello, Alice! Welcome to the system."
 * ```
 */
export class Template implements TemplateInterface {
	readonly #id: string
	readonly #name: string
	readonly #content: string
	readonly #placeholders: readonly PromptTemplate['placeholders'][number][]
	readonly #summary: string | undefined
	readonly #description: string | undefined
	readonly #category: string | undefined
	readonly #tags: readonly string[] | undefined

	constructor(template: PromptTemplate) {
		this.#id = template.id
		this.#name = template.name
		this.#content = template.content
		this.#placeholders = [...template.placeholders]
		this.#summary = template.summary
		this.#description = template.description
		this.#category = template.category
		this.#tags = template.tags ? [...template.tags] : undefined
	}

	get id(): string {
		return this.#id
	}

	get name(): string {
		return this.#name
	}

	get content(): string {
		return this.#content
	}

	get placeholders(): readonly PromptTemplate['placeholders'][number][] {
		return [...this.#placeholders]
	}

	get summary(): string | undefined {
		return this.#summary
	}

	get description(): string | undefined {
		return this.#description
	}

	get category(): string | undefined {
		return this.#category
	}

	get tags(): readonly string[] | undefined {
		return this.#tags ? [...this.#tags] : undefined
	}

	fill(values: TemplateFillValues): string {
		const validation = this.validate(values)
		if (!validation.valid && validation.missing.length > 0) {
			throw new Error(`Missing required placeholders: ${validation.missing.join(', ')}`)
		}

		const completeValues = this.#buildCompleteValues(values)

		// Create a fresh regex instance to reset lastIndex for global matching
		const regex = new RegExp(
			TEMPLATE_PLACEHOLDER_PATTERN.source,
			TEMPLATE_PLACEHOLDER_PATTERN.flags,
		)

		return this.#content.replace(regex, (_match, name: string) => {
			const value = completeValues[name]
			return value ?? `{{${name}}}`
		})
	}

	validate(values: TemplateFillValues): TemplateValidationResult {
		const placeholderNames = new Set(this.#placeholders.map((p) => p.name))
		const providedNames = new Set(Object.keys(values))

		const missing: string[] = []
		for (const placeholder of this.#placeholders) {
			// A placeholder is missing when it's required (default: true),
			// has no default value, and no value was provided
			if (placeholder.required !== false && placeholder.value === undefined) {
				if (!providedNames.has(placeholder.name)) {
					missing.push(placeholder.name)
				}
			}
		}

		const extra: string[] = []
		for (const name of providedNames) {
			if (!placeholderNames.has(name)) {
				extra.push(name)
			}
		}

		return {
			valid: missing.length === 0,
			missing,
			extra,
		}
	}

	// === Private Methods

	#buildCompleteValues(values: TemplateFillValues): Record<string, string> {
		const complete: Record<string, string> = { ...values }

		for (const placeholder of this.#placeholders) {
			if (!(placeholder.name in complete) && placeholder.value !== undefined) {
				complete[placeholder.name] = placeholder.value
			}
		}

		return complete
	}
}
