import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { BuddyConversationEntity } from '../entities/buddy-conversation.entity';

@ApiSchema({ name: 'BuddyModuleResConversation' })
export class ConversationResponseModel extends BaseSuccessResponseModel<BuddyConversationEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BuddyConversationEntity,
	})
	@Expose()
	declare data: BuddyConversationEntity;
}

@ApiSchema({ name: 'BuddyModuleResConversations' })
export class ConversationsResponseModel extends BaseSuccessResponseModel<BuddyConversationEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(BuddyConversationEntity) },
	})
	@Expose()
	declare data: BuddyConversationEntity[];
}
