import { Expose, Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { AUTOMATION_GRAPH_ID_MAX_LENGTH } from '../automations.constants';

@ApiSchema({ name: 'AutomationsModuleTriggerAutomation' })
export class TriggerAutomationDto {
	@ApiPropertyOptional({
		name: 'node_id',
		description:
			'Identifier of the trigger node the run starts at. Defaults to the first trigger of the graph. A run can start only at a trigger node.',
		type: 'string',
		maxLength: AUTOMATION_GRAPH_ID_MAX_LENGTH,
		example: 'n1',
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"node_id","reason":"Node ID must be a string."}]' })
	@IsNotEmpty({ message: '[{"field":"node_id","reason":"Node ID must not be empty."}]' })
	@MaxLength(AUTOMATION_GRAPH_ID_MAX_LENGTH, {
		message: `[{"field":"node_id","reason":"Node ID must be at most ${AUTOMATION_GRAPH_ID_MAX_LENGTH} characters long."}]`,
	})
	node_id?: string;
}

@ApiSchema({ name: 'AutomationsModuleReqTriggerAutomation' })
export class ReqTriggerAutomationDto {
	@ApiPropertyOptional({ description: 'Manual run options', type: () => TriggerAutomationDto })
	@Expose()
	@IsOptional()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => TriggerAutomationDto)
	data?: TriggerAutomationDto;
}
