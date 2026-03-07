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
