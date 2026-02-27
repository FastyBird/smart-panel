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
		name: 'llm_provider',
		description: 'LLM provider to use for AI conversations',
		enum: LlmProvider,
		example: LlmProvider.NONE,
	})
	@Expose({ name: 'llm_provider' })
	@IsOptional()
	@IsEnum(LlmProvider)
	llmProvider: LlmProvider = LlmProvider.NONE;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'API key for the selected LLM provider (masked)',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString()
	apiKey: string | null = null;

	@ApiPropertyOptional({
		name: 'llm_model',
		description: 'Specific model name to use with the LLM provider',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'llm_model' })
	@IsOptional()
	@IsString()
	llmModel: string | null = null;

	@ApiPropertyOptional({
		name: 'ollama_url',
		description: 'Base URL for Ollama API (when using Ollama provider)',
		type: 'string',
		nullable: true,
		example: null,
	})
	@Expose({ name: 'ollama_url' })
	@IsOptional()
	@IsString()
	ollamaUrl: string | null = null;
}
