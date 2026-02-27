import { Expose, Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';

import { BaseSuccessResponseModel } from '../../api/models/api-response.model';
import { SuggestionType } from '../buddy.constants';

@ApiSchema({ name: 'BuddyModuleDataSuggestion' })
export class SuggestionDataModel {
	@ApiProperty({
		description: 'Unique identifier of the suggestion',
		type: 'string',
		format: 'uuid',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@Expose()
	id: string;

	@ApiProperty({
		description: 'Type of the suggestion',
		enum: SuggestionType,
		example: SuggestionType.PATTERN_SCENE_CREATE,
	})
	@Expose()
	type: SuggestionType;

	@ApiProperty({
		description: 'Short title of the suggestion',
		type: 'string',
		example: 'Create a scene for this?',
	})
	@Expose()
	title: string;

	@ApiProperty({
		description: 'Human-readable reason for the suggestion',
		type: 'string',
		example: 'You turn off lights in Living room around 11 PM regularly',
	})
	@Expose()
	reason: string;

	@ApiProperty({
		name: 'space_id',
		description: 'The space this suggestion relates to',
		type: 'string',
		format: 'uuid',
	})
	@Expose({ name: 'space_id' })
	spaceId: string;

	@ApiPropertyOptional({
		description: 'Additional metadata about the detected pattern',
		type: 'object',
		additionalProperties: true,
		example: { intentType: 'space.lighting.off', occurrences: 5, confidence: 0.71 },
	})
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

	@ApiProperty({
		name: 'expires_at',
		description: 'When the suggestion expires',
		type: 'string',
		format: 'date-time',
	})
	@Expose({ name: 'expires_at' })
	expiresAt: string;
}

@ApiSchema({ name: 'BuddyModuleResSuggestion' })
export class SuggestionResponseModel extends BaseSuccessResponseModel<SuggestionDataModel> {
	@ApiProperty({
		description: 'The suggestion data',
		type: () => SuggestionDataModel,
	})
	@Expose()
	@Type(() => SuggestionDataModel)
	declare data: SuggestionDataModel;
}

@ApiSchema({ name: 'BuddyModuleResSuggestions' })
export class SuggestionsResponseModel extends BaseSuccessResponseModel<SuggestionDataModel[]> {
	@ApiProperty({
		description: 'List of active suggestions',
		type: 'array',
		items: { type: 'object' },
	})
	@Expose()
	@Type(() => SuggestionDataModel)
	declare data: SuggestionDataModel[];
}

@ApiSchema({ name: 'BuddyModuleDataSuggestionFeedbackResult' })
export class SuggestionFeedbackResultDataModel {
	@ApiProperty({
		description: 'Whether the feedback was recorded successfully',
		type: 'boolean',
		example: true,
	})
	@Expose()
	success: boolean;
}

@ApiSchema({ name: 'BuddyModuleResSuggestionFeedback' })
export class SuggestionFeedbackResponseModel extends BaseSuccessResponseModel<SuggestionFeedbackResultDataModel> {
	@ApiProperty({
		description: 'The result of the suggestion feedback',
		type: () => SuggestionFeedbackResultDataModel,
	})
	@Expose()
	@Type(() => SuggestionFeedbackResultDataModel)
	declare data: SuggestionFeedbackResultDataModel;
}
