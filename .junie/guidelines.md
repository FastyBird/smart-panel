# FastyBird Smart Panel – Junie Guidelines

The canonical source of truth for project rules, commands, architecture, and AI usage is:

➡️ `/.ai-rules/GUIDELINES.md`

Junie should read and follow that document for:

- Project structure and commands (bootstrap, build, tests, migrations, Docker, OpenAPI/spec generation).
- Architecture rules and module boundaries.
- Coding style for TypeScript, Vue, and Flutter/Dart.
- Generated code locations that must never be edited.
- AI-specific rules (scope, tests, dependencies, security).

## Additional notes specific to Junie

- When generating backend features:
    - Create module, controller, service, DTOs, and unit tests following patterns from the backend source.
- When editing Flutter panel code:
    - Never modify files under `lib/api/**` or `lib/spec/**`.
    - Use existing widgets and theming where possible.
- Use multi-file edits only when necessary and keep changes focused on the requested task.
