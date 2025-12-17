Run linting and type checking for the specified app.

Usage: /lint [backend|admin|all]

Run the appropriate lint commands:
- For backend: `pnpm --filter @fastybird/smart-panel-backend lint:js:check` and `pnpm --filter @fastybird/smart-panel-backend type-check`
- For admin: `pnpm --filter @fastybird/smart-panel-admin lint:js:check` and `pnpm --filter @fastybird/smart-panel-admin type-check`
- For all: run both

Report any errors found and suggest fixes.
