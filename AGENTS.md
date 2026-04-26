# Smart Panel - AI Agent Instructions

This is a monorepo for the FastyBird Smart Panel project:
- **Backend**: NestJS application (`apps/backend/`)
- **Admin**: Vue.js admin interface (`apps/admin/`)
- **Panel**: Flutter/Dart embedded app (`apps/panel/`)
- **Website**: Next.js documentation site (`apps/website/`)

## Architecture Reference

These files contain detailed domain architecture documentation:
- `docs/climate-architecture.md` - Climate domain architecture
- `docs/media-architecture.md` - Media domain architecture
- `docs/optimistic-ui-architecture.md` - Panel optimistic UI patterns

Read them when working on the relevant domain.

## Requirements

- **Node.js**: >= 24
- **pnpm**: >= 10
- **Dart/Flutter**: For panel app development

## Commands

```bash
# Install & setup
pnpm run bootstrap

# Development
pnpm run start:dev              # Backend dev server
pnpm run admin:build            # Build admin app

# Testing
pnpm run test:unit              # Backend unit tests (Jest)
pnpm run test:e2e               # Backend E2E tests
pnpm --filter ./apps/admin run test:unit  # Admin unit tests (Vitest)

# Linting & formatting
pnpm run lint:js                # Lint TypeScript
pnpm run lint:js:fix            # Auto-fix lint issues
pnpm run pretty                 # Format code

# Code generation
pnpm run generate:openapi       # Generate OpenAPI spec + admin types + panel client
pnpm run generate:spec          # Generate device/channel specs

# Database migrations
cd apps/backend
pnpm run typeorm:migration:run  # Run pending migrations

# Flutter panel
melos rebuild-all               # Rebuild API and specs after OpenAPI changes
melos analyze                   # Analyze Dart code
```

## Generated Code - DO NOT EDIT

Never edit these files manually. Update the source (backend Swagger decorators, spec generators) instead:
- `spec/api/v1/openapi.json` - Generated from backend Swagger decorators
- `apps/backend/src/spec/` - Generated device/channel specs
- `apps/admin/src/openapi.ts` - Generated from OpenAPI spec
- `apps/panel/lib/api/` - Generated Dart API client
- `apps/panel/lib/spec/` - Generated Dart device/channel specs

Note: `apps/admin/src/openapi.constants.ts` is manually maintained (exports from generated `openapi.ts`).

## Code Style

### TypeScript (Backend & Admin)

- **Indentation**: tabs (not spaces)
- **Print width**: 120 characters
- **Quotes**: single quotes
- **Semicolons**: always
- **Trailing commas**: always on multiline
- **Import sorting**: external imports first, then relative (`../` then `./`), with blank line between groups

Naming:
- Variables & functions: `camelCase`
- Classes, interfaces, enums, types: `PascalCase`
- Vue components: `PascalCase` filenames
- Folders: `kebab-case`

### Flutter/Dart

- **Imports**: package imports only (no relative imports)
- **Files**: `snake_case.dart`
- **Classes/widgets**: `PascalCase`

## Backend API Conventions

The **backend is the source of truth** for the OpenAPI specification. The **Devices module** is the golden reference implementation.

### Controllers

- Always annotate with `@ApiTags(MODULE_API_TAG_NAME)`
- Each action requires `@ApiOperation` with `tags`, `summary`, `description`, `operationId`
- Always return `*ResponseModel` (extends `BaseSuccessResponseModel<T>`)
- Use `@ApiSuccessResponse` / `@ApiCreatedSuccessResponse` for success responses
- Swagger decorators MUST come before NestJS decorators (`@Get`, `@Post`, etc.)

### DTOs vs Models vs Entities

- **DTOs** (`*Dto`) — input only, never in responses
- **Entities** (`*Entity`) — DB-backed objects, appear in response `data`
- **Models** (`*Model`) — computed/non-DB values in response `data`
- **Response Models** (`*ResponseModel`) — wraps `data` in standard response envelope

### Schema naming

- Response: `{ModuleName}Res{Name}` (e.g., `DevicesModuleResDevices`)
- DTO: `{ModuleName}{Action}{Entity}` (e.g., `DevicesModuleCreateDevice`)
- Request wrapper: `{ModuleName}Req{Action}{Entity}`
- Data model: `{ModuleName}Data{Name}`

### Controller response pattern

```typescript
const response = new DevicesResponseModel();
response.data = devices;
return response;
```

## Testing

- **Backend**: Jest. Unit tests (`*.spec.ts`) next to source files. E2E tests in `test/`.
- **Admin**: Vitest + `@testing-library/vue`. Test composables and stores.
- **Panel**: Flutter widget tests for non-trivial UI logic.

Add tests for new business logic. If tests are skipped, explain why in the PR.

## Project Structure

```
apps/
├── backend/src/
│   ├── modules/     # Core: api, auth, config, dashboard, devices, displays,
│   │                #   energy, extensions, intents, mdns, platform,
│   │                #   scenes, security, seed, spaces, stats, storage,
│   │                #   swagger, system, users, weather, websocket
│   └── plugins/     # Integrations: devices-home-assistant, devices-shelly-ng,
│                    #   devices-shelly-v1, devices-third-party, influx-v1,
│                    #   memory-storage, simulator, pages-*, tiles-*,
│                    #   data-sources-*, scenes-*, weather-*, logger-*,
│                    #   buddy-*
├── admin/src/
│   ├── modules/     # Mirrors backend modules
│   └── plugins/     # Mirrors backend plugins
├── panel/lib/
│   ├── modules/     # Feature modules
│   ├── features/    # UI features (deck, discovery, overlay, settings)
│   ├── plugins/     # Plugin implementations
│   ├── api/         # Generated API client (DO NOT EDIT)
│   └── spec/        # Generated device/channel specs (DO NOT EDIT)
└── website/         # Next.js documentation site

packages/
├── extension-sdk/       # SDK for building extensions
└── example-extension/   # Example extension

docs/                    # Architecture reference documents
tasks/                   # Feature and technical task specifications
```

## Custom Slash Commands

- `/test [backend|admin|all]` - Run tests
- `/lint [backend|admin|all]` - Run linting and type checking
- `/openapi` - Generate OpenAPI specification
- `/task <task-id>` - Work on a task from `tasks/`

## Task Workflow

When implementing features:
1. Check `tasks/` for task specifications
2. Follow the task's acceptance criteria
3. Update task status when done
4. Mark checkboxes as complete

## Key Rules

1. **NEVER push directly to main.** All changes must go through a feature branch and Pull Request — no exceptions, not even for "quick fixes" or lint fixes. Only push to main if the user explicitly requests it.
2. Respect modular architecture — avoid "god services" mixing multiple concerns.
3. Prefer existing patterns, helpers, and abstractions over inventing new ones.
4. Do not introduce new dependencies without a strong reason.
5. Pay special attention to: auth, error handling, timeouts on external calls, data validation.
6. Migration policy: always create incremental migration files for schema changes (e.g., `1000000000002-AddTokenLastUsedAt.ts`). Never modify the initial migration — alpha releases are deployed and existing installations have already run it.
