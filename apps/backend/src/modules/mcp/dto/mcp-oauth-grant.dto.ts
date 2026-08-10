import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsDefined, IsEnum, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { McpOAuthScope } from '../mcp.constants';

@ApiSchema({ name: 'McpModuleUpdateOAuthGrant' })
export class UpdateMcpOAuthGrantDto {
	@ApiProperty({
		name: 'approved_scopes',
		description:
			'Replacement subset of the scopes already approved for this grant; offline_access must be preserved and removed by revocation',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpOAuthScope) },
	})
	@Expose({ name: 'approved_scopes' })
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsEnum(McpOAuthScope, { each: true })
	approvedScopes: McpOAuthScope[];
}

@ApiSchema({ name: 'McpModuleReqUpdateOAuthGrant' })
export class ReqUpdateMcpOAuthGrantDto {
	@ApiProperty({ type: () => UpdateMcpOAuthGrantDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => UpdateMcpOAuthGrantDto)
	data: UpdateMcpOAuthGrantDto;
}
