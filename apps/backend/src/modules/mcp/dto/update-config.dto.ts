import { Expose } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, Validate } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { IsMcpOAuthPublicBaseUrlConstraint } from '../validators/is-mcp-oauth-public-base-url.validator';
import { IsMcpOriginConstraint } from '../validators/is-mcp-origin.validator';

@ApiSchema({ name: 'ConfigModuleUpdateMcp' })
export class UpdateMcpConfigDto extends UpdateModuleConfigDto {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: MCP_MODULE_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = MCP_MODULE_NAME;

	@ApiPropertyOptional({
		name: 'oauth_enabled',
		description: 'Whether the readiness-gated MCP OAuth authorization profile is enabled',
		type: 'boolean',
		example: false,
	})
	@Expose({ name: 'oauth_enabled' })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"oauth_enabled","reason":"OAuth enabled state must be a boolean."}]' })
	oauth_enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Installation-wide ceiling for capabilities that MCP clients may receive',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpCapability) },
		example: [McpCapability.READ],
	})
	@Expose()
	@IsOptional()
	@IsArray({ message: '[{"field":"capabilities","reason":"Capabilities must be provided as an array."}]' })
	@ArrayUnique({ message: '[{"field":"capabilities","reason":"Capabilities must not contain duplicates."}]' })
	@IsEnum(McpCapability, {
		each: true,
		message: '[{"field":"capabilities","reason":"Each capability must be read, write, or trigger."}]',
	})
	capabilities?: McpCapability[];

	@ApiPropertyOptional({
		name: 'allowed_origins',
		description: 'Additional normalized browser origins permitted to call the MCP endpoint',
		type: 'array',
		items: { type: 'string' },
		example: ['https://panel.example.com'],
	})
	@Expose({ name: 'allowed_origins' })
	@IsOptional()
	@IsArray({ message: '[{"field":"allowed_origins","reason":"Allowed origins must be provided as an array."}]' })
	@ArrayUnique({ message: '[{"field":"allowed_origins","reason":"Allowed origins must not contain duplicates."}]' })
	@Validate(IsMcpOriginConstraint, {
		each: true,
		message:
			'[{"field":"allowed_origins","reason":"Each origin must be a normalized absolute HTTP(S) origin without a path, query, fragment, or credentials."}]',
	})
	allowed_origins?: string[];

	@ApiPropertyOptional({
		name: 'oauth_public_base_url',
		description: 'Explicit canonical HTTPS base URL used to derive the MCP OAuth identity',
		type: 'string',
		nullable: true,
		example: 'https://panel.example.com',
	})
	@Expose({ name: 'oauth_public_base_url' })
	@IsOptional()
	@Validate(IsMcpOAuthPublicBaseUrlConstraint, {
		message:
			'[{"field":"oauth_public_base_url","reason":"OAuth public base URL must be a normalized absolute HTTPS URL without credentials, query, fragment, or trailing slash."}]',
	})
	oauth_public_base_url?: string | null;
}
