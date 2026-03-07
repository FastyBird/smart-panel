import { Expose, Type } from 'class-transformer';
import { IsDefined, IsString, MaxLength, ValidateNested } from 'class-validator';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { BUDDY_PERSONALITY_MAX_LENGTH } from '../buddy.constants';

@ApiSchema({ name: 'BuddyModuleUpdatePersonality' })
export class UpdatePersonalityDto {
	@ApiProperty({
		description: 'Personality text content that defines the buddy tone and style',
		type: 'string',
		example: 'You are a helpful smart home assistant. Be concise, friendly, and practical.',
	})
	@Expose()
	@IsString({ message: '[{"field":"content","reason":"Content must be a valid string."}]' })
	@MaxLength(BUDDY_PERSONALITY_MAX_LENGTH, {
		message: `[{"field":"content","reason":"Content must not exceed ${BUDDY_PERSONALITY_MAX_LENGTH} characters."}]`,
	})
	content: string;
}

@ApiSchema({ name: 'BuddyModuleReqUpdatePersonality' })
export class ReqUpdatePersonalityDto {
	@ApiProperty({ description: 'Personality update data', type: () => UpdatePersonalityDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Data wrapper is required."}]' })
	@ValidateNested()
	@Type(() => UpdatePersonalityDto)
	data: UpdatePersonalityDto;
}
