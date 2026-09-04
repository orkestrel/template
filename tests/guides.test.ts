// The consumer-side guides-parity drop-in: runs `@orkestrel/guide`'s checks against
// this repo's own `guides/README.md` manifest. The constants below are this
// package's own, and are the only part a sibling package changes. Every flagship fence
// in `guides/template.md` is transcribed at the end of this file and asserted against what
// its comments claim: name resolution is not a behavioural proof, so a fence documenting a
// value the code contradicts is exactly what the transcriptions catch. Change a fence,
// change its transcription.

import { describe, expect, it } from 'vitest'
import {
	computeSymbolKey,
	createGuide,
	createSource,
	createSourceManager,
	extractFenceImports,
	findMissing,
	findMissingSymbols,
	findUnexampled,
	findUnlisted,
	isExternalLink,
	parseManifest,
	resolveLink,
} from '@orkestrel/guide'
import { readFileSync } from 'node:fs'
import { captureError, requireValue } from '@orkestrel/test'
import { readInventory } from '@orkestrel/test/server'
import { createContract } from '@orkestrel/contract'
import {
	createTemplate,
	createTemplateManager,
	DEFAULT_LOCALE,
	DEFAULT_MISSING_POLICY,
	FILL_PATTERN,
	fillTemplate,
	formatValue,
	isTemplateError,
	placeholderShape,
	resolveSafeField,
	resolveToken,
	TemplateError,
	UNSAFE_FIELD_SEGMENTS,
} from '@src/core'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ '@orkestrel/template': 'src/core', '@src/core': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * A class that one-class-per-file evicted from its single consumer cannot become a
 * local, so it stays exported without being public. Naming it here is what makes that
 * intentional rather than forgotten — and the second assertion below fails when a name
 * here stops being stranded, so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([])

/** Root-level files this package's guides link to. `readInventory` walks directories only. */
const ROOT_FILES = Object.freeze(['AGENTS.md'])

const root = new URL('../', import.meta.url)
const files: Record<string, string> = {
	...readInventory(root, ['src', 'guides', 'tests'], { extensions: ['.ts', '.md'] }),
}
for (const name of ROOT_FILES) files[name] = readFileSync(new URL(name, root), 'utf8')
const manifest = parseManifest(
	requireValue(files['guides/README.md'], 'Missing file: guides/README.md'),
	'guides',
)
const sources = createSourceManager({ files, modules: MODULES })

it('manifest lists at least one guide', () => {
	expect(manifest.length).toBeGreaterThan(0)
})

for (const entry of manifest) {
	const guide = createGuide(requireValue(files[entry.spec], `Missing file: ${entry.spec}`))
	const source = createSource({ files, module: entry.source })

	describe(`${entry.concept}`, () => {
		it('uses only listed fence languages', () => {
			expect(findUnlisted(guide.fences(), FENCE_LANGUAGES)).toEqual([])
		})

		it('extracts a non-empty documented surface', () => {
			expect(guide.surface().length).toBeGreaterThan(0)
		})
		it('re-exports every direct declaration that is not named internal', () => {
			const stranded = findMissingSymbols(source.exports(), source.surface())
			expect(stranded.filter((key) => !INTERNAL.includes(key))).toEqual([])
		})
		it('names no symbol internal that the barrel already exports', () => {
			const stranded = findMissingSymbols(source.exports(), source.surface())
			expect(INTERNAL.filter((key) => !stranded.includes(key))).toEqual([])
		})
		it('re-exports only direct declarations', () => {
			expect(findMissingSymbols(source.surface(), source.exports())).toEqual([])
		})
		it('documents every barrel export', () => {
			expect(findMissingSymbols(source.surface(), guide.surface())).toEqual([])
		})
		it('documents only barrel exports', () => {
			expect(findMissingSymbols(guide.surface(), source.surface())).toEqual([])
		})

		it('exposes no hidden module-scope declarations', () => {
			expect(source.hidden().map(computeSymbolKey)).toEqual([])
		})

		for (const group of guide.methods()) {
			const members = source.methods(group.interface)
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface}`, () => {
				it('documents at least one method', () => {
					expect(group.methods.length).toBeGreaterThan(0)
				})
				it('documents every interface method', () => {
					expect(findMissing(members, group.methods)).toEqual([])
				})
				it('documents no phantom method', () => {
					expect(findMissing(group.methods, members)).toEqual([])
				})
				it(`${entity} exposes no undocumented method`, () => {
					const extra =
						entity === group.interface ? [] : findMissing(source.methods(entity), group.methods)
					expect(extra).toEqual([])
				})
			})
		}

		it('documents an example for every Surface function', () => {
			const fences = guide
				.fences()
				.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
				.map((fence) => fence.code)
			const names = guide
				.surface()
				.filter((symbol) => symbol.keyword === 'function')
				.map((symbol) => symbol.name)
			expect(findUnexampled(names, fences, source.examples())).toEqual([])
		})

		for (const group of guide.methods()) {
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface} examples`, () => {
				it('documents an example for every method', () => {
					const fences = guide
						.fences()
						.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
						.map((fence) => fence.code)
					const examples =
						entity === group.interface
							? source.examples(group.interface)
							: source.examples(group.interface).concat(source.examples(entity))
					expect(findUnexampled(group.methods, fences, examples)).toEqual([])
				})
			})
		}

		it('imports only real exports in every ```ts fence', () => {
			const fences = guide.fences().filter((fence) => fence.language === EXAMPLE_LANGUAGE)
			for (const fence of fences) {
				for (const { specifier, names } of extractFenceImports(fence.code)) {
					const imported = sources.source(specifier)
					if (imported === undefined) continue
					const surface = imported.surface().map((symbol) => symbol.name)
					expect(findMissing(names, surface)).toEqual([])
				}
			}
		})

		it('resolves every relative link', () => {
			const broken = guide
				.links()
				.filter((href) => !isExternalLink(href))
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(broken).toEqual([])
		})
		it('links only to test files that exist', () => {
			const missing = guide
				.tests()
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(missing).toEqual([])
		})
	})
}

