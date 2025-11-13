---
apply: always
---

# FastyBird Smart Panel – AI Rules (JetBrains AI Assistant)

This project uses a shared canonical guideline document for AI and development:

➡️ See `/.ai-rules/GUIDELINES.md` for the full set of rules, commands, architecture, and testing expectations.

## Key constraints (must ALWAYS be respected)

- Do **not** modify generated code:
    - `apps/backend/src/openapi.d.ts`
    - `apps/backend/src/spec/**`
    - `apps/panel/lib/api/**`
    - `apps/panel/lib/spec/**`
- Respect the existing modular architecture:
    - Backend modules: `devices`, `dashboard`, `plugins`, `users`, etc.
    - Admin: Vue 3 + Pinia modules and stores.
    - Panel: Flutter app with generated API/spec and UI on top.
- Follow the coding style defined in `/.ai-rules/GUIDELINES.md`:
    - TypeScript: tabs, single quotes, semicolons, 120 char width.
    - Dart: package imports only, generated code untouched.
- When adding logic, propose or generate matching tests.
- Keep changes scoped to the requested feature or bugfix.
