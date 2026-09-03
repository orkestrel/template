# @orkestrel/template

A stateful template registry and filler with typed placeholders — `{{name}}`
tokens in a `content` string, resolved against a values record by a
single-pass fill engine, and registered and looked up by id through
`TemplateManager`. Every fill lookup refuses a prototype-pollution-unsafe
field path: any segment in `UNSAFE_FIELD_SEGMENTS` (`__proto__`,
`constructor`, `prototype`) is refused before the record is ever read. Part of
the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/template
```

## Requirements

- Node.js >= 22.12.0
- Runtime dependencies `@orkestrel/contract` and `@orkestrel/emitter`

## Usage

```ts
import { createTemplate, createTemplateManager } from '@orkestrel/template'

const greeting = createTemplate({ name: 'greeting', content: 'Hi {{name}}' })
greeting.fill({ name: 'Ada' }) // 'Hi Ada'

const templates = createTemplateManager({ templates: [greeting] })
templates.fill(greeting.id, { name: 'Grace' }) // 'Hi Grace'
```

An unresolved required placeholder is governed by `TemplateFillOptions.missing`,
which defaults to `'error'` and throws a `TemplateError` coded `MISSING`.
`'empty'` substitutes `''` instead, and `'literal'` re-emits the original
`{{name}}` token.

## Guide

For the full surface, see [`guides/template.md`](guides/template.md).

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
