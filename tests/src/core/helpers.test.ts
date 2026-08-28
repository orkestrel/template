import type { TemplatePlaceholder } from '@src/core'
import {
	createTemplate,
	fillTemplate,
	formatValue,
	isTemplateError,
	resolveSafeField,
	resolveToken,
} from '@src/core'
import { captureError } from '@orkestrel/test'
import { describe, expect, it } from 'vitest'

// The template fill engine's pure leaves — every function is referentially
// transparent (AGENTS §16), so most tests double-invoke to pin run-twice
// determinism directly. `interpolateMessage` parity vectors are adapted from
// interpret's tests/src/core/helpers.test.ts:85-117 (cite-adapt).

describe('fillTemplate — interpolateMessage parity (no declared placeholders, missing: empty)', () => {
	it('resolves a dotted {{path}} token against a nested record', () => {
		expect(
			fillTemplate('City: {{address.city}}', { address: { city: 'Reno' } }, { missing: 'empty' }),
		).toBe('City: Reno')
	})

	it('renders a finite number with en-US thousands grouping (5010 -> 5,010)', () => {
		expect(fillTemplate('Limit is {{limit}}', { limit: 5010 }, { missing: 'empty' })).toBe(
			'Limit is 5,010',
		)
	})

	it('renders an unresolved path as the empty string', () => {
		expect(fillTemplate('Missing {{gone}}', {}, { missing: 'empty' })).toBe('Missing ')
		expect(fillTemplate('Missing {{a.b.c}}', {}, { missing: 'empty' })).toBe('Missing ')
	})

	it('renders a resolved null value as the literal string "null"', () => {
		expect(fillTemplate('Value: {{value}}', { value: null }, { missing: 'empty' })).toBe(
			'Value: null',
		)
	})

	it('is deterministic across repeated calls', () => {
		const content = 'Limit is {{limit}}, city {{address.city}}'
		const values = { limit: 5010, address: { city: 'Reno' } }
		expect(fillTemplate(content, values, { missing: 'empty' })).toBe(
			fillTemplate(content, values, { missing: 'empty' }),
		)
	})
})

describe('fillTemplate — known divergence from interpolateMessage', () => {
	it('excludes "{" from the token class ([^{}]) where interpolateMessage ([^}]) would allow it', () => {
		// interpolateMessage's /\{\{\s*([^}]+?)\s*\}\}/g would treat "a{b" as one
		// captured token; our FILL_PATTERN's [^{}] class cannot — the inner `{`
		// breaks the match, so the outer `{{` never resolves as a fill token here.
		const content = '{{a{b}}'
		const result = fillTemplate(content, {}, { missing: 'empty' })
		expect(result).toBe(content)
	})
})

describe('fillTemplate — missing policies', () => {
	it('"empty" substitutes an empty string for an unresolved required placeholder', () => {
		expect(fillTemplate('Hi {{name}}', {}, { missing: 'empty' })).toBe('Hi ')
	})

	it('"literal" re-emits the original {{name}} token verbatim', () => {
		expect(fillTemplate('Hi {{name}}', {}, { missing: 'literal' })).toBe('Hi {{name}}')
	})

	it('"error" throws one TemplateError coded MISSING listing every unresolved token, in first-appearance order', () => {
		expect(() => fillTemplate('{{a}} and {{b}} and {{a}}', {})).toThrow(
			'Missing required placeholder(s): a, b',
		)

		const error = captureError(() => fillTemplate('{{a}} and {{b}} and {{a}}', {}))

		expect(isTemplateError(error) && error.code === 'MISSING').toBe(true)
		expect(isTemplateError(error) ? error.context?.missing : undefined).toEqual(['a', 'b'])
		expect(isTemplateError(error) ? error.message.includes('a') : false).toBe(true)
		expect(isTemplateError(error) ? error.message.includes('b') : false).toBe(true)
	})

	it('"error" is the default policy when options are omitted', () => {
		expect(() => fillTemplate('Hi {{name}}', {})).toThrow('Missing required placeholder(s): name')
	})

	it('an optional declared placeholder (required: false) never joins the "error" collection', () => {
		const placeholders: readonly TemplatePlaceholder[] = [{ name: 'nickname', required: false }]
		expect(fillTemplate('Hi {{nickname}}', {}, { placeholders })).toBe('Hi ')
	})
})

