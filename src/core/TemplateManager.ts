import type {
	MissingPolicy,
	TemplateFillValues,
	TemplateFillOptions,
	TemplateInterface,
	TemplateManagerEventMap,
	TemplateManagerInterface,
	TemplateManagerOptions,
	TemplateOptions,
	TemplateQuery,
	TemplateValidationResult,
} from './types.js'
import type { EmitterInterface } from '@orkestrel/emitter'
import { Emitter } from '@orkestrel/emitter'
import { DEFAULT_LOCALE, DEFAULT_MISSING_POLICY } from './constants.js'
import { TemplateError } from './errors.js'
import { Template } from './Template.js'

/**
 * The template registry — a self-owning, id-keyed record-holder for the
 * {@link TemplateInterface} instances a consumer registers, looks up, fills,
 * and validates by id (AGENTS §9.1 singular/plural accessors, §9.2 batch
 * `remove` overloads, §13 emitter ownership).
 *
 * @remarks
 * `register` accepts either a constructed {@link TemplateInterface} (kept
 * as-is, including its own `missing` / `locale` defaults) or a plain
 * {@link TemplateOptions} bag — constructed into a `Template` with this
 * manager's `missing` / `locale` defaults applied wherever the bag omits
 * them. A duplicate `id` throws a {@link TemplateError} coded `CONFLICT`
 * unless `options.replace` is `true`, in which case the existing entry is
 * overwritten. `options.templates` SEEDS the registry at construction
 * WITHOUT emitting `register` — only calls to `register` after construction
 * emit. The batch `remove(ids)` form is ALL-OR-NOTHING: any id absent from
 * the registry leaves the collection untouched and returns `false`.
 *
 * @example
 * ```ts
 * import { TemplateManager } from '@src/core'
 *
 * const manager = new TemplateManager()
 * const instance = manager.register({ name: 'greeting', content: 'Hi {{name}}' })
 * manager.fill(instance.id, { name: 'Ada' }) // 'Hi Ada'
 * ```
 */
export class TemplateManager implements TemplateManagerInterface {
	readonly #templates = new Map<string, TemplateInterface>()
	readonly #emitter: Emitter<TemplateManagerEventMap>
	readonly #missing: MissingPolicy
	readonly #locale: string

	constructor(options?: TemplateManagerOptions) {
		this.#emitter = new Emitter<TemplateManagerEventMap>({ on: options?.on, error: options?.error })
		this.#missing = options?.missing ?? DEFAULT_MISSING_POLICY
		this.#locale = options?.locale ?? DEFAULT_LOCALE
		for (const template of options?.templates ?? []) {
			const instance = this.#instantiate(template)
			this.#templates.set(instance.id, instance)
		}
	}

	get emitter(): EmitterInterface<TemplateManagerEventMap> {
		return this.#emitter
	}

	get size(): number {
		return this.#templates.size
	}

	/**
	 * Register a template — a constructed {@link TemplateInterface} (kept
	 * as-is) or a plain {@link TemplateOptions} bag (constructed into a
	 * `Template` with this manager's `missing` / `locale` defaults applied
	 * wherever the bag omits them).
	 *
	 * @param template - The template instance or options to register
	 * @param options - `replace` — overwrite an existing entry sharing the same id instead of throwing
	 * @returns The registered {@link TemplateInterface}
	 *
	 * @example
	 * ```ts
	 * const instance = manager.register({ id: 'greeting', name: 'greeting', content: 'Hi {{name}}' })
	 * ```
	 */
	register(
		template: TemplateInterface | TemplateOptions,
		options?: { readonly replace?: boolean },
	): TemplateInterface {
		const instance = this.#instantiate(template)
		const existing = this.#templates.get(instance.id)
		if (existing !== undefined && options?.replace !== true) {
			throw new TemplateError('CONFLICT', `Template already registered: ${instance.id}`, {
				id: instance.id,
			})
		}
		this.#templates.set(instance.id, instance)
		this.#emitter.emit('register', instance)
		return instance
	}

