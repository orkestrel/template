import type {
	EmitterInterface,
	PromptTemplate,
	TemplateFillValues,
	TemplateInterface,
	TemplateManagerEventMap,
	TemplateManagerInterface,
	TemplateManagerOptions,
	TemplateValidationResult,
} from '../../types.js'
import { Emitter } from '../../signals/Emitter.js'
import { Template } from './Template.js'

/**
 * Manages reusable prompt templates with placeholder validation and filling.
 *
 * @remarks
 * Templates use `{{placeholder}}` syntax. Filling substitutes all markers
 * with provided values, applying defaults for missing optional placeholders
 * and throwing for missing required ones.
 *
 * @example
 * ```ts
 * const manager = new TemplateManager()
 *
 * manager.register({
 *     id: 'greeting',
 *     name: 'Greeting',
 *     content: 'Hello, {{name}}! Welcome to {{place}}.',
 *     placeholders: [
 *         { name: 'name', required: true },
 *         { name: 'place', value: 'the system' },
 *     ],
 * })
 *
 * const result = manager.fill('greeting', { name: 'Alice' })
 * // "Hello, Alice! Welcome to the system."
 * ```
 */
export class TemplateManager implements TemplateManagerInterface {
	readonly #templates = new Map<string, Template>()
	readonly #emitter: Emitter<TemplateManagerEventMap>

	constructor(options?: TemplateManagerOptions) {
		this.#emitter = new Emitter({ on: options?.on })
		if (options?.templates) {
			for (const template of options.templates) {
				this.#templates.set(template.id, new Template(template))
			}
		}
	}

	get emitter(): EmitterInterface<TemplateManagerEventMap> {
		return this.#emitter
	}

	get count(): number {
		return this.#templates.size
	}

	register(template: PromptTemplate): void {
		const instance = new Template(template)
		this.#templates.set(template.id, instance)
		this.#emitter.emit('register', instance)
	}

	template(id: string): TemplateInterface | undefined {
		return this.#templates.get(id)
	}

	templates(): readonly TemplateInterface[] {
		return Array.from(this.#templates.values())
	}

	fill(id: string, values: TemplateFillValues): string {
		const template = this.#templates.get(id)
		if (template === undefined) {
			throw new Error(`Template not found: ${id}`)
		}
		return template.fill(values)
	}

	validate(id: string, values: TemplateFillValues): TemplateValidationResult {
		const template = this.#templates.get(id)
		if (template === undefined) {
			throw new Error(`Template not found: ${id}`)
		}
		return template.validate(values)
	}

	has(id: string): boolean {
		return this.#templates.has(id)
	}

	remove(id: string): boolean {
		const deleted = this.#templates.delete(id)
		if (deleted) {
			this.#emitter.emit('remove', id)
		}
		return deleted
	}

	findByTag(tag: string): readonly TemplateInterface[] {
		return Array.from(this.#templates.values()).filter((t) => t.tags?.includes(tag) === true)
	}

	findByCategory(category: string): readonly TemplateInterface[] {
		return Array.from(this.#templates.values()).filter((t) => t.category === category)
	}

	clear(): void {
		this.#templates.clear()
		this.#emitter.emit('clear')
	}
}
