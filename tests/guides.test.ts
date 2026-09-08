// The consumer-side guides-parity drop-in: runs `@orkestrel/guide`'s checks against
// this repo's own `guides/README.md` manifest. The constants that follow are this
// package's own, as is the executed section that closes the file.

import { describe, expect, it } from 'vitest'
import {
	computeSymbolKey,
	createGuide,
	createSource,
	createSourceManager,
	extractFenceImports,
	findDrift,
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
/** The one guide this package sources, whose tagline the README pitch equals. */
const GUIDE_SPEC = 'guides/template.md'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ '@orkestrel/template': 'src/core', '@src/core': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * A class that one-class-per-file evicted from its single consumer cannot become a
 * local, so it stays exported without being public. Naming it here is what makes that
 * intentional rather than forgotten — and the assertion that follows it fails when a name
 * here stops being stranded, so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([])

/** Root-level files these checks read. `readInventory` walks directories only. */
const ROOT_FILES = Object.freeze(['AGENTS.md', 'README.md'])

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
const own = requireValue(
	manifest.find((entry) => entry.spec === GUIDE_SPEC),
	`Missing manifest row: ${GUIDE_SPEC}`,
)

it('manifest lists at least one guide', () => {
	expect(manifest.length).toBeGreaterThan(0)
})

// The example half of the equality case is silent over an empty population: with no
// title on both sides `findDrift` compares no pair and the case passes on the summaries
// alone. This pins the population this repository's own guide contributes, so removing
// every `@example` title reddens the suite instead of quietly retiring half the gate.
// The failure names both title sets, because a pin reporting only its own emptiness
// leaves the reader to work out which side dropped the title.
it('pairs at least one example title across the guide and the source', () => {
	const guide = createGuide(requireValue(files[GUIDE_SPEC], `Missing file: ${GUIDE_SPEC}`))
	const source = createSource({ files, module: own.source })
	const declared = source
		.examples()
		.map((example) => example.title)
		.filter((title) => title !== undefined)
	const titled = new Set(declared)
	const headings: string[] = []
	const paired: string[] = []
	for (const fence of guide.fences()) {
		if (fence.title === undefined) continue
		headings.push(fence.title)
		if (titled.has(fence.title)) paired.push(fence.title)
	}
	const unpaired =
		paired.length > 0
			? []
			: [
					`${GUIDE_SPEC} pairs: guide ${JSON.stringify(headings)} source ${JSON.stringify(declared)}`,
				]
	expect(unpaired).toEqual([])
})

// The README's pitch and the guide's tagline are one text, each read as the blockquote
// under its file's H1. `README.md` is outside the concept index, so the reader is
// applied to it directly rather than through a manifest row. Each side is guarded
// against `undefined` first, so a file that lost its blockquote reports that rather
// than reporting two absences as agreement.
it('opens the README with the guide tagline', () => {
	const pitch = createGuide(requireValue(files['README.md'], 'Missing file: README.md')).tagline()
	const tagline = createGuide(
		requireValue(files[GUIDE_SPEC], `Missing file: ${GUIDE_SPEC}`),
	).tagline()

	expect(pitch).not.toBeUndefined()
	expect(tagline).not.toBeUndefined()
	expect(pitch).toBe(tagline)
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
			const members = source.methods(group.interface).map((method) => method.name)
			const documented = group.methods.map((method) => method.name)
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface}`, () => {
				it('documents at least one method', () => {
					expect(group.methods.length).toBeGreaterThan(0)
				})
				it('documents every interface method', () => {
					expect(findMissing(members, documented)).toEqual([])
				})
				it('documents no phantom method', () => {
					expect(findMissing(documented, members)).toEqual([])
				})
				it(`${entity} exposes no undocumented method`, () => {
					const extra =
						entity === group.interface
							? []
							: findMissing(
									source.methods(entity).map((method) => method.name),
									documented,
								)
					expect(extra).toEqual([])
				})
			})
		}

		// The equality gate: a `Summary` cell against its export's description paragraph, a
		// titled fence against the `@example` of that title. `findDrift` owns the comparison
		// and names both sides; converge the two sides with `npm run docs`, never by
		// weakening this assertion. `findDrift` pairs an example only where a title is
		// present on both sides, so an untitled `@example` block is outside this case. Each
		// collected line is the spec, the key, and each side's text or `absent` — the same
		// worklist `npm run docs` prints, so a failure here is read the way that command's
		// output is.
		it('keeps every compared summary and example equal to its source', () => {
			const disagreeing: string[] = []
			for (const drift of findDrift(guide, source)) {
				const left = drift.guide === undefined ? 'absent' : JSON.stringify(drift.guide)
				const right = drift.source === undefined ? 'absent' : JSON.stringify(drift.source)
				disagreeing.push(`${entry.spec} ${drift.key}: guide ${left} source ${right}`)
			}
			expect(disagreeing).toEqual([])
		})

		it('documents an example for every Surface function', () => {
			const fences = guide
				.fences()
				.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
				.map((fence) => fence.code)
			const names = guide
				.surface()
				.filter((symbol) => symbol.keyword === 'function')
				.map((symbol) => symbol.name)
			expect(
				findUnexampled(
					names,
					fences,
					source.examples().map((example) => example.name),
				),
			).toEqual([])
		})

		for (const group of guide.methods()) {
			const entity = group.interface.replace(/Interface$/, '')
			const documented = group.methods.map((method) => method.name)
			const examples =
				entity === group.interface
					? source.examples(group.interface).map((example) => example.name)
					: source
							.examples(group.interface)
							.map((example) => example.name)
							.concat(source.examples(entity).map((example) => example.name))
			describe(`${group.interface} examples`, () => {
				it('documents an example for every method', () => {
					const fences = guide
						.fences()
						.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
						.map((fence) => fence.code)
					expect(findUnexampled(documented, fences, examples)).toEqual([])
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
			templates: [
				{ id: 'greeting', name: 'greeting', content: 'Hi {{name}}', category: 'mail' },
				{ id: 'farewell', name: 'farewell', content: 'Bye {{name}}', category: 'mail' },
				{ id: 'alert', name: 'alert', content: 'Alert: {{reason}}', category: 'ops' },
			],
		})
		expect(templates.fill('greeting', { name: 'Ada' })).toBe('Hi Ada')
		expect(templates.find({ category: 'mail' }).map((one) => one.id)).toEqual([
			'greeting',
			'farewell',
		])
		expect(templates.has('alert')).toBe(true)
		expect(templates.has('missing')).toBe(false)
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