	/**
	 * Look up a registered template by id.
	 *
	 * @param id - The template id
	 * @returns The registered {@link TemplateInterface}
	 * @throws {@link TemplateError} coded `NOTFOUND` when `id` is unknown
	 */
	template(id: string): TemplateInterface {
		const instance = this.#templates.get(id)
		if (instance === undefined) this.#throwNotFound(id)
		return instance
	}

	/**
	 * List every registered template.
	 *
	 * @returns A snapshot array of every registered {@link TemplateInterface}
	 */
	templates(): readonly TemplateInterface[] {
		return [...this.#templates.values()]
	}

	/**
	 * Filter registered templates by name / category / tag — every supplied
	 * field must match (logical AND).
	 *
	 * @param query - The {@link TemplateQuery} to filter by; omit for every registered template
	 * @returns The matching templates
	 */
	find(query?: TemplateQuery): readonly TemplateInterface[] {
		if (query === undefined) return this.templates()
		return this.templates().filter((instance) => {
			if (query.name !== undefined && instance.name !== query.name) return false
			if (query.category !== undefined && instance.category !== query.category) return false
			if (query.tag !== undefined && !(instance.tags ?? []).includes(query.tag)) return false
			return true
		})
	}

	/**
	 * Test whether a template id is registered.
	 *
	 * @param id - The template id
	 * @returns `true` when `id` is registered
	 */
	has(id: string): boolean {
		return this.#templates.has(id)
	}

	// Array overload first (AGENTS §9.2); the batch form is all-or-nothing.
	remove(ids: readonly string[]): boolean
	remove(id: string): boolean
	remove(): void
	remove(target?: string | readonly string[]): boolean | void {
		if (target === undefined) {
			for (const instance of this.#templates.values()) this.#emitter.emit('remove', instance)
			this.#templates.clear()
			return
		}
		if (typeof target === 'string') {
			const instance = this.#templates.get(target)
			if (instance === undefined) return false
			this.#templates.delete(target)
			this.#emitter.emit('remove', instance)
			return true
		}
		for (const id of target) if (!this.#templates.has(id)) return false
		for (const id of target) {
			const instance = this.#templates.get(id)
			if (instance === undefined) continue
			this.#templates.delete(id)
			this.#emitter.emit('remove', instance)
		}
		return true
	}

	/** Remove every registered template, emitting `clear`. */
	clear(): void {
		this.#templates.clear()
		this.#emitter.emit('clear')
	}

	/**
	 * Fill a registered template by id.
	 *
	 * @param id - The template id
	 * @param values - The values tokens resolve against
	 * @param options - Per-call overrides for the template's `missing` / `locale` defaults
	 * @returns The substituted content
	 * @throws {@link TemplateError} coded `NOTFOUND` when `id` is unknown
	 */
	fill(id: string, values?: TemplateFillValues, options?: TemplateFillOptions): string {
		return this.template(id).fill(values, options)
	}

	/**
	 * Validate values against a registered template by id.
	 *
	 * @param id - The template id
	 * @param values - The values to check
	 * @returns The {@link TemplateValidationResult}
	 * @throws {@link TemplateError} coded `NOTFOUND` when `id` is unknown
	 */
	validate(id: string, values?: TemplateFillValues): TemplateValidationResult {
		return this.template(id).validate(values)
	}

	/**
	 * Project a registered template's parameters by id.
	 *
	 * @param id - The template id
	 * @returns The compiled parameters record, or `undefined` when the template has none
	 * @throws {@link TemplateError} coded `NOTFOUND` when `id` is unknown
	 */
	parameters(id: string): Readonly<Record<string, unknown>> | undefined {
		return this.template(id).parameters()
	}

	#instantiate(template: TemplateInterface | TemplateOptions): TemplateInterface {
		if (this.#isInstance(template)) return template
		return new Template({
			...template,
			missing: template.missing ?? this.#missing,
			locale: template.locale ?? this.#locale,
		})
	}

	// A TemplateOptions bag is plain data with no `fill` method; a
	// TemplateInterface instance always exposes one.
	#isInstance(template: TemplateInterface | TemplateOptions): template is TemplateInterface {
		return 'fill' in template && typeof template.fill === 'function'
	}

	#throwNotFound(id: string): never {
		throw new TemplateError('NOTFOUND', `Unknown template id: ${id}`, { id })
	}
}
