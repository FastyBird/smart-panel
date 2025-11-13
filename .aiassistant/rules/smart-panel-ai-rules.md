---
apply: always
---

# FastyBird Smart Panel – AI Coding Rules

## Project context

- Project name: **FastyBird Smart Panel**
- Monorepo containing:
    - **Backend**: NestJS (TypeScript)
    - **Admin**: Vue 3 + Pinia (TypeScript)
    - **Panel**: Flutter/Dart
- Tooling:
    - **pnpm workspaces** for Node.js
    - **melos** for Dart/Flutter
- Target: runs primarily on small devices (e.g. Raspberry Pi), so avoid unnecessary complexity and heavy dependencies.

---

## Architecture & design

- Respect the existing modular architecture:
    - Backend modules: `devices`, `dashboard`, `users`, `plugins`, etc.
    - Admin app modules: clearly separated pages, stores, and components.
    - Panel app: API layer + generated spec + widgets/components on top.
- Avoid “god services” and multi-purpose classes.
- Prefer small, focused services and composables.

### Generated code

**Never change generated code manually.** Instead, adjust the generator or source spec.

Generated locations include, but are not limited to:

- `apps/backend/src/openapi.d.ts`
- `apps/backend/src/spec/**`
- `apps/panel/lib/api/**`
- `apps/panel/lib/spec/**`

---

## Coding style

Always respect existing formatters and linters:

- Backend/Admin (TypeScript): ESLint + Prettier
- Flutter/Panel: Dart analyzer and `flutter_lints`
- PHP: project-specific tools (e.g. PHP-CS-Fixer) where used

### TypeScript (backend & admin)

- Indentation: tabs
- Print width: 120
- Quotes: single
- Semicolons: always
- Trailing commas: always on multiline
- Import sorting:
    - External modules first
    - Then relative imports (`../` → `./`)
    - Keep group separation

**Naming:**

- Variables & functions: `camelCase`
- Classes, interfaces, enums, types: `PascalCase`
- Vue components: `PascalCase` filenames
- Folders: `kebab-case`

### Flutter/Dart

- Use **package imports**, not relative imports.
- Generated code (`lib/api/**`, `lib/spec/**`) is excluded from analysis and must not be edited.
- Files: `snake_case.dart`
- Classes/widgets: `PascalCase`

### Matter-style capabilities

When defining device types, channels, and properties:

- Use terminology aligned with **Matter** where reasonable:
    - clusters, features, capabilities
- Keep metadata (units, formats, permissions) aligned with the project spec schemas.

---

## Tests

### Backend (NestJS)

- Unit tests: `*.spec.ts` colocated with source files in `src/**`.
- E2E tests: `*.e2e-spec.ts` in `apps/backend/test`.

Common commands:

```bash
pnpm run test:unit
pnpm run test:e2e
pnpm run test:cov
```

### Admin (Vue 3)

- Use **Vitest** + `@testing-library/vue` for components and composables.
- Non-trivial logic in composables and stores should have tests.

### Panel (Flutter)

- Use widget tests for non-trivial UI logic where practical.
- Keep generated API/spec clients out of test scope (they are tested implicitly via integration flows).

### General rule

Whenever AI (or a human) adds significant new logic:

- Add or extend tests for that logic **or**
- Explicitly document why tests are not added in the PR (e.g. covered indirectly, temporary prototype).

---

## Commits & pull requests

- Commit messages:
    - **English**
    - Imperative mood
        - Examples:
            - `Add Home Assistant device registry sync`
            - `Refactor dashboard card builder`
            - `Fix panel screen saver timeout handling`

- **Pull request descriptions must use Markdown syntax.**

Recommended PR structure:

```markdown
## Summary

Short, high-level description of the change.

## Changes

- Bullet list of relevant changes.
- Focus on behavior and architecture, not just file names.

## Testing

- How the change was tested (unit tests, E2E tests, manual steps, etc.).

## Notes

- Any important implications, migration steps, or follow-ups.

## Related issues

- Links to issues / tickets, if applicable.
```

---

## AI usage guidelines

These rules apply to **JetBrains AI Assistant, Junie, and Qodo**.

1. **AI-generated code is never auto-mergeable.**  
   A human must always review diffs.

2. **Do not modify generated files.**  
   If a change is needed, change the generator or spec instead.

3. **Respect scope.**  
   If the user asks for a specific feature or bugfix:
    - Do not refactor unrelated modules.
    - If AI discovers useful cleanup, suggest it as a **separate PR**.

4. **Follow existing patterns.**
    - Use existing helper functions, services, mappers, and hooks where possible.
    - Keep dependency injection consistent with current NestJS / Nette / Flutter patterns.

5. **Avoid adding new dependencies** unless strictly necessary and justified.

6. **Tests should follow new logic.**
    - When adding behavior, AI should also propose or generate tests.
    - If tests are not possible, AI should at least outline test scenarios.

7. **Security and robustness:**
    - Be careful around:
        - Authentication and authorization
        - Error handling and logging
        - External API calls & timeouts
        - Validation and serialization/deserialization
    - Prefer explicit handling of edge cases over “happy-path only” implementations.

---

## Tool-specific behavior hints

### JetBrains AI Assistant

- For inline suggestions:
    - Prefer minimal changes that fit into the existing style.
    - When in doubt, follow the patterns found in nearby files.

- For chat/agent mode:
    - When performing large refactors or multi-file changes, explain the approach briefly so the developer can verify.

### Junie (JetBrains coding agent)

- When generating backend features:
    - Create module, controller, service, DTOs, and corresponding tests.
    - Wire modules in alignment with existing patterns.

- When working with the panel app:
    - Never modify generated API/spec code.
    - Use existing widgets and theming.

- For project-wide operations:
    - Use the documented commands:
        - Backend/admin: `pnpm run build`
        - Panel: `melos rebuild-all`, `melos analyze`

### Qodo (PR/code review)

- Treat the rules in this file as the basis for:
    - Severity classification (critical/major/minor/info)
    - Suggestions to add/extend tests
    - Architecture boundary checks
- Prefer actionable, specific comments over vague “improve this” notes.

---

## How AI tools should behave (summary)

- Prefer existing patterns and abstractions.
- Stay within the scope of the task.
- Never touch generated code.
- Encourage and support good test coverage.
- Keep changes readable, maintainable, and aligned with the project’s architecture and style.
