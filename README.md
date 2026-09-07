# @orkestrel/template

> A named, versionable template layer: `{{name}}` tokens in a `content`
> string, resolved against a values record by a single-pass fill engine, and
> registered and looked up by id through a self-owning `TemplateManager`.

Declare a template with the `createTemplate` function, fill it against the
values record your caller supplies, and register it in a `TemplateManager`
where several templates are looked up by id. Reach for `validate` where you
need to know which placeholders a fill would reject before you run it. Part of
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
