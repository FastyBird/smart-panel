# Backend API & Swagger Conventions

This document defines strict conventions for NestJS backend controllers, DTOs, models, entities, and Swagger/OpenAPI decorators.

The **Devices module** serves as the current golden reference implementation.

---

## 1. Modules & API Tags

Each NestJS module or plugin MUST define its API tag via `@ApiTag`:

```ts
@ApiTag({
  tagName: DEVICES_MODULE_NAME,
  displayName: DEVICES_MODULE_API_TAG_NAME,
  description: DEVICES_MODULE_API_TAG_DESCRIPTION,
})
@Module({})
export class DevicesModule {}
```

Rules:
- Each module/plugin has at least **one primary tag**.
- `tagName` = unique module/plugin identifier.
- `displayName` = human-visible label in OpenAPI/Swagger UI.
- `description` = module explanation.

---

## 2. Controllers

### 2.1 Class-level Requirements

```ts
@ApiTags(DEVICES_MODULE_API_TAG_NAME)
@Controller('devices')
export class DevicesController {}
```

- `@ApiTags(...)` is **mandatory**.
- Use shared constants such as `DEVICES_MODULE_API_TAG_NAME`.

### 2.2 Method-level Requirements

Each controller action must include:

```ts
@ApiOperation({
  tags: [DEVICES_MODULE_API_TAG_NAME],
  summary: 'Retrieve a list of available devices',
  description: 'Fetches a list of all devices currently registered...',
  operationId: 'get-devices-module-devices',
})
@ApiSuccessResponse(
  DevicesResponseModel,
  'A list of devices successfully retrieved...',
)
@ApiInternalServerErrorResponse('Internal server error')
@Get()
async findAll(): Promise<DevicesResponseModel> {}
```

#### `@ApiOperation` (REQUIRED)
Must include:
- `tags`
- `summary`
- `description`
- `operationId`

#### Success Response Decorator (REQUIRED)
One of:
- `@ApiSuccessResponse`
- `@ApiCreatedSuccessResponse`
- `@ApiAcceptedSuccessResponse`

Each requires:
- response model type
- description

#### Error Responses (OPTIONAL)
Use as applicable:
- `@ApiBadRequestResponse`
- `@ApiForbiddenResponse`
- `@ApiNotFoundResponse`
- `@ApiUnprocessableEntityResponse`
- `@ApiInternalServerErrorResponse` (generally present on all actions)

All error responses require a description.

#### Request Body
Required for POST/PATCH actions:
- Must use DTOs (`*Dto`).
- Must include `@ApiBody` with description and wrapper DTO (`Req*Dto`).

---

## 3. Response Models & BaseSuccessResponseModel

### 3.1 BaseSuccessResponseModel

All **successful responses** MUST use `BaseSuccessResponseModel<T>`:

- `status`, `timestamp`, `request_id`, `path`, `method`, and `metadata` are populated by **the response interceptor**, not the controller.
- `data` is populated by the controller.

### 3.2 Response Models (`*ResponseModel`)

```ts
@ApiSchema({ name: 'DevicesModuleResDevices' })
export class DevicesResponseModel extends BaseSuccessResponseModel<DeviceEntity[]> {
  @ApiProperty({
    description: 'The actual data payload returned by the API',
    type: 'array',
    items: { $ref: getSchemaPath(DeviceEntity) },
  })
  @Expose()
  declare data: DeviceEntity[];
}
```

Rules:
- Controller ALWAYS returns a `*ResponseModel`.
- Naming: `{ModuleName}Res{Name}` (e.g., `DevicesModuleResDevices`).
- `declare data` overrides the base generic type for Swagger.

Controller pattern:

```ts
const response = new DevicesResponseModel();
response.data = devices;
return response;
```

---

## 4. DTOs (Input Only)

DTOs are **input-only** and must never be used in `@ApiOkResponse` or as controller return types.

### 4.1 Data DTO

```ts
@ApiSchema({ name: 'DevicesModuleCreateDeviceControl' })
export class CreateDeviceControlDto {}
```

Schema name: `{ModuleName}{Action}{Entity}`

### 4.2 Request Wrapper DTO

```ts
@ApiSchema({ name: 'DevicesModuleReqCreateDeviceControl' })
export class ReqCreateDeviceControlDto {
  @ApiProperty({ type: () => CreateDeviceControlDto })
  @Expose()
  @ValidateNested()
  @Type(() => CreateDeviceControlDto)
  data: CreateDeviceControlDto;
}
```

Schema name: `{ModuleName}Req{Action}{Entity}`

---

## 5. Data Models & Entities (Output Payload)

### 5.1 Data Models (`*Model`)

Used for values derived from:
- computed logic
- external sources
- non-DB structures

Schema names follow `{ModuleName}Data{Name}`.

### 5.2 Entities (`*Entity`)

Used when:
- the payload is a DB-backed entity
- entity uses `@Expose` / `@Exclude`

Schema name: `{ModuleName}{Name}`

Entities may appear **inside `data`**, never as input.

---

## 6. Swagger `$ref` Rules

### Array
```ts
@ApiProperty({
  type: 'array',
  items: { $ref: getSchemaPath(TimeseriesPointModel) },
})
```

### Single object
```ts
@ApiProperty({ type: () => ChannelEntity })
```

### Static `$ref` fallback
```ts
@ApiProperty({
  items: { $ref: '#/components/schemas/DevicesModuleDataDeviceControl' },
})
```

---

## 7. Decorator Ordering

Swagger decorators MUST come before NestJS decorators:

```ts
@ApiOperation({ ... })
@ApiSuccessResponse(SomeResponseModel, '...')
@Get()
async someAction(): Promise<SomeResponseModel> {}
```

---

## 8. Summary

- Controllers always return `*ResponseModel`.
- DTOs are input only.
- Entities and DataModels populate the `data` field.
- `@ApiSchema` names follow strict naming patterns.
- Devices module is the golden reference.
