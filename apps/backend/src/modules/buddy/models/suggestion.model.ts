import { Expose } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema, getSchemaPath } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { BuddySuggestionType } from '../services/suggestion-engine.service';

@ApiSchema({ name: 'BuddyModuleDataSuggestion' })
export class BuddySuggestionModel {
	@ApiProperty({ description: 'Suggestion ID', type: 'string', format: 'uuid' })
	@Expose()
	id: string;

	@ApiProperty({ description: 'Suggestion type', enum: BuddySuggestionType })
	@Expose()
	type: BuddySuggestionType;

	@ApiProperty({ description: 'Suggestion title', type: 'string' })
	@Expose()
	title: string;

	@ApiProperty({ description: 'Reason for the suggestion', type: 'string' })
	@Expose()
	reason: string;

	@ApiPropertyOptional({
		name: 'space_id',
		description: 'Associated space ID',
		type: 'string',
		format: 'uuid',
		nullable: true,
	})
	@Expose({ name: 'space_id' })
	spaceId: string | null;

	@ApiProperty({ description: 'Additional pattern metadata', type: 'object', additionalProperties: true })
	@Expose()
	metadata: Record<string, unknown>;

	@ApiProperty({
		name: 'created_at',
		description: 'When the suggestion was created',
		type: 'string',
		format: 'date-time',
	})
	@Expose({ name: 'created_at' })
	createdAt: string;

	@ApiProperty({ name: 'expires_at', description: 'When the suggestion expires', type: 'string', format: 'date-time' })
	@Expose({ name: 'expires_at' })
	expiresAt: string;
}

@ApiSchema({ name: 'BuddyModuleResSuggestion' })
export class SuggestionResponseModel extends BaseSuccessResponseModel<BuddySuggestionModel> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: () => BuddySuggestionModel,
	})
	@Expose()
	declare data: BuddySuggestionModel;
}

@ApiSchema({ name: 'BuddyModuleResSuggestions' })
export class SuggestionsResponseModel extends BaseSuccessResponseModel<BuddySuggestionModel[]> {
	@ApiProperty({
		description: 'The actual data payload returned by the API',
		type: 'array',
		items: { $ref: getSchemaPath(BuddySuggestionModel) },
	})
	@Expose()
	declare data: BuddySuggestionModel[];
}
