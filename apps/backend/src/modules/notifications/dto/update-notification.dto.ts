import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'NotificationsModuleUpdateNotification' })
export class UpdateNotificationDto {
	@ApiPropertyOptional({
		description: 'Marks the notification read or unread.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"read","reason":"Read must be a valid true or false."}]' })
	read?: boolean;

	@ApiPropertyOptional({
		description: 'Marks the notification dismissed or restores it.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@IsOptional()
	@IsBoolean({ message: '[{"field":"dismissed","reason":"Dismissed must be a valid true or false."}]' })
	dismissed?: boolean;
}

@ApiSchema({ name: 'NotificationsModuleReqUpdateNotification' })
export class ReqUpdateNotificationDto {
	@ApiProperty({ description: 'Notification update data', type: () => UpdateNotificationDto })
	@Expose()
	@ValidateNested()
	@Type(() => UpdateNotificationDto)
	data: UpdateNotificationDto;
}
