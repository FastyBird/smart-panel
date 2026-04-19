import { Expose } from 'class-transformer';

import { ApiProperty, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../../modules/api/models/api-response.model';
import { SignageAnnouncementEntity } from '../entities/signage-announcement.entity';

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginResAnnouncement' })
export class SignageAnnouncementResponseModel extends BaseSuccessResponseModel<SignageAnnouncementEntity> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => SignageAnnouncementEntity,
	})
	@Expose()
	declare data: SignageAnnouncementEntity;
}

@ApiSchema({ name: 'SpacesSignageInfoPanelPluginResAnnouncements' })
export class SignageAnnouncementsResponseModel extends BaseSuccessResponseModel<SignageAnnouncementEntity[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(SignageAnnouncementEntity) },
	})
	@Expose()
	declare data: SignageAnnouncementEntity[];
}
