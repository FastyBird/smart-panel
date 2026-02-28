import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { PluginConfigModel } from '../../../modules/config/models/config.model';
import { BUDDY_OLLAMA_DEFAULT_URL, BUDDY_OLLAMA_PLUGIN_NAME } from '../buddy-ollama.constants';

@ApiSchema({ name: 'BuddyOllamaPluginDataConfig' })
export class BuddyOllamaConfigModel extends PluginConfigModel {
	@ApiProperty({
		description: 'Plugin type identifier',
		example: BUDDY_OLLAMA_PLUGIN_NAME,
	})
	@Expose()
	@IsString()
	type: string = BUDDY_OLLAMA_PLUGIN_NAME;

	@ApiProperty({
		description: 'Whether the plugin is enabled',
		example: true,
	})
	@Expose()
	@IsBoolean()
	enabled: boolean = false;

	@ApiPropertyOptional({
		description: 'Model name to use (e.g. llama3, mistral, codellama)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;

	@ApiPropertyOptional({
		name: 'base_url',
		description: 'Base URL for the Ollama API endpoint',
		type: 'string',
		example: BUDDY_OLLAMA_DEFAULT_URL,
		nullable: true,
	})
	@Expose({ name: 'base_url' })
	@Transform(({ obj }: { obj: { base_url?: string | null; baseUrl?: string | null } }) => obj.base_url ?? obj.baseUrl, {
		toClassOnly: true,
	})
	@IsOptional()
	@IsString()
	baseUrl: string | null = null;
}
