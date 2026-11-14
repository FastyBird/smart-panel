import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsObject, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

/**
 * The one change a display may make to an automation. It carries no revision: switching an automation on or off
 * from the wall panel must not fail because the automation was edited in the admin since the panel read it.
 */
@ApiSchema({ name: 'AutomationsModuleSetAutomationEnabled' })
export class SetAutomationEnabledDto {
	@ApiProperty({ description: 'Whether the automation is enabled', type: 'boolean', example: true })
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { enabled?: unknown } }) => obj.enabled, { toClassOnly: true })
	@IsDefined({ message: '[{"field":"enabled","reason":"Enabled attribute is required."}]' })
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled attribute must be a valid true or false."}]' })
	enabled: boolean;
}

@ApiSchema({ name: 'AutomationsModuleReqSetAutomationEnabled' })
export class ReqSetAutomationEnabledDto {
	@ApiProperty({ description: 'The enabled state to set', type: () => SetAutomationEnabledDto })
	@Expose()
	@IsObject({ message: '[{"field":"data","reason":"Data must be an object."}]' })
	@ValidateNested()
	@Type(() => SetAutomationEnabledDto)
	data: SetAutomationEnabledDto;
}
