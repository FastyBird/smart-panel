# FastyBird Smart Panel API Specification

This directory contains the OpenAPI specification for the FastyBird Smart Panel API.

## Files

- `openapi.json` - OpenAPI 3.0 specification generated from the NestJS backend

## Generating the Specification

To generate or update the OpenAPI specification:

```bash
cd apps/backend
pnpm run generate:openapi
```

This will automatically:
1. Bootstrap the NestJS application
2. Discover all modules and plugins
3. Extract API documentation from controllers and DTOs
4. Generate the OpenAPI 3.0 JSON specification
5. Save it to this directory

## Using the Specification

### Viewing the Documentation

1. **Swagger UI**: Start the backend server and visit `http://localhost:3000/api/docs`
2. **Swagger Editor**: Import `openapi.json` into [Swagger Editor](https://editor.swagger.io/)
3. **Postman/Insomnia**: Import the file to generate request collections

### Generating API Clients

Generate type-safe API clients for various languages:

```bash
# TypeScript/JavaScript client
npx @openapitools/openapi-generator-cli generate \
  -i spec/api/v1/openapi.json \
  -g typescript-fetch \
  -o generated/api-client

# Other languages: python, java, csharp, go, etc.
```

### Linting

Validate the OpenAPI spec:

```bash
cd apps/backend
pnpm run lint:openapi
```

## Versioning

- **v1**: Current version
- Future versions will be added as separate directories (v2, v3, etc.)

## Important Notes

- This file is **generated automatically** - do not edit it manually
- Regenerate after making changes to API endpoints, DTOs, or documentation
- Commit the generated file to version control to track API changes
- Use semantic versioning for API changes (major.minor.patch)

## Related Documentation

- Backend Swagger usage guide: `apps/backend/SWAGGER_USAGE.md`
- API Documentation: `http://localhost:3000/api/docs` (when server is running)
