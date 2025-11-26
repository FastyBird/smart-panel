# API Schema Naming Convention

This document defines the unified naming convention for `@ApiSchema` decorators used across Models, Entities, and DTOs in the backend application.

## Overview

The `@ApiSchema` decorator is used to provide OpenAPI/Swagger schema names that appear in the generated API documentation. These names should be globally unique and follow a consistent pattern.

## Naming Convention

### Pattern Structure

```
{ModuleName}{Type}{Name}
```

Where:
- **ModuleName**: The module/plugin name in PascalCase (e.g., `AuthModule`, `UsersModule`, `DevicesHomeAssistantPlugin`)
- **Type**: Type prefix indicating the schema category:
  - `Res` - Response wrapper models (extending `BaseSuccessResponseDto`)
  - `Req` - Request wrapper DTOs (wrapping request data)
  - `Data` - Data models (output data structures, not response wrappers)
  - No prefix - Input DTOs, entities
- **Name**: Descriptive name in PascalCase describing the schema

### Rules

1. **Module/Plugin Prefix**: Always include the module/plugin name to ensure global uniqueness
2. **Type Prefixes**: 
   - `Res` - Response wrapper models
   - `Req` - Request wrapper DTOs
   - `Data` - Data models (output data structures)
   - No prefix - Input DTOs, entities
3. **PascalCase**: All components use PascalCase
4. **Descriptive Names**: Names should clearly describe what the schema represents
5. **No Conflicts**: Each schema name must be globally unique

## Examples by Category

### Response Models (Response Wrappers)

Response models that extend `BaseSuccessResponseDto`:

```typescript
// Class name: ProfileResponseModel
@ApiSchema({ name: 'AuthModuleResProfile' })
export class ProfileResponseModel extends BaseSuccessResponseDto<UserEntity> {
  @ApiProperty({
    description: 'The actual data payload returned by the API',
    type: () => UserEntity,
  })
  data: UserEntity;
}

// Class name: LoginResponseModel
@ApiSchema({ name: 'AuthModuleResLogin' })
export class LoginResponseModel extends BaseSuccessResponseDto<LoggedInModel> {
  @ApiProperty({
    description: 'The actual data payload returned by the API',
    type: () => LoggedInModel,
  })
  data: LoggedInModel;
}
```

**Pattern**: `{ModuleName}Res{ModelName}`

### Data Models

Data models representing output data structures (not response wrappers):

```typescript
// Class name: LoggedInModel
@ApiSchema({ name: 'AuthModuleDataLogin' })
export class LoggedInModel {
  @ApiProperty({ name: 'access_token', type: 'string' })
  @Expose({ name: 'access_token' })
  accessToken: string;

  @ApiProperty({ name: 'refresh_token', type: 'string' })
  @Expose({ name: 'refresh_token' })
  refreshToken: string;

  // ... other properties
}

// Class name: CheckModel
@ApiSchema({ name: 'AuthModuleDataValidation' })
export class CheckModel {
  @ApiProperty({
    description: 'Indicates whether the provided validation field is valid.',
    type: 'boolean',
    example: true,
  })
  @Expose()
  valid: boolean;
}
```

**Pattern**: `{ModuleName}Data{ModelName}`

**Note**: The `Data` prefix distinguishes data models from input DTOs, preventing naming conflicts.

### DTOs (Data Transfer Objects)

#### Input DTOs (Request Body)

DTOs used for request input:

```typescript
// Class name: LoginDto
@ApiSchema({ name: 'AuthModuleLogin' })
export class LoginDto {
  @ApiProperty({
    description: 'The username of the user.',
    type: 'string',
    example: 'johndoe',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({
    description: "The user's password.",
    type: 'string',
    format: 'password',
    example: 'superstrongpassword',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  password: string;
}

// Class name: RegisterDto
@ApiSchema({ name: 'AuthModuleRegister' })
export class RegisterDto {
  // ... properties
}
```

**Pattern**: `{ModuleName}{Action}{Entity}`

#### Request Wrapper DTOs

DTOs that wrap request data:

```typescript
// Class name: ReqLoginDto (request wrapper)
@ApiSchema({ name: 'AuthModuleReqLogin' })
export class ReqLoginDto {
  @ApiProperty({
    description: 'Login credentials',
    type: () => LoginDto,
  })
  @Expose()
  @ValidateNested()
  @Type(() => LoginDto)
  data: LoginDto;
}
```

**Pattern**: `{ModuleName}Req{Action}{Entity}`

### Entities

Database entities:

```typescript
// Class name: UserEntity
@ApiSchema({ name: 'UsersModuleUser' })
@Entity('users_module_users')
export class UserEntity extends BaseEntity {
  // ... properties
}

// Class name: DisplayInstanceEntity
@ApiSchema({ name: 'UsersModuleDisplayInstance' })
@Entity('users_module_display_instances')
export class DisplayInstanceEntity extends BaseEntity {
  // ... properties
}
```

**Pattern**: `{ModuleName}{EntityName}`

