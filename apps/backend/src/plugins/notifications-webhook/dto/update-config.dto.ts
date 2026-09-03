import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { readSubmittedValue } from '../../../common/utils/transform.utils';
import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_NAME } from '../notifications-webhook.constants';
import { IsValidHeaderRecord } from '../validators/webhook-headers-shape.validator';
import { IsValidWebhookUrl, MAX_WEBHOOK_URL_LENGTH } from '../validators/webhook-url.validator';

@ApiSchema({ name: 'NotificationsWebhookPluginUpdateConfig' })
export class UpdateNotificationsWebhookConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof NOTIFICATIONS_WEBHOOK_PLUGIN_NAME;

	@ApiPropertyOptional({
		description: 'Enable or disable the plugin',
		type: 'boolean',
		example: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsBoolean({ message: '[{"field":"enabled","reason":"Enabled must be a boolean."}]' })
	enabled?: boolean;

	@ApiPropertyOptional({
		description: 'Replacement webhook URL. Omit to preserve the stored URL or send null to clear it.',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@Transform(({ obj }) => readSubmittedValue<string>(obj, 'url', 'url'), { toClassOnly: true })
	@IsOptional()
	@IsValidWebhookUrl({
		message: `[{"field":"url","reason":"URL must be at most ${MAX_WEBHOOK_URL_LENGTH} characters and use HTTP or HTTPS without embedded credentials."}]`,
	})
	url?: string | null;

	@ApiPropertyOptional({
		description:
			'Replacement custom headers. Omit to preserve what is stored or send null to clear it. Requires an HTTPS URL.',
		type: 'object',
		additionalProperties: { type: 'string' },
		nullable: true,
	})
	@Expose()
	@Transform(({ obj }) => readSubmittedValue<Record<string, string>>(obj, 'headers', 'headers'), { toClassOnly: true })
	@IsOptional()
	@IsValidHeaderRecord({
		message:
			'[{"field":"headers","reason":"Headers must be an object whose keys are valid HTTP header names and whose values are strings."}]',
	})
	headers?: Record<string, string> | null;

	@ApiPropertyOptional({
		description: 'Minimum severity this channel forwards',
		name: 'min_severity',
		enum: NotificationSeverity,
		example: NotificationSeverity.WARNING,
	})
	@Expose({ name: 'min_severity' })
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsEnum(NotificationSeverity, {
		message: '[{"field":"min_severity","reason":"Minimum severity must be a valid severity level."}]',
	})
	minSeverity?: NotificationSeverity;
}
