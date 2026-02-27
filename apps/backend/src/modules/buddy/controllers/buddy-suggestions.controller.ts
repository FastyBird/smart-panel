import { Body, Controller, Get, Logger, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { BUDDY_MODULE_API_TAG_NAME } from '../buddy.constants';
import { ReqSuggestionFeedbackDto } from '../dto/suggestion-feedback.dto';
import { BuddySuggestionModel, SuggestionResponseModel, SuggestionsResponseModel } from '../models/suggestion.model';
import { BuddySuggestion, SuggestionEngineService } from '../services/suggestion-engine.service';

@ApiTags(BUDDY_MODULE_API_TAG_NAME)
@Controller('suggestions')
export class BuddySuggestionsController {
	private readonly logger = new Logger(BuddySuggestionsController.name);

	constructor(private readonly suggestionEngine: SuggestionEngineService) {}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'List active suggestions',
		description: 'Retrieves a list of active buddy suggestions. Optionally filter by space ID.',
		operationId: 'get-buddy-module-suggestions',
	})
	@ApiQuery({
		name: 'space_id',
		required: false,
		type: 'string',
		description: 'Filter suggestions by space ID',
	})
	@ApiSuccessResponse(SuggestionsResponseModel, 'Suggestions successfully retrieved')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	findAll(@Query('space_id') spaceId?: string): SuggestionsResponseModel {
		this.logger.debug(`[LOOKUP ALL] Fetching suggestions${spaceId ? ` for space=${spaceId}` : ''}`);

		const suggestions = this.suggestionEngine.getActiveSuggestions(spaceId);

		this.logger.debug(`[LOOKUP ALL] Retrieved ${String(suggestions.length)} suggestions`);

		const response = new SuggestionsResponseModel();
		response.data = suggestions.map((s) => this.toModel(s));

		return response;
	}

	@ApiOperation({
		tags: [BUDDY_MODULE_API_TAG_NAME],
		summary: 'Submit feedback for a suggestion',
		description: 'Records feedback (applied or dismissed) for a specific suggestion and sets the appropriate cooldown.',
		operationId: 'post-buddy-module-suggestion-feedback',
	})
	@ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Suggestion ID' })
	@ApiBody({ type: ReqSuggestionFeedbackDto, description: 'Feedback data' })
	@ApiSuccessResponse(SuggestionResponseModel, 'Feedback recorded successfully')
	@ApiBadRequestResponse('Invalid request data or UUID format')
	@ApiNotFoundResponse('Suggestion not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post(':id/feedback')
	recordFeedback(
		@Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
		@Body() body: ReqSuggestionFeedbackDto,
	): SuggestionResponseModel {
		this.logger.debug(`[FEEDBACK] Recording feedback for suggestion id=${id}`);

		const suggestion = this.suggestionEngine.findSuggestion(id);

		if (!suggestion) {
			throw new NotFoundException(`Suggestion with id=${id} was not found.`);
		}

		const model = this.toModel(suggestion);

		this.suggestionEngine.recordFeedback(id, body.data.feedback);

		this.logger.debug(`[FEEDBACK] Recorded ${body.data.feedback} for suggestion id=${id}`);

		const response = new SuggestionResponseModel();
		response.data = model;

		return response;
	}

	private toModel(suggestion: BuddySuggestion): BuddySuggestionModel {
		const model = new BuddySuggestionModel();

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
