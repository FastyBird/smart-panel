# Smart Panel - Claude Code Instructions

This is a monorepo for the FastyBird Smart Panel project:
- **Backend**: NestJS application (`apps/backend/`)
- **Admin**: Vue.js admin interface (`apps/admin/`)
- **Panel**: Flutter/Dart embedded app (`apps/panel/`)

## Essential Documentation

Read these files for detailed guidelines:
- `.ai-rules/GUIDELINES.md` - Development setup, commands, coding style, AI guidelines
- `.ai-rules/API_CONVENTIONS.md` - Backend API & Swagger conventions
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
   - `apps/admin/src/api/openapi.ts`
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
│   ├── modules/     # Core: auth, devices, dashboard, displays, users, weather
│   └── plugins/     # Integrations: devices-*, pages-*, tiles-*, data-sources-*
├── admin/src/
│   ├── modules/     # Mirrors backend modules
│   └── plugins/     # Mirrors backend plugins
└── panel/lib/
    ├── modules/     # Feature modules
    ├── api/         # Generated (DO NOT EDIT)
    └── spec/        # Generated (DO NOT EDIT)
```

### Task Workflow

When implementing features:
1. Check `tasks/` for task specifications
2. Follow the task's acceptance criteria
3. Update task status when done
4. Mark checkboxes as complete