describe('fillTemplate — fallback precedence', () => {
	it('a provided value wins over a declared fallback', () => {
		const placeholders: readonly TemplatePlaceholder[] = [{ name: 'city', fallback: 'Nowhere' }]
		expect(fillTemplate('City: {{city}}', { city: 'Reno' }, { placeholders })).toBe('City: Reno')
	})

	it('a declared fallback wins over the missing policy', () => {
		const placeholders: readonly TemplatePlaceholder[] = [
			{ name: 'city', fallback: 'Nowhere', required: false },
		]
		expect(fillTemplate('City: {{city}}', {}, { placeholders, missing: 'error' })).toBe(
			'City: Nowhere',
		)
	})

	it('with no fallback, the missing policy governs', () => {
		const placeholders: readonly TemplatePlaceholder[] = [{ name: 'city' }]
		expect(fillTemplate('City: {{city}}', {}, { placeholders, missing: 'empty' })).toBe('City: ')
	})
})

describe('fillTemplate — dotted paths and declared placeholder.path', () => {
	it('resolves a declared placeholder.path over the token-split-on-dot default', () => {
		const placeholders: readonly TemplatePlaceholder[] = [
			{ name: 'town', path: ['address', 'city'] },
		]
		expect(fillTemplate('Town: {{town}}', { address: { city: 'Reno' } }, { placeholders })).toBe(
			'Town: Reno',
		)
	})

	it('a nested record wins over a flat dotted-key literal for the SAME token (pinned current behavior)', () => {
		const values = { 'a.b': 'flat-value', a: { b: 'nested-value' } }
		expect(fillTemplate('{{a.b}}', values, { missing: 'empty' })).toBe('nested-value')
	})
})

describe('fillTemplate — prototype-pollution guard', () => {
	it('an unsafe segment anywhere in the path is inert — never calls resolveField, Object.prototype stays clean', () => {
		expect(fillTemplate('{{__proto__.x}}', {}, { missing: 'empty' })).toBe('')
		expect(fillTemplate('{{constructor.prototype.y}}', {}, { missing: 'empty' })).toBe('')
		expect(Object.getOwnPropertyDescriptor(Object.prototype, 'x')).toBeUndefined()
		expect(Object.getOwnPropertyDescriptor(Object.prototype, 'y')).toBeUndefined()
		expect(Reflect.get({}, 'x')).toBeUndefined()
	})

	it('an unsafe segment in a DECLARED placeholder.path is likewise inert', () => {
		const placeholders: readonly TemplatePlaceholder[] = [
			{ name: 'evil', path: ['__proto__', 'polluted'] },
		]
		expect(fillTemplate('{{evil}}', {}, { placeholders, missing: 'empty' })).toBe('')
		expect(Object.getOwnPropertyDescriptor(Object.prototype, 'polluted')).toBeUndefined()
	})
})

describe('fillTemplate — escape sequences', () => {
	it('an escaped \\{{ emits a literal {{', () => {
		expect(fillTemplate('literal \\{{ brace', {}, { missing: 'empty' })).toBe('literal {{ brace')
	})

	it('mixes an escaped literal with a real token in one string', () => {
		expect(fillTemplate('\\{{ Hi {{name}}', { name: 'Ada' })).toBe('{{ Hi Ada')
	})
})

