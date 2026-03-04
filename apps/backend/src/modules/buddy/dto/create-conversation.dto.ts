import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'BuddyModuleCreateConversation' })
export class CreateConversationDto {
	@ApiPropertyOptional({
		description: 'Optional title for the conversation',
		type: 'string',
		example: 'Living room setup',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"title","reason":"Title must be a valid string."}]' })
	title?: string | null;

	@ApiPropertyOptional({
		name: 'space_id',
		description: 'Optional space ID to scope the conversation context',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID (version 4)."}]' })
	spaceId?: string | null;
}

@ApiSchema({ name: 'BuddyModuleReqCreateConversation' })
export class ReqCreateConversationDto {
	@ApiPropertyOptional({ description: 'Conversation data', type: () => CreateConversationDto })
	@Expose()
	@IsOptional()
	@ValidateNested()
	@Type(() => CreateConversationDto)
	data?: CreateConversationDto;
}
