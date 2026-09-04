import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { readSubmittedValue } from '../../../common/utils/transform.utils';
import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { NotificationSeverity } from '../../../modules/notifications/notifications.constants';
import { NOTIFICATIONS_SLACK_PLUGIN_NAME } from '../notifications-slack.constants';
import { IsValidSlackWebhookUrl, MAX_SLACK_WEBHOOK_URL_LENGTH } from '../validators/slack-webhook-url.validator';

@ApiSchema({ name: 'NotificationsSlackPluginUpdateConfig' })
export class UpdateNotificationsSlackConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: NOTIFICATIONS_SLACK_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof NOTIFICATIONS_SLACK_PLUGIN_NAME;

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
		description: 'Replacement Slack webhook URL. Omit to preserve the stored URL or send null to clear it.',
		name: 'webhook_url',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'webhook_url' })
	@Transform(({ obj }) => readSubmittedValue<string>(obj, 'webhook_url', 'webhookUrl'), { toClassOnly: true })
	@IsOptional()
	@IsValidSlackWebhookUrl({
		message: `[{"field":"webhook_url","reason":"Webhook URL must start with https:// and be at most ${MAX_SLACK_WEBHOOK_URL_LENGTH} characters without embedded credentials."}]`,
	})
	webhookUrl?: string | null;

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
