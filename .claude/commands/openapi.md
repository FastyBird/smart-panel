Generate OpenAPI specification from the backend.

This command will:
1. Run `pnpm run generate:openapi` to generate the OpenAPI spec from backend Swagger decorators
2. The spec is written to `spec/api/v1/openapi.json`
3. TypeScript types are generated for the admin app
4. Dart API client is generated for the panel app

Run this after making changes to backend controllers, DTOs, or response models.
