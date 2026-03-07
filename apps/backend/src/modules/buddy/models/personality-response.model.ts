import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';

@ApiSchema({ name: 'BuddyModuleDataPersonality' })
export class PersonalityDataModel {
	@ApiProperty({
		description: 'Current personality text content',
		type: 'string',
		example: 'You are a helpful smart home assistant. Be concise, friendly, and practical.',
	})
	@Expose()
	content: string;
}

@ApiSchema({ name: 'BuddyModuleResGetPersonality' })
export class PersonalityResponseModel extends BaseSuccessResponseModel<PersonalityDataModel> {
	@ApiProperty({
		description: 'Personality data',
		type: () => PersonalityDataModel,
	})
	@Expose()
	@Type(() => PersonalityDataModel)
	declare data: PersonalityDataModel;
}
