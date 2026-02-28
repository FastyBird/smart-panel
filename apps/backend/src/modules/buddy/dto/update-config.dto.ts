import { Expose } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { UpdateModuleConfigDto } from '../../config/dto/config.dto';
import { BUDDY_MODULE_NAME, LlmProvider } from '../buddy.constants';

@ApiSchema({ name: 'ConfigModuleUpdateBuddy' })
export class UpdateBuddyConfigDto extends UpdateModuleConfigDto {
	override enabled = true;

	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'buddy-module',
	})
	@Expose()
	@IsString({ message: '[{"field":"type","reason":"Type must be a valid string."}]' })
	type: string = BUDDY_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'LLM provider to use for chat conversations',
		enum: LlmProvider,
		example: LlmProvider.NONE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(LlmProvider, { message: '[{"field":"provider","reason":"Provider must be a valid LLM provider."}]' })
	provider?: LlmProvider;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'API key for the selected LLM provider',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	api_key?: string | null;

	@ApiPropertyOptional({
		description: 'Model name to use with the selected LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString({ message: '[{"field":"model","reason":"Model must be a valid string."}]' })
	model?: string | null;

	@ApiPropertyOptional({
		name: 'ollama_url',
		description: 'Base URL for the Ollama API endpoint',
		type: 'string',
		nullable: true,
		example: 'http://localhost:11434',
	})
	@Expose({ name: 'ollama_url' })
	@IsOptional()
	@IsString({ message: '[{"field":"ollama_url","reason":"Ollama URL must be a valid string."}]' })
	ollama_url?: string | null;

	@ApiPropertyOptional({
		name: 'heartbeat_interval_ms',
		description: 'Heartbeat evaluation interval in milliseconds (minimum 60000)',
		type: 'integer',
		example: 300000,
	})
	@Expose({ name: 'heartbeat_interval_ms' })
	@IsOptional()
	@IsInt({ message: '[{"field":"heartbeat_interval_ms","reason":"Heartbeat interval must be a valid integer."}]' })
	@Min(60_000, { message: '[{"field":"heartbeat_interval_ms","reason":"Heartbeat interval must be at least 60s."}]' })
	heartbeat_interval_ms?: number;
}
