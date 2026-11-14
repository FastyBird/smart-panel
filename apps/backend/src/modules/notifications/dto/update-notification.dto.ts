import { Expose, Transform, Type } from 'class-transformer';
import { IsBoolean, IsDefined, IsOptional, ValidateNested } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

@ApiSchema({ name: 'NotificationsModuleUpdateNotification' })
export class UpdateNotificationDto {
	@ApiPropertyOptional({
		description: 'Marks the notification read or unread.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { read?: unknown } }) => obj.read, { toClassOnly: true })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"read","reason":"Read must be a valid true or false."}]' })
	read?: boolean;

	@ApiPropertyOptional({
		description: 'Marks the notification dismissed or restores it.',
		type: 'boolean',
		example: true,
	})
	@Expose()
	// The raw JSON value: implicit conversion would turn the string "false" into true before it is validated
	@Transform(({ obj }: { obj: { dismissed?: unknown } }) => obj.dismissed, { toClassOnly: true })
	@IsOptional()
	@IsBoolean({ message: '[{"field":"dismissed","reason":"Dismissed must be a valid true or false."}]' })
	dismissed?: boolean;
}

@ApiSchema({ name: 'NotificationsModuleReqUpdateNotification' })
export class ReqUpdateNotificationDto {
	@ApiProperty({ description: 'Notification update data', type: () => UpdateNotificationDto })
	@Expose()
	@IsDefined({ message: '[{"field":"data","reason":"Notification update data is required."}]' })
	@ValidateNested()
	@Type(() => UpdateNotificationDto)
	data: UpdateNotificationDto;
}
