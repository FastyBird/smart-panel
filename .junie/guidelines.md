# FastyBird Smart Panel Development Guidelines

## Project Overview

This is a monorepo for the FastyBird Smart Panel project, consisting of:
- **Backend**: NestJS application (TypeScript)
- **Admin**: Vue.js admin interface (TypeScript)
- **Panel**: Flutter/Dart mobile/embedded application

The project uses **pnpm workspaces** for Node.js packages and **melos** for Dart/Flutter packages.

## Requirements

- **Node.js**: >= 20
- **pnpm**: >= 10 (specifically 10.20.0)
- **Dart/Flutter**: For panel app development

## Initial Setup / Bootstrap

To set up the project from scratch, run:

```bash
pnpm run bootstrap
```

This command will:
1. Install all dependencies (`pnpm install`)
2. Generate OpenAPI type definitions (`generate:openapi`)
3. Generate device/channel specifications (`generate:spec`)
4. Build the extension SDK and example
5. Run TypeORM database migrations (`typeorm:migration:run`)
6. Build the backend and admin applications

After bootstrap, you can onboard the first user:

```bash
pnpm run onboard
```

## Build & Development

### Backend

```bash
# Development with watch mode
cd apps/backend
pnpm run start:dev

# Debug mode
pnpm run start:debug

# Production build
pnpm run build

# Production start
pnpm run start:prod
```

### Admin

```bash
# Build admin interface
pnpm run admin:build

# Or from root
pnpm --filter @fastybird/smart-panel-admin build
```

### Flutter Panel

```bash
# Rebuild API and specs (run this after OpenAPI changes)
melos rebuild-all

# Analyze code
melos analyze

# Build for different architectures
melos run build-panel-arm64          # ARM64 debug
melos run build-panel-arm64-release  # ARM64 release
melos run build-panel-arm            # ARM debug
melos run build-panel-arm-release    # ARM release
```

## Testing

### Backend Tests

The backend uses **Jest** as the testing framework with **ts-jest** for TypeScript support.

#### Test Types

1. **Unit Tests** (*.spec.ts in src/): Test individual functions, services, and components
2. **E2E Tests** (*.e2e-spec.ts in test/): Test full application flows with HTTP requests

#### Running Tests

```bash
# From project root
pnpm run test:unit        # Run all unit tests
pnpm run test:e2e         # Run all e2e tests
pnpm run test:watch       # Run tests in watch mode
pnpm run test:cov         # Run with coverage report
pnpm run test:debug       # Run in debug mode

# From backend directory
cd apps/backend
pnpm test:unit            # Run all unit tests
pnpm test:unit <filename> # Run specific test file

# Using Makefile (from root)
make server-unit-tests
make server-e2e-tests
make server-cov-tests
```

#### Jest Configuration

- **Unit tests config**: `apps/backend/jest.config.mjs`
  - Test files: `*.spec.ts` in `src/` directory
  - Coverage output: `apps/backend/coverage/`
  
- **E2E tests config**: `apps/backend/test/jest-e2e.json`
  - Test files: `*.e2e-spec.ts` in `test/` directory

#### Writing Tests

**Unit Test Example:**
```typescript
import { add } from './utils';

describe('add', () => {
	test('adds two numbers', () => {
		expect(add(2, 3)).toBe(5);
	});
});
```

**E2E Test Example:**
```typescript
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('API (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleFixture = await Test.createTestingModule({
			imports: [AppModule.register({ moduleExtensions: [], pluginExtensions: [] })],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it('/endpoint (GET)', () => {
		return request(app.getHttpServer())
			.get('/endpoint')
			.expect(200);
	});
});
```

#### Running a Single Test File

```bash
cd apps/backend
pnpm test:unit path/to/file.spec.ts
```

## Code Style

### Backend/Admin (TypeScript)

#### ESLint Configuration

- Config file: `apps/backend/eslint.config.mjs`
- Based on: TypeScript ESLint recommended + Prettier integration
- Custom rules:
  - `@typescript-eslint/no-explicit-any`: off (allows `any` type)
  - `@typescript-eslint/no-floating-promises`: warn
  - `@typescript-eslint/no-unsafe-argument`: warn
  - `@typescript-eslint/no-unused-vars`: error (except params starting with `_`)
  - `comma-dangle`: error (always-multiline)

```bash
# Lint code
pnpm run lint:js

# Auto-fix linting issues
pnpm run lint:js:fix

# Check for circular dependencies
pnpm run lint:deps
```

