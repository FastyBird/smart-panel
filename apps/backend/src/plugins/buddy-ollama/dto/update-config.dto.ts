import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdatePluginConfigDto } from '../../../modules/config/dto/config.dto';
import { BUDDY_OLLAMA_DEFAULT_URL, BUDDY_OLLAMA_PLUGIN_NAME } from '../buddy-ollama.constants';

@ApiSchema({ name: 'BuddyOllamaPluginUpdateConfig' })
export class UpdateBuddyOllamaConfigDto extends UpdatePluginConfigDto {
	@ApiProperty({
		description: 'Plugin type',
		type: 'string',
		example: BUDDY_OLLAMA_PLUGIN_NAME,
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: typeof BUDDY_OLLAMA_PLUGIN_NAME;

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
		description: 'Model name to use (e.g. llama3, mistral, codellama)',
		type: 'string',
		nullable: true,
	})
	@Expose()
	@Transform(({ value }: { value: unknown }) => (value === null ? undefined : value))
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Model must be a string."}]' })
	model?: string | null;

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
	@IsString({ message: '[{"field":"base_url","reason":"Base URL must be a string."}]' })
	baseUrl?: string | null;
}
