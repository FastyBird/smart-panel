# Backend API Rules (AI Version)

These rules are mandatory for all backend API changes.  
The Devices module is the golden reference.

---

## 1. DTOs (`*Dto`)

- DTOs are **input only**.
- NEVER used in:
  - controller return types
  - `@ApiOkResponse`, `@ApiCreatedResponse`, etc.
- Schema naming:
  - Input DTO: `{ModuleName}{Action}{Entity}`
  - Request wrapper DTO: `{ModuleName}Req{Action}{Entity}`

---

## 2. Response Models (`*ResponseModel`)

- All success responses MUST return a `*ResponseModel`.
- Response models extend `BaseSuccessResponseModel<T>`.
- Naming: `{ModuleName}Res{Name}`
- Controllers must:

```ts
const res = new SomeResponseModel();
res.data = payload;
return res;
```

---

## 3. Data Models (`*Model`) & Entities (`*Entity`)

### Data Models
- Used for computed or external data.
- Schema name: `{ModuleName}Data{Name}`.

### Entities
- Used if safely decorated via `@Expose` / `@Exclude`.
- Schema name: `{ModuleName}{Name}`.

Payload (`data`) may contain:
- Entities
- Data models

---

## 4. Controllers

### Class-level
- MUST contain:  
  `@ApiTags(<MODULE_API_TAG_NAME>)`

### Method-level requirements
- MUST contain:
  - `@ApiOperation` with summary, description, operationId, tags.
  - One success decorator:
    - `@ApiSuccessResponse`, `@ApiCreatedSuccessResponse`, or `@ApiAcceptedSuccessResponse`.
- MAY contain:
  - `@ApiBadRequestResponse`, `@ApiForbiddenResponse`,  
    `@ApiNotFoundResponse`, `@ApiUnprocessableEntityResponse`,  
    `@ApiInternalServerErrorResponse` (recommended).

All success/error decorators must include **descriptions**.

Request body:
- Uses input DTO (`*Dto`) wrapped in `Req*Dto`.
- `@ApiBody` is mandatory for all POST/PATCH actions.

Controllers must **never**:
- return DTOs
- return raw entities/models without wrapping in `*ResponseModel`

---

## 5. Swagger References

### Arrays
```ts
@ApiProperty({ type: 'array', items: { $ref: getSchemaPath(SomeModel) } })
```

### Single object
```ts
@ApiProperty({ type: () => SomeEntity })
```

### Fallback `$ref`
```ts
@ApiProperty({ items: { $ref: '#/components/schemas/DevicesModuleDataExample' } })
```

---

## 6. Decorator Order

Swagger decorators ALWAYS come before NestJS decorators:

```ts
@ApiOperation({ ... })
@ApiSuccessResponse(Model, '...')
@Get()
async fn(): Promise<Model> {}
```

---

Use the Devices module as the template for structure, naming, and patterns.
