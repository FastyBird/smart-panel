Run tests for the specified app.

Usage: /test [backend|admin|all] [--watch]

Run the appropriate test commands:
- For backend: `pnpm --filter @fastybird/smart-panel-backend test:unit`
- For admin: `pnpm --filter @fastybird/smart-panel-admin test:unit`
- For all: run both

If --watch is specified, run in watch mode.

Report test results and any failures.
