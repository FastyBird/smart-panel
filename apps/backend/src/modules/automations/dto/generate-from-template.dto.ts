import { Expose, Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'AutomationsModuleGenerateFromTemplate' })
export class GenerateAutomationFromTemplateDto {
	@ApiProperty({
		description:
			'The answers to the questions of the template, by parameter id: `{ device_id, channel_id, property_id }` for a `property` question, a whole number of seconds for `duration`, a number for `number` and a text for `text`. A question with a default may be left out.',
		type: 'object',
		additionalProperties: true,
		example: {
			motion: {
				device_id: '550e8400-e29b-41d4-a716-446655440000',
				channel_id: '550e8400-e29b-41d4-a716-446655440001',
				property_id: '550e8400-e29b-41d4-a716-446655440002',
			},
			off_after: 120,
		},
	})
	@Expose()
	@IsObject({ message: '[{"field":"parameters","reason":"Parameters must be an object."}]' })
	parameters: Record<string, unknown>;
}

@ApiSchema({ name: 'AutomationsModuleReqGenerateFromTemplate' })
export class ReqGenerateAutomationFromTemplateDto {
	@ApiProperty({
		description: 'The answers to the questions of the template',
		type: () => GenerateAutomationFromTemplateDto,
	})
	@Expose()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => GenerateAutomationFromTemplateDto)
	data: GenerateAutomationFromTemplateDto;
}