#### Prettier Configuration

- Config file: `apps/backend/prettier.config.mjs`
- Key settings:
  - **Tabs**: Use tabs for indentation (not spaces)
  - **Print width**: 120 characters
  - **Quotes**: Single quotes
  - **Semicolons**: Always
  - **Trailing commas**: Always on multiline
  - **Import sorting**: Enabled via `@trivago/prettier-plugin-sort-imports`
    - External imports first
    - Then relative imports (`../`, `./`)
    - With separation between groups

```bash
# Check formatting
pnpm run pretty:check

# Auto-format code
pnpm run pretty:write

# Both check and write
pnpm run pretty
```

### Flutter/Dart Panel

#### Analysis Configuration

- Config file: `apps/panel/analysis_options.yaml`
- Based on: `package:flutter_lints/flutter.yaml`
- Custom rules:
  - `prefer_relative_imports`: false (disabled)
  - `always_use_package_imports`: true (enforced)
  - Excludes: `lib/api/**` (generated code)

```bash
# Analyze Dart code
melos analyze
# or
cd apps/panel
dart analyze .
```

## Database Migrations (TypeORM)

The backend uses TypeORM for database management with SQLite.

### Migration Commands

```bash
cd apps/backend

# Generate a new migration (after entity changes)
pnpm run typeorm:migration:generate -- ./src/migrations/MigrationName

# Run pending migrations
pnpm run typeorm:migration:run

# Revert last migration
pnpm run typeorm:migration:revert

# Production migration run
pnpm run typeorm:migration:run:prod
```

## Docker Development

Docker Compose setup is available for containerized development.

```bash
# Start containers
make docker-up

# Stop containers
make docker-down

# Access container shell (www-data user)
make docker-bash

# Access container shell (root)
make docker-bash-root
```

## OpenAPI & Spec Generation

### OpenAPI Types

Generate TypeScript types from OpenAPI specification:

```bash
pnpm run generate:openapi
```

This creates type definitions in `apps/backend/src/openapi.d.ts` from `spec/api/v1/openapi.json`.

### Device/Channel Specs

Generate device and channel specifications:

```bash
# Backend
cd apps/backend
pnpm run generate:spec

# Panel (Dart)
melos rebuild-spec
```

## Project Structure

```
apps/
  ├── backend/        # NestJS backend application
  │   ├── src/
  │   │   ├── plugins/       # Feature plugins (devices, data sources, etc.)
  │   │   ├── migrations/    # TypeORM migrations
  │   │   └── *.spec.ts      # Unit tests
  │   └── test/
  │       └── *.e2e-spec.ts  # E2E tests
  ├── admin/          # Vue.js admin interface
  └── panel/          # Flutter/Dart panel app
      ├── lib/
      │   ├── api/           # Generated API client (excluded from analysis)
      │   └── spec/          # Generated device/channel specs
      └── tools/             # Build scripts

spec/
  └── api/v1/         # OpenAPI specifications

bin/                  # Utility scripts
docs/                 # Documentation
```

## Common Issues & Tips

### Import Ordering

Both TypeScript (via Prettier) and Dart (via analysis_options) enforce specific import ordering:
- **TypeScript**: External imports → relative imports (../ → ./)
- **Dart**: Package imports only (no relative imports)

### Test File Location

- **Backend unit tests**: Place `*.spec.ts` files next to the source files they test
- **Backend e2e tests**: Place `*.e2e-spec.ts` files in `apps/backend/test/`

### Generated Code

Some directories contain auto-generated code that should not be manually edited:
- `apps/backend/src/openapi.d.ts` (from OpenAPI spec)
- `apps/backend/src/spec/` (device/channel specs)
- `apps/panel/lib/api/` (from OpenAPI spec)
- `apps/panel/lib/spec/` (device/channel specs)

### TypeScript Configuration

The backend uses path aliases configured in `tsconfig.json`. The ESLint config uses `projectService` for type-aware linting with proper tsconfig resolution.

### NestJS Testing

When testing NestJS modules, use `Test.createTestingModule()` to create isolated testing modules. For the main app, use `AppModule.register()` with configuration options for extensions.

## CLI Commands

The backend provides CLI commands via nestjs-command:

```bash
# Development
cd apps/backend
pnpm run cli <command>

# Production
pnpm run cli:prod <command>

# Examples:
pnpm run cli:prod auth:onboarding           # Create first user
pnpm run cli:prod config:generate-admin-extensions  # Generate admin extensions
```
