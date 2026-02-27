import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { BuddyMessageEntity } from '../entities/buddy-message.entity';

@ApiSchema({ name: 'BuddyModuleResMessage' })
export class MessageResponseModel extends BaseSuccessResponseModel<BuddyMessageEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BuddyMessageEntity,
	})
	@Expose()
	declare data: BuddyMessageEntity;
}

@ApiSchema({ name: 'BuddyModuleResMessages' })
export class MessagesResponseModel extends BaseSuccessResponseModel<BuddyMessageEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(BuddyMessageEntity) },
	})
	@Expose()
	declare data: BuddyMessageEntity[];
}