describe('fillTemplate — repeated / unicode / whitespace tokens', () => {
	it('substitutes a repeated token consistently', () => {
		expect(fillTemplate('{{name}} and {{name}} again', { name: 'Ada' })).toBe('Ada and Ada again')
	})

	it('resolves a unicode value and an internal-whitespace token', () => {
		expect(fillTemplate('Hi {{ name }}', { name: 'Adaé' })).toBe('Hi Adaé')
	})
})

describe('fillTemplate — value coercion', () => {
	it('number formatting: grouping, -0, NaN, Infinity, and non-finite String coercion', () => {
		expect(fillTemplate('{{n}}', { n: 5010 }, { missing: 'empty' })).toBe('5,010')
		expect(fillTemplate('{{n}}', { n: -0 }, { missing: 'empty' })).toBe(formatValue(-0, 'en-US'))
		expect(fillTemplate('{{n}}', { n: Number.NaN }, { missing: 'empty' })).toBe('NaN')
		expect(fillTemplate('{{n}}', { n: Number.POSITIVE_INFINITY }, { missing: 'empty' })).toBe(
			'Infinity',
		)
	})

	it('non-string values: boolean and object String-coerce', () => {
		expect(fillTemplate('{{b}}', { b: true }, { missing: 'empty' })).toBe('true')
		expect(fillTemplate('{{o}}', { o: { toString: () => 'obj' } }, { missing: 'empty' })).toBe(
			'obj',
		)
	})
})

describe('fillTemplate — empty inputs', () => {
	it('empty content returns empty content', () => {
		expect(fillTemplate('', {})).toBe('')
	})

	it('empty values with no tokens in content is a no-op', () => {
		expect(fillTemplate('no tokens here', {})).toBe('no tokens here')
	})
})

describe('fillTemplate — adversarial input', () => {
	it('a pathological run of unmatched braces completes without catastrophic backtracking', () => {
		const content = `${'{'.repeat(50_000)}{{name}}`
		const start = Date.now()
		const result = fillTemplate(content, { name: 'Ada' })
		const elapsed = Date.now() - start
		expect(result.endsWith('Ada')).toBe(true)
		expect(elapsed).toBeLessThan(2000)
	})
})

describe('fillTemplate — single-pass proof', () => {
	it('a substituted value containing {{b}} is never re-scanned for substitution', () => {
		expect(fillTemplate('{{a}}', { a: '{{b}}', b: 'nope' }, { missing: 'empty' })).toBe('{{b}}')
	})
})

describe('formatValue', () => {
	it('formats a finite number with locale grouping and String-coerces everything else', () => {
		expect(formatValue(5010, 'en-US')).toBe('5,010')
		expect(formatValue(null, 'en-US')).toBe('null')
		expect(formatValue(undefined, 'en-US')).toBe('undefined')
		expect(formatValue('text', 'en-US')).toBe('text')
	})
})

describe('resolveSafeField', () => {
	it('resolves a nested path happy path', () => {
		expect(resolveSafeField({ a: { b: 1 } }, ['a', 'b'])).toBe(1)
	})

	it('refuses a __proto__-containing path, returning undefined', () => {
		expect(resolveSafeField({}, ['__proto__', 'x'])).toBeUndefined()
	})
})

describe('fillTemplate — ReDoS regression (R4)', () => {
	it('completes quickly on an unclosed "{{" + a long whitespace run', () => {
		const content = `{{${' '.repeat(1_000_000)}`
		const start = Date.now()
		const result = fillTemplate(content, { name: 'x' }, { missing: 'empty' })
		const elapsed = Date.now() - start
		expect(typeof result).toBe('string')
		expect(elapsed).toBeLessThan(2000)
	})
})

describe('fillTemplate — token trimming after match (R4)', () => {
	it('"{{ name }}" still resolves the trimmed token "name"', () => {
		expect(fillTemplate('Hi {{ name }}', { name: 'Ada' })).toBe('Hi Ada')
	})
})

