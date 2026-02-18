# Smart Panel - Claude Code Instructions

This is a monorepo for the FastyBird Smart Panel project:
- **Backend**: NestJS application (`apps/backend/`)
- **Admin**: Vue.js admin interface (`apps/admin/`)
- **Panel**: Flutter/Dart embedded app (`apps/panel/`)
- **Website**: Next.js documentation site (`apps/website/`)

## Essential Documentation

Read these files for detailed guidelines:
- `.ai-rules/GUIDELINES.md` - Development setup, commands, coding style, AI guidelines
- `.ai-rules/API_CONVENTIONS.md` - Backend API & Swagger conventions
- `.ai-rules/CLIMATE_ARCHITECTURE.md` - Climate domain architecture
- `.ai-rules/MEDIA_ARCHITECTURE.md` - Media domain architecture
- `.ai-rules/OPTIMISTIC_UI_ARCHITECTURE.md` - Panel optimistic UI patterns
- `tasks/` - Feature and technical task specifications

## Quick Reference

### Commands

```bash
# Install & setup
pnpm run bootstrap

# Development
pnpm run start:dev              # Backend dev server
pnpm run admin:build            # Build admin app

# Testing
pnpm run test:unit              # Backend unit tests
pnpm run test:e2e               # Backend E2E tests

# Linting & formatting
pnpm run lint:js                # Lint TypeScript
pnpm run lint:js:fix            # Auto-fix lint issues
pnpm run pretty                 # Format code

# Code generation
pnpm run generate:openapi       # Generate OpenAPI spec from backend
pnpm run generate:spec          # Generate device/channel specs
```

### Key Rules

1. **Generated code** - Never edit files in:
   - `spec/api/v1/openapi.json`
   - `apps/backend/src/spec/`
   - `apps/admin/src/openapi.constants.ts`
   - `apps/panel/lib/api/`
   - `apps/panel/lib/spec/`

2. **Backend API** - Follow patterns in `.ai-rules/API_CONVENTIONS.md`:
   - Controllers return `*ResponseModel`
   - DTOs are input only
   - Use Swagger decorators for OpenAPI generation

3. **Code style**:
   - TypeScript: tabs, 120 width, single quotes, semicolons
   - Dart: package imports only, snake_case files

4. **Testing** - Add tests for new business logic

### Project Structure

```
apps/
├── backend/src/
│   ├── modules/     # Core: api, auth, config, dashboard, devices, displays,
│   │                #   energy, extensions, influxdb, intents, mdns, platform,
│   │                #   scenes, security, seed, spaces, stats, swagger,
│   │                #   system, users, weather, websocket
│   └── plugins/     # Integrations: devices-*, pages-*, tiles-*,
│                    #   data-sources-*, scenes-*, weather-*, logger-*
├── admin/src/
│   ├── modules/     # Mirrors backend modules (auth, config, dashboard,
│   │                #   devices, displays, energy, extensions, influxdb,
│   │                #   intents, mdns, scenes, security, spaces, stats,
│   │                #   system, users, weather)
│   └── plugins/     # Mirrors backend plugins
├── panel/lib/
│   ├── modules/     # Feature modules (config, dashboard, deck, devices,
│   │                #   displays, energy, intents, scenes, security,
│   │                #   spaces, system, weather)
│   ├── features/    # UI features (deck, discovery, overlay, settings)
│   ├── plugins/     # Plugin implementations
│   ├── api/         # Generated API client (DO NOT EDIT)
│   └── spec/        # Generated device/channel specs (DO NOT EDIT)
└── website/         # Next.js documentation site

packages/
├── extension-sdk/       # SDK for building extensions
└── example-extension/   # Example extension
```

### Custom Slash Commands

- `/test [backend|admin|all]` - Run tests
- `/lint [backend|admin|all]` - Run linting and type checking
- `/openapi` - Generate OpenAPI specification
- `/task <task-id>` - Work on a task from `tasks/`

### Task Workflow

When implementing features:
1. Check `tasks/` for task specifications
2. Follow the task's acceptance criteria
3. Update task status when done
4. Mark checkboxes as complete
