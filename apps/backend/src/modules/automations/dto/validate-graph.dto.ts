import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AutomationGraphDto } from './automation-graph.dto';

@ApiSchema({ name: 'AutomationsModuleValidateGraph' })
export class ValidateAutomationGraphDto {
	@ApiProperty({ description: 'The graph to validate', type: () => AutomationGraphDto })
	@Expose()
	@IsObject({ message: '[{"field":"graph","reason":"Graph must be an object."}]' })
	@ValidateNested()
	@Type(() => AutomationGraphDto)
	graph: AutomationGraphDto;

	@ApiPropertyOptional({
		description:
			'Whether the automation the graph belongs to would be enabled. An enabled automation needs a complete graph: at least one trigger and a valid configuration on every node. Defaults to false.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { enabled?: unknown } }) => (obj.enabled === null ? undefined : obj.enabled), {
		toClassOnly: true,
	})
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled?: boolean;
}

@ApiSchema({ name: 'AutomationsModuleReqValidateGraph' })
export class ReqValidateAutomationGraphDto {
	@ApiProperty({ description: 'Graph validation data', type: () => ValidateAutomationGraphDto })
	@Expose()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => ValidateAutomationGraphDto)
	data: ValidateAutomationGraphDto;
}
