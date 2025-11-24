# Swagger API Documentation Usage Guide

This guide explains how to use Swagger decorators to document your API endpoints in the FastyBird Smart Panel backend.

## Access the Documentation

Once the application is running, you can access the Swagger UI at:
- **URL**: `http://localhost:3000/api/docs`
- The documentation is interactive and allows you to test endpoints directly from the browser

## Generate OpenAPI Specification

To generate the OpenAPI JSON file for use across applications (frontend, testing, client generation, etc.):

```bash
pnpm run generate:openapi
```

This will:
- Generate the OpenAPI 3.0 specification based on your current API
- Output the file to: `spec/api/v1/openapi.json` (at monorepo root)
- Include all endpoints, schemas, tags, and authentication configurations
- Can be used for:
  - API client generation (TypeScript, JavaScript, etc.)
  - Frontend type generation
  - API documentation hosting
  - Contract testing
  - Import into tools like Postman, Insomnia, etc.

**Note**: Run this command whenever you make significant API changes to keep the spec in sync.

## Basic Controller Documentation

### 1. Add Controller-Level Tags

Use `@ApiTags()` to group related endpoints together:

```typescript
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('devices')  // Groups all endpoints under "devices" tag
@Controller('devices')
export class DevicesController {
  // ... your endpoints
}
```

### 2. Document Individual Endpoints

Use various decorators to document each endpoint:

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {

  @Get()
  @ApiOperation({
    summary: 'Get all devices',
    description: 'Retrieves a list of all registered devices in the system'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved devices',
    type: [DeviceDto]  // Array of DeviceDto
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  async findAll() {
    // ... implementation
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Device unique identifier'
  })
  @ApiResponse({
    status: 200,
    description: 'Device found',
    type: DeviceDto
  })
  @ApiResponse({
    status: 404,
    description: 'Device not found'
  })
  async findOne(@Param('id') id: string) {
    // ... implementation
  }

  @Post()
  @ApiOperation({ summary: 'Create new device' })
  @ApiBody({
    type: CreateDeviceDto,
    description: 'Device creation payload'
  })
  @ApiResponse({
    status: 201,
    description: 'Device successfully created',
    type: DeviceDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data'
  })
  async create(@Body() createDeviceDto: CreateDeviceDto) {
    // ... implementation
  }
}
```

## DTO Documentation

Document your DTOs to show the expected request/response structure:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({
    description: 'Device identifier',
    example: 'shelly1pm-ABC123',
    minLength: 3,
    maxLength: 50
  })
  @IsString()
  identifier!: string;

  @ApiPropertyOptional({
    description: 'Device display name',
    example: 'Living Room Switch'
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Device category',
    enum: ['sensor', 'actuator', 'switch'],
    example: 'switch'
  })
  @IsEnum(['sensor', 'actuator', 'switch'])
  category!: string;

  @ApiPropertyOptional({
    description: 'Device enabled state',
    default: true
  })
  @IsOptional()
  enabled?: boolean;
}

export class DeviceDto {
  @ApiProperty({ description: 'Device unique ID' })
  id!: string;

  @ApiProperty({ description: 'Device identifier' })
  identifier!: string;

  @ApiProperty({ description: 'Device display name' })
  name!: string;

  @ApiProperty({
    description: 'Device category',
    enum: ['sensor', 'actuator', 'switch']
  })
  category!: string;

  @ApiProperty({ description: 'Device enabled state' })
  enabled!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
```

## Using Custom Decorators

We've created custom decorators for common response patterns:

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiSuccessResponse, ApiPaginatedResponse } from '../common/decorators/api-documentation.decorator';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {

  @Get()
  @ApiOperation({ summary: 'Get all devices' })
  @ApiPaginatedResponse(DeviceDto, 'Paginated list of devices')
  async findAll() {
    return {
      state: 'success',
      data: {
        items: [...],
        total: 100,
        page: 1,
        pageSize: 20
      }
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiSuccessResponse(DeviceDto, 'Device details')
  async findOne(@Param('id') id: string) {
    return {
      state: 'success',
      data: { ... }
    };
  }
}
```

## Authentication

If you're using Bearer token authentication:

```typescript
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()  // Applies to all endpoints in the controller
@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  // ... endpoints
}
```

Or apply it to specific endpoints:

```typescript
@Get(':id')
@ApiBearerAuth()
@ApiOperation({ summary: 'Get device by ID' })
async findOne(@Param('id') id: string) {
  // ... implementation
}
```

## Query Parameters

Document query parameters for filtering, pagination, etc.:

```typescript
import { ApiQuery } from '@nestjs/swagger';

@Get()
@ApiOperation({ summary: 'Search devices' })
@ApiQuery({
  name: 'search',
  required: false,
  type: String,
  description: 'Search term for device name or identifier'
})
@ApiQuery({
  name: 'category',
  required: false,
  enum: ['sensor', 'actuator', 'switch'],
  description: 'Filter by device category'
})
@ApiQuery({
  name: 'page',
  required: false,
  type: Number,
  description: 'Page number',
  example: 1
})
@ApiQuery({
  name: 'pageSize',
  required: false,
  type: Number,
  description: 'Number of items per page',
  example: 20
})
async search(
  @Query('search') search?: string,
  @Query('category') category?: string,
  @Query('page') page?: number,
  @Query('pageSize') pageSize?: number,
) {
  // ... implementation
}
```

## Common Decorators Reference

| Decorator | Usage | Example |
|-----------|-------|---------|
| `@ApiTags()` | Group endpoints by tag | `@ApiTags('devices')` |
| `@ApiOperation()` | Describe the endpoint | `@ApiOperation({ summary: 'Get device' })` |
| `@ApiResponse()` | Document response | `@ApiResponse({ status: 200, type: DeviceDto })` |
| `@ApiParam()` | Document path parameter | `@ApiParam({ name: 'id', type: 'string' })` |
| `@ApiQuery()` | Document query parameter | `@ApiQuery({ name: 'search', required: false })` |
| `@ApiBody()` | Document request body | `@ApiBody({ type: CreateDeviceDto })` |
| `@ApiBearerAuth()` | Require Bearer token | `@ApiBearerAuth()` |
| `@ApiProperty()` | Document DTO property | `@ApiProperty({ description: '...' })` |
| `@ApiPropertyOptional()` | Optional DTO property | `@ApiPropertyOptional()` |

## Tips

1. **Always use DTOs**: Define explicit DTOs for requests and responses instead of returning raw entities
2. **Use examples**: Add `example` to `@ApiProperty()` for better documentation
3. **Document errors**: Always document possible error responses (400, 404, 500, etc.)
4. **Group logically**: Use `@ApiTags()` to organize endpoints into logical groups
5. **Keep it updated**: Update Swagger docs when you change API contracts

## Swagger Configuration

The Swagger configuration is in `src/main.ts`:
- Title: "FastyBird Smart Panel API"
- Version: "1.0"
- Tags: Automatically discovered from controllers using `@ApiTags()` decorator
- Tag Sorting: Alphabetical
- Authentication: Bearer token support enabled
- URL: `/api/docs`

### Adding Tags to Your Module

Each controller should define its own tag(s):

```typescript
@ApiTags('devices')  // This tag will appear in Swagger UI
@Controller('devices')
export class DevicesController {
  // ... endpoints
}
```

Tags are automatically collected from all controllers across all modules and plugins.

## Additional Resources

- [NestJS Swagger Documentation](https://docs.nestjs.com/openapi/introduction)
- [Swagger/OpenAPI Specification](https://swagger.io/specification/)
