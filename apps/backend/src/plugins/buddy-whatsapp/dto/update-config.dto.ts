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
