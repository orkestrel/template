import type { ContractShape } from '@orkestrel/contract'
import type { TemplatePlaceholder } from './types.js'
import { objectShape, optionalShape, stringShape } from '@orkestrel/contract'

// The templates shape-value inventory — every function here builds an
// `@orkestrel/contract` shape from declared template data. Shapers sit above
// the `helpers.ts` leaf pair: they consume it, and it never consumes them.

/**
 * Builds the `@orkestrel/contract` object shape describing a template's
 * declared placeholders.
 *
 * @remarks
 * Each placeholder becomes a `stringShape` carrying its `description`;
 * `required === false` wraps it in `optionalShape`. Used by `Template` to
 * compile its `parameters()` contract once per instance.
 *
 * @param placeholders - The declared placeholders to shape
 * @returns The contract shape for `createContract`
 *
 * @example
 * ```ts
 * import { placeholderShape } from '@src/core'
 * import { createContract } from '@orkestrel/contract'
 *
 * const contract = createContract(placeholderShape([{ name: 'city' }]))
 * ```
 */
export function placeholderShape(placeholders: readonly TemplatePlaceholder[]): ContractShape {
	const properties: Record<string, ContractShape> = {}
	for (const placeholder of placeholders) {
		const description = placeholder.description
		const field = stringShape({
			...(description !== undefined ? { description } : {}),
		})
		properties[placeholder.name] = placeholder.required === false ? optionalShape(field) : field
	}
	return objectShape(properties)
}
