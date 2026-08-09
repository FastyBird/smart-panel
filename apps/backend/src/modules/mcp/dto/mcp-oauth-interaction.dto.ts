import { Expose, Transform, Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsDefined, IsEnum, IsInt, Max, Min, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { McpOAuthScope } from '../mcp.constants';

@ApiSchema({ name: 'McpModuleApproveOAuthInteraction' })
export class ApproveMcpOAuthInteractionDto {
	@ApiProperty({
		description: 'Approved subset of the requested scopes',
		type: 'array',
		items: { type: 'string', enum: Object.values(McpOAuthScope) },
	})
	@Expose()
	@IsArray()
	@ArrayUnique()
	@IsEnum(McpOAuthScope, { each: true })
	scopes: McpOAuthScope[];

	@ApiProperty({
		name: 'expires_in_days',
		description: 'Finite grant lifetime in days',
		type: 'integer',
		minimum: 1,
		maximum: 90,
		default: 90,
	})
	@Expose({ name: 'expires_in_days' })
	@Transform(
		({ obj }: { obj: { expires_in_days?: number; expiresInDays?: number } }) =>
			obj.expires_in_days ?? obj.expiresInDays ?? 90,
	)
	@IsInt()
	@Min(1)
	@Max(90)
	expiresInDays: number = 90;
}

@ApiSchema({ name: 'McpModuleReqApproveOAuthInteraction' })
export class ReqApproveMcpOAuthInteractionDto {
	@ApiProperty({ type: () => ApproveMcpOAuthInteractionDto })
	@Expose()
	@IsDefined()
	@ValidateNested()
	@Type(() => ApproveMcpOAuthInteractionDto)
	data: ApproveMcpOAuthInteractionDto;
}
