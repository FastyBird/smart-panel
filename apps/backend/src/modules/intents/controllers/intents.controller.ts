import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import {
	ApiBadRequestResponse,
	ApiForbiddenResponse,
	ApiInternalServerErrorResponse,
	ApiNotFoundResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import {
	INTENTS_MODULE_API_TAG_NAME,
	INTENTS_MODULE_NAME,
} from '../intents.constants';
import {
	IntentsActiveCountResponseModel,
	IntentResponseModel,
	IntentsResponseModel,
} from '../models/intents-response.model';
import { IntentsService } from '../services/intents.service';

@ApiTags(INTENTS_MODULE_API_TAG_NAME)
@Controller('intents')
export class IntentsController {
	private readonly logger = createExtensionLogger(INTENTS_MODULE_NAME, 'IntentsController');

	constructor(private readonly intentsService: IntentsService) {}

	@ApiOperation({
		tags: [INTENTS_MODULE_API_TAG_NAME],
		summary: 'List active intents',
		description:
			'Retrieve a list of all active (pending) intents. Supports optional filtering by deviceId or spaceId via query parameters.',
		operationId: 'get-intents-module-intents',
	})
	@ApiQuery({
		name: 'device_id',
		required: false,
		description: 'Filter intents by device ID',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiQuery({
		name: 'space_id',
		required: false,
		description: 'Filter intents by space ID (scope)',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiSuccessResponse(
		IntentsResponseModel,
		'A list of active intents successfully retrieved. Returns empty array if no active intents match the criteria.',
	)
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiForbiddenResponse('Authentication required')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async findAll(
		@Query('device_id') deviceId?: string,
		@Query('space_id') spaceId?: string,
	): Promise<IntentsResponseModel> {
		this.logger.debug(`Fetching active intents${deviceId ? ` for deviceId=${deviceId}` : ''}${spaceId ? ` for spaceId=${spaceId}` : ''}`);

		const query: { deviceId?: string; spaceId?: string } = {};

		if (deviceId) {
			query.deviceId = deviceId;
		}

		if (spaceId) {
			query.spaceId = spaceId;
		}

		const intents = this.intentsService.findActiveIntents(query);

		this.logger.debug(`Retrieved ${intents.length} active intents`);

		const response = new IntentsResponseModel();
		response.data = intents;

		return response;
	}

	@ApiOperation({
		tags: [INTENTS_MODULE_API_TAG_NAME],
		summary: 'Get count of active intents',
		description: 'Retrieve the count of currently active (pending) intents. Useful for monitoring and debugging.',
		operationId: 'get-intents-module-active-count',
	})
	@ApiSuccessResponse(
		IntentsActiveCountResponseModel,
		'Count of active intents retrieved successfully',
	)
	@ApiForbiddenResponse('Authentication required')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get('_active/count')
	async getActiveCount(): Promise<IntentsActiveCountResponseModel> {
		this.logger.debug('Fetching active intents count');

		const count = this.intentsService.getActiveCount();

		this.logger.debug(`Active intents count: ${count}`);

		const response = new IntentsActiveCountResponseModel();
		response.data = { count };

		return response;
	}

	@ApiOperation({
		tags: [INTENTS_MODULE_API_TAG_NAME],
		summary: 'Get intent by ID',
		description: 'Retrieve a specific intent by its unique identifier. Returns the intent regardless of its status (pending, completed, or expired).',
		operationId: 'get-intents-module-intent',
	})
	@ApiParam({
		name: 'id',
		description: 'Intent unique identifier',
		type: 'string',
		format: 'uuid',
		example: '123e4567-e89b-12d3-a456-426614174000',
	})
	@ApiSuccessResponse(IntentResponseModel, 'Intent retrieved successfully')
	@ApiBadRequestResponse('Invalid intent ID format')
	@ApiForbiddenResponse('Authentication required')
	@ApiNotFoundResponse('Intent not found')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get(':id')
	async findOne(@Param('id') id: string): Promise<IntentResponseModel> {
		this.logger.debug(`Fetching intent with id=${id}`);

		const intent = this.intentsService.getIntent(id);

		if (!intent) {
			this.logger.debug(`Intent with id=${id} not found`);
			throw new NotFoundException('Intent not found');
		}

		this.logger.debug(`Successfully retrieved intent with id=${id}`);

		const response = new IntentResponseModel();
		response.data = intent;

		return response;
	}
}
