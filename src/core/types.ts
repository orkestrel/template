
// === Prompt Templates

/**
 * A placeholder within a prompt template.
 *
 * @remarks
 * `name`        — Placeholder identifier matching `{{name}}` in the template content.
 * `required`    — When `true`, filling the template throws if this value is missing
 *                 and no `value` is set. Default: `true`.
 * `value`       — Fallback value when the placeholder is not provided.
 * `description` — Human-readable hint about expected content.
 */
export interface TemplatePlaceholder {
	readonly name: string
	readonly required?: boolean
	readonly value?: string
	readonly description?: string
}

/**
 * A reusable prompt template with placeholder substitution.
 *
 * @remarks
 * Templates use `{{name}}` syntax for placeholders.
 */
export interface PromptTemplate {
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly summary?: string
	readonly description?: string
	readonly category?: string
	readonly tags?: readonly string[]
}

/** Values to fill template placeholders, keyed by placeholder name */
export type TemplateFillValues = Readonly<Record<string, string>>

/**
 * Result of validating fill values against a template's placeholders.
 *
 * @remarks
 * `valid`   — `true` when all required placeholders have values.
 * `missing` — Names of required placeholders without values.
 * `extra`   — Names of provided values not matching any placeholder.
 */
export interface TemplateValidationResult {
	readonly valid: boolean
	readonly missing: readonly string[]
	readonly extra: readonly string[]
}

/**
 * Behavioral contract for a template with fill and validate operations.
 *
 * @remarks
 * Wraps a `PromptTemplate` data record and adds placeholder substitution
 * and validation behavior. `fill()` substitutes `{{placeholder}}` markers.
 */
export interface TemplateInterface {
	readonly id: string
	readonly name: string
	readonly content: string
	readonly placeholders: readonly TemplatePlaceholder[]
	readonly summary: string | undefined
	readonly description: string | undefined
	readonly category: string | undefined
	readonly tags: readonly string[] | undefined
	/** Fill the template with values. Throws if required placeholders are missing. */
	fill(values: TemplateFillValues): string
	/** Validate fill values against declared placeholders */
	validate(values: TemplateFillValues): TemplateValidationResult
}

/**
 * Events emitted by a TemplateManager.
 *
 * @remarks
 * - `register` — a template was added to the registry
 * - `remove`   — a template was removed from the registry
 * - `clear`    — all templates were removed
 */
export type TemplateManagerEventMap = {
	register: [template: TemplateInterface]
	remove: [id: string]
	clear: []
}

/** Options for creating a TemplateManager */
export interface TemplateManagerOptions {
	readonly templates?: readonly PromptTemplate[]
	readonly on?: EmitterHooks<TemplateManagerEventMap>
}

/**
 * Manages reusable prompt templates with placeholder validation and filling.
 *
 * @remarks
 * Follows the manager accessor pattern: `template(id)` / `templates()`.
 * Follows the batch operation pattern for `remove`:
 * - `remove(id)` → boolean
 * - `clear()` → void (removes ALL)
 */
export interface TemplateManagerInterface {
	readonly emitter: EmitterInterface<TemplateManagerEventMap>
	readonly count: number
	register(template: PromptTemplate): void
	template(id: string): TemplateInterface | undefined
	templates(): readonly TemplateInterface[]
	fill(id: string, values: TemplateFillValues): string
	validate(id: string, values: TemplateFillValues): TemplateValidationResult
	has(id: string): boolean
	findByTag(tag: string): readonly TemplateInterface[]
	findByCategory(category: string): readonly TemplateInterface[]
	remove(id: string): boolean
	clear(): void
}
