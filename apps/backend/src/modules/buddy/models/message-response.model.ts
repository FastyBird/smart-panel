import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema } from '@nestjs/swagger';

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
