import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { ModuleConfigModel } from '../../config/models/config.model';
import { BUDDY_MODULE_NAME, LlmProvider } from '../buddy.constants';

@ApiSchema({ name: 'ConfigModuleDataBuddy' })
export class BuddyConfigModel extends ModuleConfigModel {
	@ApiProperty({
		description: 'Module identifier',
		type: 'string',
		example: 'buddy-module',
	})
	@Expose()
	@IsString()
	type: string = BUDDY_MODULE_NAME;

	@ApiPropertyOptional({
		description: 'LLM provider to use for chat conversations',
		enum: LlmProvider,
		example: LlmProvider.NONE,
	})
	@Expose()
	@IsOptional()
	@IsEnum(LlmProvider)
	provider: LlmProvider = LlmProvider.NONE;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'API key for the selected LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiPropertyOptional({
		description: 'Model name to use with the selected LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose()
	@IsOptional()
	@IsString()
	model: string | null = null;

	@ApiPropertyOptional({
		name: 'ollama_url',
		description: 'Base URL for the Ollama API endpoint',
		type: 'string',
		nullable: true,
		example: 'http://localhost:11434',
	})
	@Expose({ name: 'ollama_url' })
	@IsOptional()
	@IsString()
	ollamaUrl: string | null = null;
}
