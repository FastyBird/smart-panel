import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_OPENAI_PLUGIN_NAME } from '../buddy-openai.constants';

@ApiSchema({ name: 'BuddyOpenaiPluginDataConfig' })
export class BuddyOpenaiConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_OPENAI_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_OPENAI_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'OpenAI API key',
		name: 'api_key',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@Transform(({ obj }: { obj: { api_key?: string | null; apiKey?: string | null } }) => obj.api_key ?? obj.apiKey, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiPropertyOptional({
		description: 'Model name to use (e.g. gpt-4o, gpt-4o-mini)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;
}
