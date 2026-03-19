import { Expose, Type } from 'class-transformer';
import { IsDefined, IsObject, IsOptional, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'ExtensionsModuleExecuteActionData' })
export class ExecuteActionDataDto {
	@ApiPropertyOptional({
		description: 'Action parameters as key-value pairs',
		type: 'object',
		additionalProperties: true,
		example: { scenario: 'smart-house', truncate: false },
	})
	@Expose()
	@IsObject()
	@IsOptional()
	params?: Record<string, unknown>;
}

@ApiSchema({ name: 'ExtensionsModuleReqExecuteAction' })
export class ReqExecuteActionDto {
	@ApiProperty({
		description: 'Action execution data',
		type: () => ExecuteActionDataDto,
	})
	@Expose()
	@IsDefined()
	@IsObject()
	@ValidateNested()
	@Type(() => ExecuteActionDataDto)
	data: ExecuteActionDataDto;
}
