import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { SuggestionFeedback } from '../../spaces/spaces.constants';
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME, SuggestionType } from '../buddy.constants';
import { ReqSuggestionFeedbackDto } from '../dto/suggestion-feedback.dto';
import {
	SuggestionDataModel,
	SuggestionFeedbackResponseModel,
	SuggestionFeedbackResultDataModel,
	SuggestionsResponseModel,
} from '../models/suggestion-response.model';
import { SceneSuggestionEvaluator } from '../services/scene-suggestion-evaluator.service';
import { BuddySuggestion, SuggestionEngineService } from '../services/suggestion-engine.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('suggestions')
export class BuddySuggestionsController {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'BuddySuggestionsController');

	constructor(
		private readonly suggestionEngine: SuggestionEngineService,
		private readonly sceneSuggestionEvaluator: SceneSuggestionEvaluator,
	) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List active suggestions',
		description:
			'Retrieves a list of active (non-expired, non-cooldown) buddy suggestions. ' +
			'Optionally filter by space ID. Suggestions are generated from detected action patterns.',
		operationId: 'get-buddy-module-suggestions',
	})
	@ApiQuery({
		name: 'space_id',
		required: false,
		type: 'string',
		description: 'Filter suggestions by space ID',
	})
	@ApiSuccessResponse(SuggestionsResponseModel, 'A list of active suggestions successfully retrieved.')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(@Query('space_id') spaceId?: string): Promise<SuggestionsResponseModel> {
		this.logger.debug(`Fetching active suggestions${spaceId ? ` for space=${spaceId}` : ''}`);

		await this.suggestionEngine.generateSuggestions();

		const suggestions = await this.suggestionEngine.getActiveSuggestions(spaceId);

		this.logger.debug(`Retrieved ${suggestions.length} active suggestion(s)`);

		const response = new SuggestionsResponseModel();

		response.data = suggestions.map((s) => this.toDataModel(s));

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Submit suggestion feedback',
		description:
			'Records user feedback for a suggestion (applied or dismissed). ' +
			'A cooldown is set to prevent the same suggestion type from reappearing for the same space.',
		operationId: 'create-buddy-module-suggestion-feedback',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Suggestion ID' })
	@ApiBody({ type: ReqSuggestionFeedbackDto, description: 'The feedback data for the suggestion' })
	@ApiSuccessResponse(SuggestionFeedbackResponseModel, 'Feedback was recorded successfully.')
	@ApiBadRequestResponse('Invalid feedback data')
	@ApiNotFoundResponse('Suggestion not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/feedback')
	async submitFeedback(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSuggestionFeedbackDto,
	): Promise<SuggestionFeedbackResponseModel> {
		this.logger.debug(`Submitting feedback "${body.data.feedback}" for suggestion id=${id}`);

		const result = await this.suggestionEngine.recordFeedback(id, body.data.feedback);

		// Create a scene when the user accepts a scene creation suggestion
		if (
			body.data.feedback === SuggestionFeedback.APPLIED &&
			result.suggestion.type === SuggestionType.PATTERN_SCENE_CREATE
		) {
			const sceneResult = await this.sceneSuggestionEvaluator.createSceneFromSuggestion(
				result.suggestion.spaceId,
				result.suggestion.metadata,
			);

			if ('error' in sceneResult) {
				this.logger.warn(`Scene creation failed for suggestion id=${id}: ${sceneResult.error}`);
			}
		}

		const resultData = new SuggestionFeedbackResultDataModel();
		resultData.success = result.success;

		const response = new SuggestionFeedbackResponseModel();
		response.data = resultData;

		return response;
	}

	private toDataModel(suggestion: BuddySuggestion): SuggestionDataModel {
		const model = new SuggestionDataModel();

		model.id = suggestion.id;
		model.type = suggestion.type;
		model.title = suggestion.title;
		model.reason = suggestion.reason;
		model.spaceId = suggestion.spaceId;
		model.metadata = suggestion.metadata;
		model.createdAt = suggestion.createdAt.toISOString();
		model.expiresAt = suggestion.expiresAt.toISOString();

		return model;
	}
}
