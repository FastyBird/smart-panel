# Task: Backend as Source of Truth for OpenAPI Specification
ID: FEATURE-BACKEND-OPENAPI-SOURCE
Type: feature
Scope: backend
Size: large
Parent: none
Status: planned

## 1. Business goal

In order to eliminate manual maintenance of `spec/openapi.json`  
As a Smart Panel backend developer  
I want the backend (NestJS) to become the authoritative source of API specification using Swagger decorators, and automatically generate the OpenAPI JSON used by the admin app, display app, and CI pipelines.

## 2. Context

- Currently `spec/openapi.json` is manually maintained and treated as *source of truth*.
- Backend controllers, DTOs, entities, and validators are **not fully annotated** with Swagger decorators.
- Admin app and Flutter display app consume the `openapi.json` file to generate type-safe clients.
- CI also uses `spec/openapi.json` during build pipelines.
- Goal is to flip the flow: **backend → generated openapi.json**, not **manual → backend**.
- Backend uses NestJS (v11) and supports `@nestjs/swagger`.
- OpenAPI must remain compatible with existing clients.

## 3. Scope

### **In scope**

- Configure Swagger generation in backend (`main.ts`).
- Add Swagger decorators:
    - `@ApiProperty`, `@ApiPropertyOptional`, `@ApiOperation`, `@ApiResponse`, `@ApiTags`, `@ApiBearerAuth`, `@ApiQuery`, `@ApiParam`.
- Annotate all DTOs to match current OpenAPI schema:
    - data types, nullable, enums, minimum/maximum, format, examples, required/optional.
- Annotate all controllers to match current OpenAPI paths.
- Generate OpenAPI JSON from backend at runtime:
    - Provide `GET /openapi.json`.
    - Provide CLI / script to export JSON into `spec/openapi.json`.
- Update CI pipeline:
    - Launch backend → export JSON → use for typing generation.
- Add parity test:
    - Compare generated `/openapi.json` with current `spec/openapi.json`.
    - Fail if API contract breaks.

### **Out of scope**

- Refactoring API structure itself (endpoints, DTO design, response shapes).
- Any breaking changes to existing API unless required for Swagger correctness.
- Modifications to admin or Flutter app (beyond regenerating types).
- Removal of `spec/openapi.json` — only change its source (generated, not manual).

## 4. Acceptance criteria

- [x] Backend exposes `GET /openapi.json` returning complete OpenAPI 3.x spec.
- [x] All controllers include Swagger metadata and are fully documented.
- [x] All DTOs include `@ApiProperty` decorators with correct metadata.
- [x] All API responses are documented with appropriate `@ApiResponse`.
- [x] All request params and queries use `@ApiParam` / `@ApiQuery`.
- [ ] Security definitions (Bearer JWT) are correctly defined in Swagger.
- [x] A script exists to export OpenAPI into `spec/openapi.json`.
- [x] Admin app & Flutter app continue to successfully generate models from the exported OpenAPI file.
- [x] CI pipeline is updated to generate OpenAPI before typings/codegen steps.
- [x] A new test compares generated and existing OpenAPI for parity.
- [x] Deviations from existing OpenAPI are explicitly reviewed or justified.

## 5. Example scenarios (optional)

### Scenario: Generate OpenAPI from backend
Given the backend is running  
When I perform `GET /openapi.json`  
Then I receive a complete and valid OpenAPI schema matching the existing API definitions.

### Scenario: Admin app generates typings
Given CI exported a fresh OpenAPI file  
When admin app runs `openapi-typescript spec/openapi.json`  
Then it generates valid types without breaking changes.

### Scenario: Parity check fails
Given a backwards-incompatible change in Swagger decorators  
When the parity test runs  
Then the test fails and blocks the PR.

## 6. Technical constraints

- Follow the existing module-based architecture (auth, users, devices, dashboard, config, plugins).
- Swagger annotations must be added only to DTOs, controllers, and selected entities where required.
- Avoid changing runtime behavior of controllers; only document them.
- Generated code (e.g., OpenAPI clients) must not be modified manually.
- Ensure no new dynamic imports or circular dependencies occur.
- Keep DTOs clean and avoid decorating entities except where necessary.

## 7. Implementation hints (optional)

- Start by enabling Swagger in `main.ts` using `SwaggerModule.createDocument`.
- Map each `components.schemas` from existing OpenAPI to DTO decorators.
- Use `class-transformer` + `class-validator` alignment:
    - Swagger should reflect validators (`@IsEnum`, `@Min`, `@Max`, etc.).
- Add tests under `apps/backend/test/openapi/…`:
    - Compare JSON structures ignoring order differences.
- Look at how NestJS docs define response types using `@ApiOkResponse({ type: ... })`.
- Use a CLI script (`nestjs-command` or simple Node script) to boot the app and dump the OpenAPI schema.

## 8. AI instructions (for Junie / AI)

- Read this entire task before making code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Implement Swagger configuration, annotations, generator, and parity test.
- Ensure all acceptance criteria are addressed.
- Keep changes strictly within backend codebase.
- Do not modify unrelated modules or introduce breaking runtime behavior.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
