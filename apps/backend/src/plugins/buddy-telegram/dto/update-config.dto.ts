import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_TELEGRAM_PLUGIN_NAME } from '../buddy-telegram.constants';

@ApiSchema({ name: 'BuddyTelegramPluginUpdateConfig' })
export class UpdateBuddyTelegramConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_TELEGRAM_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_TELEGRAM_PLUGIN_NAME;

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
		description: 'Telegram Bot API token (from @BotFather)',
		name: 'bot_token',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'bot_token' })
	@Transform(
		({ obj }: { obj: { bot_token?: string | null; botToken?: string | null } }) => obj.bot_token ?? obj.botToken,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"bot_token","reason":"Bot token must be a string."}]' })
	botToken?: string | null;

	@ApiPropertyOptional({
		description: 'Comma-separated list of Telegram user IDs allowed to interact with the bot (empty = allow all)',
		name: 'allowed_user_ids',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'allowed_user_ids' })
	@Transform(
		({ obj }: { obj: { allowed_user_ids?: string | null; allowedUserIds?: string | null } }) =>
			obj.allowed_user_ids ?? obj.allowedUserIds,
		{ toClassOnly: true },
	)
	@IsOptional()
	@IsString({ message: '[{"field":"allowed_user_ids","reason":"Allowed user IDs must be a string."}]' })
	allowedUserIds?: string | null;
}