// ── Flagship fence transcriptions ────────────────────────────────────────────
//
// Each case below is one `guides/template.md` fence, run against the real barrel and asserting
// the value its comments claim.

describe('flagship fences', () => {
	it('fills a template and a registered template by id (Surface)', () => {
		const greeting = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })
		expect(greeting.fill({ name: 'Ada' })).toBe('Hi Ada')

		const templates = createTemplateManager({ templates: [greeting] })
		expect(templates.fill(greeting.id, { name: 'Grace' })).toBe('Hi Grace')
	})

	it('carries the documented default data (Constants)', () => {
		expect(DEFAULT_MISSING_POLICY).toBe('error')
		expect(DEFAULT_LOCALE).toBe('en-US')
		expect(UNSAFE_FIELD_SEGMENTS).toEqual(['__proto__', 'constructor', 'prototype'])
		// The fence's `FILL_PATTERN.source` comment describes the pattern rather than
		// claiming a value, so this asserts what it describes: the source matches a
		// `{{name}}` token and an escaped `\{{`.
		const pattern = new RegExp(FILL_PATTERN.source, FILL_PATTERN.flags)
		expect(pattern.test('{{name}}')).toBe(true)
		expect(new RegExp(FILL_PATTERN.source, FILL_PATTERN.flags).test('\\{{')).toBe(true)
	})

	it('narrows a caught TemplateError to its code (Errors)', () => {
		const error = captureError(() => {
			throw new TemplateError('NOTFOUND', 'Unknown template id: missing', { id: 'missing' })
		})

		expect(isTemplateError(error)).toBe(true)
		expect(isTemplateError(error) ? error.code : undefined).toBe('NOTFOUND')
	})

	it('returns the documented values from every helper leaf (Helpers)', () => {
		expect(formatValue(5010, 'en-US')).toBe('5,010')
		expect(formatValue(null, 'en-US')).toBe('null')
		expect(resolveSafeField({ a: { b: 1 } }, ['a', 'b'])).toBe(1)
		expect(resolveSafeField({}, ['__proto__', 'polluted'])).toBeUndefined()
		expect(resolveToken({ name: 'Ada' }, [], 'name').value).toBe('Ada')
		expect(resolveToken({}, [{ name: 'nickname', required: false }], 'nickname').required).toBe(
			false,
		)
		expect(fillTemplate('Hi {{name}}', { name: 'Ada' })).toBe('Hi Ada')
		expect(fillTemplate('Limit {{limit}}', { limit: 5010 }, { missing: 'empty' })).toBe(
			'Limit 5,010',
		)
	})

	it('builds an object shape carrying a city string field (Shapers)', () => {
		// The fence's comment describes the returned shape rather than claiming a value.
		const contract = createContract(placeholderShape([{ name: 'city' }]))

		expect(contract.schema.type).toBe('object')
		expect(contract.schema.properties?.city?.type).toBe('string')
		expect(contract.schema.required).toContain('city')
	})

	it('builds a working template and a seeded registry (Factories)', () => {
		const greeting = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })
		expect(greeting.fill({ name: 'Ada' })).toBe('Hi Ada')

		const templates = createTemplateManager({
			templates: [{ id: 'greeting', name: 'greeting', content: 'Hi {{name}}' }],
		})
		expect(templates.fill('greeting', { name: 'Ada' })).toBe('Hi Ada')
	})

	it('drives one template through its contract (TemplateInterface)', () => {
		const greeting = createTemplate({
			name: 'greeting',
			content: 'Hi {{name}}',
			placeholders: [{ name: 'name' }],
		})

		expect(greeting.definition().name).toBe('greeting')
		expect(greeting.fill({ name: 'Ada' })).toBe('Hi Ada')
		expect(greeting.validate({}).missing).toEqual(['name'])
		expect(greeting.parameters()).toBeDefined()
	})

	it('drives the registry through its contract (TemplateManagerInterface)', () => {
		const templates = createTemplateManager()
		const greeting = templates.register({
			id: 'greeting',
			name: 'greeting',
			content: 'Hi {{name}}',
		})

		expect(templates.has('greeting')).toBe(true)
		expect(templates.template('greeting')).toBe(greeting)
		expect(templates.templates()).toEqual([greeting])
		expect(templates.find({ name: 'greeting' })).toEqual([greeting])
		expect(templates.fill('greeting', { name: 'Ada' })).toBe('Hi Ada')
		// The registration declares no placeholders, so the `{{name}}` token is undeclared
		// and therefore required — `validate` reports it missing.
		expect(templates.validate('greeting', {}).missing).toEqual(['name'])
		expect(templates.parameters('greeting')).toEqual({
			type: 'object',
			additionalProperties: false,
		})
		expect(templates.remove('greeting')).toBe(true)

		templates.clear()
		templates.destroy()

		expect(templates.emitter.destroyed).toBe(true)
	})
})