## Class Naming (Internal)

While `@ApiSchema` names include module prefixes for OpenAPI documentation, **class names should NOT include module prefixes** within the module scope. Class names should be:

1. **Descriptive and clear**
2. **Include appropriate suffix**:
   - Models: `{Name}Model` (e.g., `LoginModel`, `ProfileResponseModel`)
   - DTOs: `{Name}Dto` (e.g., `LoginDto`, `CreateUserDto`)
   - Entities: `{Name}Entity` (e.g., `UserEntity`, `DeviceEntity`)
3. **No module prefix** in class names (prefix only in `@ApiSchema`)

## Summary Table

| Category | Class Name Pattern | @ApiSchema Pattern | Example |
|----------|-------------------|-------------------|---------|
| Response Models | `{Name}ResponseModel` | `{ModuleName}Res{Name}` | `ProfileResponseModel` / `AuthModuleResProfile` |
| Data Models | `{Name}Model` | `{ModuleName}Data{Name}` | `LoggedInModel` / `AuthModuleDataLogin` |
| Input DTOs | `{Action}{Entity}Dto` | `{ModuleName}{Action}{Entity}` | `LoginDto` / `AuthModuleLogin` |
| Request Wrappers | `Req{Action}{Entity}Dto` | `{ModuleName}Req{Action}{Entity}` | `ReqLoginDto` / `AuthModuleReqLogin` |
| Entities | `{Name}Entity` | `{ModuleName}{Name}` | `UserEntity` / `UsersModuleUser` |

## Key Distinctions

### Input DTOs vs Data Models

- **Input DTOs** (`{ModuleName}{Action}{Entity}`): Used for request bodies, no prefix needed
- **Data Models** (`{ModuleName}Data{Name}`): Used for output data structures, require `Data` prefix

This prevents conflicts like:
- ❌ `LoginDto` and `LoggedInModel` both using `AuthModuleLogin`
- ✅ `LoginDto` uses `AuthModuleLogin`, `LoggedInModel` uses `AuthModuleDataLogin`

### Response Wrappers vs Data Models

- **Response Wrappers** (`{ModuleName}Res{Name}`): Extend `BaseSuccessResponseDto`, wrap data in `data` property
- **Data Models** (`{ModuleName}Data{Name}`): Plain data structures, used inside response wrappers

## Response vs. Input Usage Rules

These rules must be respected across all modules:

- **Input DTOs (`*Dto`)**
  - Used **only** for request input (`@Body()`, `@Query()`, `@Param()`, etc.).
  - MUST NOT be used as:
    - Controller return types
    - `@ApiOkResponse({ type: ... })`, `@ApiCreatedResponse({ type: ... })`, etc.
  - `@ApiSchema` name pattern: `{ModuleName}{Action}{Entity}` (no `Res`/`Data` prefix).

- **Response Wrappers (`*ResponseModel`, extending `BaseSuccessResponseDto`)**
  - Used as top-level response types in controllers.
  - Wrap actual payload in a `data` property.
  - `@ApiSchema` name pattern: `{ModuleName}Res{Name}`.
  - `data` property MUST reference a `Data` model, entity, or a union thereof.

- **Data Models (`*Model`)**
  - Used as payload structures inside `data` of response wrappers.
  - Used when the payload is:
    - Aggregated
    - Comes from a third party
    - Not a 1:1 DB entity
  - `@ApiSchema` name pattern: `{ModuleName}Data{Name}`.

- **Entities (`*Entity`)**
  - May be used as payload inside `data` **only if** they are properly controlled via `@Expose`/`@Exclude` (or groups).
  - `@ApiSchema` name pattern: `{ModuleName}{Name}`.
  - SHOULD NOT be used directly as request body types.

## Benefits

1. **Global Uniqueness**: Module prefixes ensure no naming conflicts across modules/plugins
2. **Clear Differentiation**: `Data` prefix distinguishes output models from input DTOs
3. **Clear Organization**: Easy to identify which module a schema belongs to in OpenAPI docs
4. **Consistency**: Uniform pattern makes it easy to understand and maintain
5. **Clean Code**: Class names remain simple and readable within module scope
6. **Type Safety**: TypeScript types use clean class names, while OpenAPI uses prefixed names
7. **Automatic Generation**: NestJS Swagger automatically generates correct schemas from decorators, eliminating the need for manual OpenAPI transformation files

## Migration Notes

When refactoring existing code:
1. Remove module prefixes from class names
2. Keep module prefixes in `@ApiSchema` decorators
3. Add `Data` prefix to data model `@ApiSchema` names to avoid conflicts with DTOs
4. Update all imports to use new class names
5. Remove any OpenAPI transformation files that create schema aliases (NestJS generates them automatically)

## Related Documentation

- [Swagger Usage Guide](../SWAGGER_USAGE.md) - General Swagger/OpenAPI usage in the backend
- [OpenAPI Specification Generation](../../src/scripts/generate-openapi-spec.ts) - Script for generating OpenAPI specs

