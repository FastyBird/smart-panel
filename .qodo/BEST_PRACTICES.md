# 📘 Project Best Practices

## 1. Project Purpose
FastyBird Smart Panel is a monorepo that powers a smart home control experience. It includes:
- Backend (NestJS/TypeScript) providing APIs and device/domain logic
- Admin (Vue 3 + Pinia/TypeScript) for configuration and administration
- Panel (Flutter/Dart) as the device-facing UI
  It targets small devices (e.g., Raspberry Pi), prioritizing robustness, efficiency, and minimal dependencies.

## 2. Project Structure
- apps/backend: NestJS services, controllers, modules, DTOs, and tests
- apps/admin: Vue 3 app with Pinia stores, components, composables, and tests
- apps/panel: Flutter app with widgets, theming, and generated API/spec clients
- .qodo: Qodo agents and workflows for reviews and suggestions
- .junie: JetBrains Junie guidelines and docs
- .aiassistant: AI coding rules and guidance for tooling

Key conventions:
- Modular architecture for backend (devices, dashboard, users, plugins, etc.)
- Admin organized by modules/pages/stores/components
- Panel separates generated API/spec client from UI widgets
- Generated code directories must not be edited:
    - apps/backend/src/openapi.d.ts
    - apps/backend/src/spec/**
    - apps/panel/lib/api/**
    - apps/panel/lib/spec/**

Entry points and configs:
- Backend: NestJS module wiring, jest configs, eslint/prettier configs
- Admin: Vite/Vitest setup, ESLint + Prettier configs
- Panel: Flutter analysis_options.yaml, melos workspace config
- Tooling: pnpm workspaces (Node.js), melos (Dart/Flutter)

## 3. Test Strategy
Frameworks:
- Backend: Jest (unit: *.spec.ts in src, E2E: *.e2e-spec.ts in apps/backend/test)
- Admin: Vitest + @testing-library/vue for components/composables
- Panel: Flutter widget tests for non-trivial UI logic

Organization and naming:
- Co-locate unit tests with source (src/** for NestJS)
- E2E tests live in apps/backend/test
- Use clear, behavior-focused test names

Mocking guidelines:
- Prefer dependency injection and mocks/spies at module boundaries
- For Admin, use testing-library best practices (query by role/label, avoid implementation details)
- For Panel, avoid testing generated API/spec; focus on widget behavior

Unit vs integration:
- Unit test core business logic and pure functions
- Integration/E2E for module wiring, API contracts, and critical flows
- Add tests alongside any significant new logic; if omitted, document rationale in PR

Coverage:
- Maintain meaningful coverage; use coverage reports (e.g., pnpm run test:cov for backend) to track

## 4. Code Style
Backend/Admin (TypeScript):
- Formatting: ESLint + Prettier
- Indentation: tabs
- Print width: 120
- Quotes: single
- Semicolons: always
- Trailing commas: always on multiline
- Import sorting: external first, then relative (../ → ./), maintain separation
- Naming: camelCase for variables/functions; PascalCase for classes/interfaces/enums/types; Vue components in PascalCase; folders in kebab-case
- Async: explicit error handling; prefer async/await with try/catch and typed errors
- Types: prefer explicit types for public APIs/DTOs; avoid any unless justified

Panel (Flutter/Dart):
- Use package imports, not relative imports
- File names: snake_case.dart; classes/widgets: PascalCase
- Generated code in lib/api/** and lib/spec/** is excluded from analysis and never edited
- Follow flutter_lints; keep analyzer warnings at zero

Error handling:
- Backend: validate inputs/DTOs, surface meaningful HTTP errors, log with context
- Admin: handle API errors gracefully in UI; avoid console noise in production
- Panel: handle network failures and state errors; avoid blocking/UI jank

Documentation:
- Keep module/class/function doc comments for public APIs and complex logic
- Document architectural decisions and non-obvious patterns

## 5. Common Patterns
Backend:
- NestJS modules with clear boundaries; DI for services
- DTOs for input/output validation and typing
- Services for domain logic; controllers thin
- Avoid god services; prefer focused, testable units

Admin:
- Vue SFCs with composition API; Pinia for state
- Composables for reusable logic and data fetching
- Testing with testing-library patterns (role/label-based queries)

Panel:
- Layered architecture: generated API/spec → services/adapters → widgets/UI
- Stateless widgets where possible; manage state clearly in stateful widgets or providers
- Avoid editing generated clients; wrap them if customization is needed

Cross-cutting:
- Consistent error and edge case handling
- Avoid new dependencies unless necessary and justified
- Prefer existing helpers and abstractions in the codebase

## 6. Do's and Don'ts
Do:
- Follow module boundaries and existing patterns
- Add or update tests with new logic; document exceptions in PRs
- Keep changes scoped; suggest refactors as separate PRs
- Use typed DTOs and validation
- Maintain formatting and linting rules
- Use import sorting and naming conventions consistently

Don't:
- Edit generated code (backend spec/openapi, panel lib/api and lib/spec)
- Introduce large refactors within unrelated PRs
- Leave debugging code (console.log, debugger, print)
- Hide errors or swallow exceptions; avoid silent failures
- Add heavy dependencies without strong justification

## 7. Tools & Dependencies
Key tools:
- pnpm workspaces for Node.js projects (backend/admin)
- melos for Dart/Flutter workspace orchestration (panel)
- ESLint + Prettier (TypeScript), flutter_lints + analyzer (Dart)
- Jest (backend), Vitest + @testing-library/vue (admin), Flutter test (panel)
- Qodo/Junie/AI Assistant configurations for reviews and consistency

Common commands (examples):
- Backend: pnpm run build, pnpm run test:unit, pnpm run test:e2e, pnpm run test:cov, pnpm run lint
- Admin: pnpm run build, pnpm run test, pnpm run lint, pnpm run format
- Panel: melos rebuild-all, melos analyze, flutter test

## 8. Other Notes
- Security: pay attention to authn/authz, token handling, session/state, and secret management
- API robustness: timeouts, retries, and error mapping for external calls
- Performance: target constrained devices; prefer efficient data structures and avoid unnecessary computation
- PR guidelines: imperative commit messages; Markdown PR description with Summary, Changes, Testing, Notes, Related Issues
- Severity classification (for reviews): critical for security/async/state/API breakages; major for validation/DI/error mishandling; minor for naming/readability/perf; info for style/refactor suggestions
