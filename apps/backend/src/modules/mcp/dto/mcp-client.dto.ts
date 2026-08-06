import { Expose, Transform, Type } from 'class-transformer';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { MCP_DEFAULT_TOKEN_EXPIRATION_DAYS, MCP_MAX_TOKEN_EXPIRATION_DAYS, McpCapability } from '../mcp.constants';

export class CreateMcpClientDto {
	@ApiProperty({ description: 'Human-readable client name', type: 'string', example: 'Home assistant agent' })
	@Expose()
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	name: string;

	@ApiPropertyOptional({ description: 'Optional client description', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiProperty({
		description: 'Capability subset granted to this client',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpCapability) },
		example: [McpCapability.READ],
	})
	@Expose()
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpCapability, { each: true })
	capabilities: McpCapability[];

	@ApiPropertyOptional({
		name: 'expires_in_days',
		description: 'Finite credential lifetime in days',
		type: 'integer',
		minimum: 1,
		maximum: MCP_MAX_TOKEN_EXPIRATION_DAYS,
		default: MCP_DEFAULT_TOKEN_EXPIRATION_DAYS,
	})
	@Expose({ name: 'expires_in_days' })
	@Transform(
		({ obj }: { obj: { expires_in_days?: number; expiresInDays?: number } }) =>
			obj.expires_in_days ?? obj.expiresInDays ?? MCP_DEFAULT_TOKEN_EXPIRATION_DAYS,
	)
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(MCP_MAX_TOKEN_EXPIRATION_DAYS)
	expiresInDays: number = MCP_DEFAULT_TOKEN_EXPIRATION_DAYS;
}

export class UpdateMcpClientDto {
	@ApiPropertyOptional({ description: 'Human-readable client name', type: 'string' })
	@Expose()
	@IsOptional()
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	name?: string;

	@ApiPropertyOptional({ description: 'Optional client description', type: 'string', nullable: true })
	@Expose()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@ValidateIf((_, value) => value !== null)
	description?: string | null;

	@ApiPropertyOptional({ description: 'Whether the client may authenticate', type: 'boolean' })
	@Expose()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Capability subset granted to this client',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpCapability) },
	})
	@Expose()
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpCapability, { each: true })
	capabilities?: McpCapability[];
}

export class RotateMcpClientTokenDto {
	@ApiPropertyOptional({
		name: 'expires_in_days',
		description: 'Finite lifetime of the replacement credential in days',
		type: 'integer',
		minimum: 1,
		maximum: MCP_MAX_TOKEN_EXPIRATION_DAYS,
		default: MCP_DEFAULT_TOKEN_EXPIRATION_DAYS,
	})
	@Expose({ name: 'expires_in_days' })
	@Transform(
		({ obj }: { obj: { expires_in_days?: number; expiresInDays?: number } }) =>
			obj.expires_in_days ?? obj.expiresInDays ?? MCP_DEFAULT_TOKEN_EXPIRATION_DAYS,
	)
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(MCP_MAX_TOKEN_EXPIRATION_DAYS)
	expiresInDays: number = MCP_DEFAULT_TOKEN_EXPIRATION_DAYS;
}

@ApiSchema({ name: 'McpModuleReqCreateClient' })
export class ReqCreateMcpClientDto {
	@ApiProperty({ type: () => CreateMcpClientDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateMcpClientDto)
	data: CreateMcpClientDto;
}

@ApiSchema({ name: 'McpModuleReqUpdateClient' })
export class ReqUpdateMcpClientDto {
	@ApiProperty({ type: () => UpdateMcpClientDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateMcpClientDto)
	data: UpdateMcpClientDto;
}

@ApiSchema({ name: 'McpModuleReqRotateClientToken' })
export class ReqRotateMcpClientTokenDto {
	@ApiProperty({ type: () => RotateMcpClientTokenDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => RotateMcpClientTokenDto)
	data: RotateMcpClientTokenDto;
}
