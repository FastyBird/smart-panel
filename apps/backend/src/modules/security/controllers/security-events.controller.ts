import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../swagger/decorators/api-documentation.decorator';
import { SecurityEventModel, SecurityEventsResponseModel } from '../models/security-event-response.model';
import { SECURITY_MODULE_API_TAG_NAME, SecurityEventType, Severity } from '../security.constants';
import { SecurityEventsService } from '../services/security-events.service';

@ApiTags(SECURITY_MODULE_API_TAG_NAME)
@Controller('events')
export class SecurityEventsController {
	constructor(private readonly eventsService: SecurityEventsService) {}

	@ApiOperation({
		tags: [SECURITY_MODULE_API_TAG_NAME],
		summary: 'Get recent security events',
		description: 'Returns a list of recent security events (alert transitions, acknowledgements, state changes)',
		operationId: 'get-security-module-events',
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		type: 'number',
		description: 'Max events to return (default 50, max 200)',
	})
	@ApiQuery({
		name: 'since',
		required: false,
		type: 'string',
		description: 'ISO 8601 datetime — only return events after this time',
	})
	@ApiQuery({ name: 'severity', required: false, enum: Severity, description: 'Filter by severity' })
	@ApiQuery({ name: 'type', required: false, enum: SecurityEventType, description: 'Filter by event type' })
	@ApiSuccessResponse(SecurityEventsResponseModel, 'Security events retrieved successfully')
	@ApiBadRequestResponse('Invalid request parameters')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	async getEvents(
		@Query('limit') limit?: string,
		@Query('since') since?: string,
		@Query('severity') severity?: Severity,
		@Query('type') type?: SecurityEventType,
	): Promise<SecurityEventsResponseModel> {
		let sinceDate: Date | undefined;

		if (since != null) {
			sinceDate = new Date(since);

			if (Number.isNaN(sinceDate.getTime())) {
				throw new BadRequestException('Invalid "since" parameter: must be a valid ISO 8601 datetime');
			}
		}

		let parsedLimit: number | undefined;

		if (limit != null) {
			parsedLimit = parseInt(limit, 10);

			if (Number.isNaN(parsedLimit)) {
				throw new BadRequestException('Invalid "limit" parameter: must be a number');
			}
		}

		const events = await this.eventsService.findRecent({
			limit: parsedLimit,
			since: sinceDate,
			severity,
			type,
		});

		const response = new SecurityEventsResponseModel();
		response.data = events.map((e) => {
			const model = new SecurityEventModel();
			model.id = e.id;
			model.timestamp = e.timestamp.toISOString();
			model.eventType = e.eventType;
			model.severity = e.severity ?? undefined;
			model.alertId = e.alertId ?? undefined;
			model.alertType = e.alertType ?? undefined;
			model.sourceDeviceId = e.sourceDeviceId ?? undefined;
			model.payload = e.payload ?? undefined;

			return model;
		});

		return response;
	}
}
