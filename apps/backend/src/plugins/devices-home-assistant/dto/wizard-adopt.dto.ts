import { Expose, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDefined, IsObject, IsString, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'DevicesHomeAssistantPluginReqWizardAdopt' })
export class HomeAssistantWizardAdoptDto {
	@ApiProperty({
		description: 'Candidate keys selected from the wizard session',
		type: [String],
		example: ['device:abcd1234', 'helper:input_boolean.guest_mode'],
	})
	@Expose()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	keys: string[];
}

@ApiSchema({ name: 'DevicesHomeAssistantPluginReqWizardAdoptWrap' })
export class ReqHomeAssistantWizardAdoptDto {
	@ApiProperty({ description: 'Wizard adoption payload', type: () => HomeAssistantWizardAdoptDto })
	@Expose()
	@IsDefined()
	@IsObject()
	@ValidateNested()
	@Type(() => HomeAssistantWizardAdoptDto)
	data: HomeAssistantWizardAdoptDto;
}
