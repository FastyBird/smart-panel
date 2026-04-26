import { Expose } from 'class-transformer';
import { IsInt, IsNotEmpty, IsObject, IsString, Min } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class StatusWidgetDto {
	@ApiProperty({
		description: 'Widget type identifier',
		type: 'string',
		example: 'energy',
	})
	@Expose()
	@IsNotEmpty({ message: '[{"field":"status_widgets.type","reason":"Widget type is required."}]' })
	@IsString({ message: '[{"field":"status_widgets.type","reason":"Widget type must be a string."}]' })
	type: string;

	@ApiProperty({
		description: 'Display order',
		type: 'number',
		example: 0,
	})
	@Expose()
	@IsInt({ message: '[{"field":"status_widgets.order","reason":"Widget order must be an integer."}]' })
	@Min(0, { message: '[{"field":"status_widgets.order","reason":"Widget order must be at least 0."}]' })
	order: number;

	@ApiProperty({
		description: 'Widget-specific settings',
		type: 'object',
		additionalProperties: true,
		example: { range: 'today', show_production: true },
	})
	@Expose()
	@IsObject({ message: '[{"field":"status_widgets.settings","reason":"Widget settings must be an object."}]' })
	settings: Record<string, unknown>;
}
