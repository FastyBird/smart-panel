import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_WHATSAPP_PLUGIN_NAME } from '../buddy-whatsapp.constants';

@ApiSchema({ name: 'BuddyWhatsappPluginDataConfig' })
export class BuddyWhatsappConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_WHATSAPP_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_WHATSAPP_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'WhatsApp Business Phone Number ID',
		name: 'phone_number_id',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'phone_number_id' })
	@Transform(
		({ obj }: { obj: { phone_number_id?: string | null; phoneNumberId?: string | null } }) =>
			obj.phone_number_id ?? obj.phoneNumberId,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString()
	phoneNumberId: string | null = null;

	@ApiPropertyOptional({
		description: 'Meta Cloud API access token',
		name: 'access_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'access_token' })
	@Transform(
		({ obj }: { obj: { access_token?: string | null; accessToken?: string | null } }) =>
			obj.access_token ?? obj.accessToken,
		{ toClassOnly: true },
	)
	@Transform(
		({ value }): string | null => (typeof value === 'string' && value.length > 0 ? '***' : (value as string | null)),
		{ toPlainOnly: true, groups: ['api'] },
	)
	@IsOptional()
	@IsString()
	accessToken: string | null = null;

	@ApiPropertyOptional({
		description: 'Webhook verify token for WhatsApp webhook registration',
		name: 'webhook_verify_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'webhook_verify_token' })
	@Transform(
		({ obj }: { obj: { webhook_verify_token?: string | null; webhookVerifyToken?: string | null } }) =>
			obj.webhook_verify_token ?? obj.webhookVerifyToken,
		{ toClassOnly: true },
	)
	@Transform(
		({ value }): string | null => (typeof value === 'string' && value.length > 0 ? '***' : (value as string | null)),
		{ toPlainOnly: true, groups: ['api'] },
	)
	@IsOptional()
	@IsString()
	webhookVerifyToken: string | null = null;

	@ApiPropertyOptional({
		description: 'Meta App Secret for verifying webhook payload signatures (X-Hub-Signature-256)',
		name: 'app_secret',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'app_secret' })
	@Transform(
		({ obj }: { obj: { app_secret?: string | null; appSecret?: string | null } }) => obj.app_secret ?? obj.appSecret,
		{ toClassOnly: true },
	)
	@Transform(
		({ value }): string | null => (typeof value === 'string' && value.length > 0 ? '***' : (value as string | null)),
		{ toPlainOnly: true, groups: ['api'] },
	)
	@IsOptional()
	@IsString()
	appSecret: string | null = null;

	@ApiPropertyOptional({
		description:
			'Comma-separated list of phone numbers in E.164 format allowed to interact with the bot (empty = allow all)',
		name: 'allowed_phone_numbers',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'allowed_phone_numbers' })
	@Transform(
		({ obj }: { obj: { allowed_phone_numbers?: string | null; allowedPhoneNumbers?: string | null } }) =>
			obj.allowed_phone_numbers ?? obj.allowedPhoneNumbers,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString()
	allowedPhoneNumbers: string | null = null;
}
