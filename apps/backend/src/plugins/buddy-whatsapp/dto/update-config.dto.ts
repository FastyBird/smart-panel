import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_WHATSAPP_PLUGIN_NAME } from '../buddy-whatsapp.constants';

@ApiSchema({ name: 'BuddyWhatsappPluginUpdateConfig' })
export class UpdateBuddyWhatsappConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_WHATSAPP_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_WHATSAPP_PLUGIN_NAME;

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
	@IsString({ message: '[{"field":"phone_number_id","reason":"Phone number ID must be a string."}]' })
	phoneNumberId?: string | null;

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
	@Transform(({ value }): string | undefined => (value === '***' ? undefined : (value as string | undefined)), {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString({ message: '[{"field":"access_token","reason":"Access token must be a string."}]' })
	accessToken?: string | null;

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
	@Transform(({ value }): string | undefined => (value === '***' ? undefined : (value as string | undefined)), {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString({ message: '[{"field":"webhook_verify_token","reason":"Webhook verify token must be a string."}]' })
	webhookVerifyToken?: string | null;

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
	@IsString({ message: '[{"field":"allowed_phone_numbers","reason":"Allowed phone numbers must be a string."}]' })
	allowedPhoneNumbers?: string | null;
}
