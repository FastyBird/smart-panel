import { Expose } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

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
		name: 'llm_provider',
		description: 'LLM provider to use for AI conversations',
		enum: LlmProvider,
		example: LlmProvider.NONE,
	})
	@Expose({ name: 'llm_provider' })
	@IsOptional()
	@IsEnum(LlmProvider, {
		message: '[{"field":"llm_provider","reason":"LLM provider must be one of: claude, openai, ollama, none."}]',
	})
	llmProvider?: LlmProvider;

	@ApiPropertyOptional({
		name: 'api_key',
		description: 'API key for the selected LLM provider',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'api_key' })
	@IsOptional()
	@IsString({ message: '[{"field":"api_key","reason":"API key must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	apiKey?: string | null;

	@ApiPropertyOptional({
		name: 'llm_model',
		description: 'Specific model name to use with the LLM provider',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'llm_model' })
	@IsOptional()
	@IsString({ message: '[{"field":"llm_model","reason":"Model must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	llmModel?: string | null;

	@ApiPropertyOptional({
		name: 'ollama_url',
		description: 'Base URL for Ollama API (when using Ollama provider)',
		type: 'string',
		nullable: true,
	})
	@Expose({ name: 'ollama_url' })
	@IsOptional()
	@IsString({ message: '[{"field":"ollama_url","reason":"Ollama URL must be a valid string."}]' })
	@ValidateIf((_, value) => value !== null)
	ollamaUrl?: string | null;
}
