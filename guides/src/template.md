# Template

> TODO: one-paragraph description of `Template` — what it is, what problem it
> solves, and how it fits the `@orkestrel` line. Source: [`src/core`](../../src/core).
> Surfaced through the `@src/core` barrel.

## Surface

TODO: a short intro line, then a minimal usage example:

```ts
import { createTemplate } from '@src/core'

const instance = createTemplate({ id: 'example' })
```

### Factories

| API              | Kind     | Summary                                              |
| ---------------- | -------- | ---------------------------------------------------- |
| `createTemplate` | function | Create a `TemplateInterface` from `TemplateOptions`. |

### Entities

| API        | Kind  | Summary                                 |
| ---------- | ----- | --------------------------------------- |
| `Template` | class | Implements `TemplateInterface` exactly. |

### Types

| Type                | Kind      | Shape                                                               |
| ------------------- | --------- | ------------------------------------------------------------------- |
| `TemplateOptions`   | interface | `{ id?: string }` — options for `createTemplate` / the constructor. |
| `TemplateInterface` | interface | `{ id: string }` — a working `Template`, pure data.                 |

## Tests

- [`tests/src/core/Template.test.ts`](../../tests/src/core/Template.test.ts) —
  id assignment (explicit / generated) and independence across instances.
- [`tests/src/core/factories.test.ts`](../../tests/src/core/factories.test.ts) —
  `createTemplate` returns a working `TemplateInterface` backed by a real `Template`.

## See also

- [`AGENTS.md`](../../AGENTS.md) — the rules.
- [`guide.md`](guide.md) — the mirrored guide for `@orkestrel/guide`, the
  devDependency powering this repo's guides-parity test suite.
- [`README.md`](../README.md) — the guides index.
