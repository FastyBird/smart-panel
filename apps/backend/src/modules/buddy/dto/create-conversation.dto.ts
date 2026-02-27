import { Expose, Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'BuddyModuleCreateConversation' })
export class CreateConversationDto {
	@ApiPropertyOptional({
		description: 'Conversation title',
		type: 'string',
		nullable: true,
		example: 'Living room questions',
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"title","reason":"Title must be a valid string."}]' })
	title?: string | null;

	@ApiPropertyOptional({
		name: 'space_id',
		description: 'Space ID to scope the conversation context',
		type: 'string',
		format: 'uuid',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'space_id' })
	@IsOptional()
	@IsUUID('4', { message: '[{"field":"space_id","reason":"Space ID must be a valid UUID."}]' })
	spaceId?: string | null;
}

@ApiSchema({ name: 'BuddyModuleReqCreateConversation' })
export class ReqCreateConversationDto {
	@ApiProperty({ description: 'Conversation data', type: () => CreateConversationDto })
	@Expose()
	@ValidateNested()
	@Type(() => CreateConversationDto)
	data: CreateConversationDto;
}
