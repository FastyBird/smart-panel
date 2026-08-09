import { Expose, Type } from 'class-transformer';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsDefined,
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Validate,
	ValidateNested,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { McpOAuthScope } from '../mcp.constants';
import { IsMcpOAuthRedirectUrisConstraint } from '../validators/is-mcp-oauth-redirect-uri.validator';

const supportedClientScopes = Object.values(McpOAuthScope);

@ApiSchema({ name: 'McpModuleCreateOAuthClient' })
export class CreateMcpOAuthClientDto {
	@ApiProperty({ description: 'Human-readable OAuth client name', example: 'Codex desktop' })
	@Expose()
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	name: string;

	@ApiProperty({
		name: 'redirect_uris',
		description: 'Exact redirect URI allowlist; only native loopback IP ports may vary at authorization time',
		type: 'array',
		items: { type: 'string', format: 'uri' },
	})
	@Expose({ name: 'redirect_uris' })
	@IsArray()
	@Validate(IsMcpOAuthRedirectUrisConstraint)
	redirectUris: string[];

	@ApiProperty({
		name: 'maximum_scopes',
		description: 'Maximum MCP capability scopes this public client may request',
		type: 'array',
		items: { type: 'string', enum: supportedClientScopes },
	})
	@Expose({ name: 'maximum_scopes' })
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpOAuthScope, { each: true })
	maximumScopes: McpOAuthScope[];
}

@ApiSchema({ name: 'McpModuleUpdateOAuthClient' })
export class UpdateMcpOAuthClientDto {
	@ApiPropertyOptional({ description: 'Human-readable OAuth client name' })
	@Expose()
	@IsOptional()
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	name?: string;

	@ApiPropertyOptional({
		name: 'redirect_uris',
		description: 'Replacement exact redirect URI allowlist',
		type: 'array',
		items: { type: 'string', format: 'uri' },
	})
	@Expose({ name: 'redirect_uris' })
	@IsOptional()
	@IsArray()
	@Validate(IsMcpOAuthRedirectUrisConstraint)
	redirectUris?: string[];

	@ApiPropertyOptional({
		name: 'maximum_scopes',
		description: 'Replacement maximum MCP capability scope set',
		type: 'array',
		items: { type: 'string', enum: supportedClientScopes },
	})
	@Expose({ name: 'maximum_scopes' })
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpOAuthScope, { each: true })
	maximumScopes?: McpOAuthScope[];

	@ApiPropertyOptional({ description: 'Whether the OAuth client may begin or continue authorization', type: 'boolean' })
	@Expose()
	@IsOptional()
	@IsBoolean()
	enabled?: boolean;
}

@ApiSchema({ name: 'McpModuleReqCreateOAuthClient' })
export class ReqCreateMcpOAuthClientDto {
	@ApiProperty({ type: () => CreateMcpOAuthClientDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => CreateMcpOAuthClientDto)
	data: CreateMcpOAuthClientDto;
}

@ApiSchema({ name: 'McpModuleReqUpdateOAuthClient' })
export class ReqUpdateMcpOAuthClientDto {
	@ApiProperty({ type: () => UpdateMcpOAuthClientDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateMcpOAuthClientDto)
	data: UpdateMcpOAuthClientDto;
}
