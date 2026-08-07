import { Expose } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsString, Validate } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import {
	MCP_DEFAULT_ALLOWED_ORIGINS,
	MCP_DEFAULT_CAPABILITIES,
	MCP_DEFAULT_ENABLED,
	MCP_MODULE_NAME,
	McpCapability,
} from '../mcp.constants';
import { IsMcpOriginConstraint } from '../validators/is-mcp-origin.validator';

@ApiSchema({ name: 'ConfigModuleDataMcp' })
export class McpConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: MCP_MODULE_NAME,
	})
	@Expose()
	@IsString()
	type: string = MCP_MODULE_NAME;

	@ApiProperty({
		description: 'Module enabled state',
		type: 'boolean',
		example: MCP_DEFAULT_ENABLED,
	})
	@Expose()
	@IsBoolean()
	override enabled: boolean = MCP_DEFAULT_ENABLED;

	@ApiProperty({
		description: 'Installation-wide ceiling for capabilities that MCP clients may receive',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpCapability) },
		example: [McpCapability.READ],
	})
	@Expose()
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpCapability, { each: true })
	capabilities: McpCapability[] = [...MCP_DEFAULT_CAPABILITIES];

	@ApiProperty({
		name: 'allowed_origins',
		description: 'Additional normalized browser origins permitted to call the MCP endpoint',
		type: 'array',
		items: { type: 'string' },
		example: ['https://panel.example.com'],
	})
	@Expose({ name: 'allowed_origins' })
	@IsArray()
	@ArrayUnique()
	@Validate(IsMcpOriginConstraint, { each: true })
	allowedOrigins: string[] = [...MCP_DEFAULT_ALLOWED_ORIGINS];
}