describe('fillTemplate — escape and unsafe-token pinning (M2/L4/L3/R5)', () => {
	it('an escaped \\{{name}} renders the literal {{name}} (M2)', () => {
		expect(fillTemplate('\\{{name}}', { name: 'Ada' })).toBe('{{name}}')
	})

	it('bare {{constructor}} / {{prototype}} are unresolved and Object.prototype stays clean (L4)', () => {
		expect(fillTemplate('{{constructor}}', {}, { missing: 'empty' })).toBe('')
		expect(fillTemplate('{{prototype}}', {}, { missing: 'empty' })).toBe('')
		expect(Object.getOwnPropertyDescriptor(Object.prototype, 'constructor')?.value).toBe(Object)
		expect(Object.getOwnPropertyDescriptor(Object.prototype, 'prototype')).toBeUndefined()
	})

	it('a whitespace-only {{   }} token is unresolved (L3)', () => {
		expect(fillTemplate('{{   }}', {}, { missing: 'empty' })).toBe('')
	})

	it('required: true with a declared fallback substitutes the fallback, no throw under "error" (R5)', () => {
		const placeholders: readonly TemplatePlaceholder[] = [
			{ name: 'name', required: true, fallback: 'Friend' },
		]
		expect(fillTemplate('Hi {{name}}', {}, { placeholders, missing: 'error' })).toBe('Hi Friend')
	})
})

describe('resolveToken', () => {
	it('resolves an undeclared token by splitting it on "." and marks it required', () => {
		expect(resolveToken({ name: 'Ada' }, [], 'name')).toEqual({
			value: 'Ada',
			declared: undefined,
			required: true,
		})
		expect(resolveToken({ address: { city: 'Reno' } }, [], 'address.city').value).toBe('Reno')
	})

	it('prefers a declared placeholder.path over the token-split default', () => {
		const declared: TemplatePlaceholder = { name: 'town', path: ['address', 'city'] }
		expect(resolveToken({ address: { city: 'Reno' } }, [declared], 'town')).toEqual({
			value: 'Reno',
			declared,
			required: true,
		})
	})

	it('reports required false only for a declared placeholder carrying required: false', () => {
		const optional: TemplatePlaceholder = { name: 'nickname', required: false }
		const explicit: TemplatePlaceholder = { name: 'city', required: true }
		expect(resolveToken({}, [optional], 'nickname').required).toBe(false)
		expect(resolveToken({}, [explicit], 'city').required).toBe(true)
		expect(resolveToken({}, [], 'city').required).toBe(true)
	})

	it('leaves a declared fallback on `declared` rather than applying it to `value`', () => {
		const declared: TemplatePlaceholder = { name: 'city', fallback: 'Nowhere' }
		const resolution = resolveToken({}, [declared], 'city')
		expect(resolution.value).toBeUndefined()
		expect(resolution.declared?.fallback).toBe('Nowhere')
	})

	it('refuses an unsafe path segment, resolving to undefined', () => {
		expect(resolveToken({}, [], '__proto__.polluted').value).toBeUndefined()
		const declared: TemplatePlaceholder = { name: 'evil', path: ['constructor', 'prototype'] }
		expect(resolveToken({}, [declared], 'evil').value).toBeUndefined()
	})

	it('is deterministic across repeated calls', () => {
		const placeholders: readonly TemplatePlaceholder[] = [{ name: 'city' }]
		const values = { city: 'Reno' }
		expect(resolveToken(values, placeholders, 'city')).toEqual(
			resolveToken(values, placeholders, 'city'),
		)
	})

	it('answers the same rule fillTemplate and Template#validate both apply', () => {
		const placeholders: readonly TemplatePlaceholder[] = [{ name: 'city' }]
		const instance = createTemplate({ name: 'card', content: 'City: {{city}}', placeholders })
		expect(resolveToken({}, placeholders, 'city').required).toBe(true)
		expect(instance.validate({}).missing).toEqual(['city'])
		expect(() => fillTemplate('City: {{city}}', {}, { placeholders })).toThrow(
			'Missing required placeholder(s): city',
		)
	})
})
