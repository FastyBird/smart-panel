import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { setResponseMeta } from '../../../common/utils/http.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ApiAcceptedSuccessResponse,
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessResponse,
} from '../../api/decorators/api-documentation.decorator';
import { ReqCreateLogEntriesDto } from '../dto/create-log-entry.dto';
import { LogEntriesResponseModel, LogEntryAcceptedResponseModel } from '../models/system-response.model';
import { LogEntryAcceptedModel } from '../models/system.model';
import { SystemLoggerService } from '../services/system-logger.service';
import { DEFAULT_PAGE_SIZE, LogEntryType, SYSTEM_MODULE_API_TAG_NAME } from '../system.constants';

@ApiTags(SYSTEM_MODULE_API_TAG_NAME)
@Controller('logs')
export class LogsController {
	private readonly logger = new Logger(LogsController.name);

	constructor(private readonly appLogger: SystemLoggerService) {}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'List log entries',
		description: 'Retrieve a list of log entries with optional pagination',
		operationId: 'get-system-module-log-entries',
	})
	@ApiQuery({ name: 'after_id', required: false, description: 'Cursor for pagination', type: 'string' })
	@ApiQuery({ name: 'limit', required: false, description: 'Number of entries to return', type: 'number' })
	@ApiSuccessResponse(LogEntriesResponseModel, 'Log entries retrieved successfully')
	@ApiInternalServerErrorResponse('Internal server error')
	@Get()
	list(
		@Req() req: Request,
		@Query('after_id') afterId?: string,
		@Query('limit') limit: number | string = DEFAULT_PAGE_SIZE,
	): LogEntriesResponseModel {
		const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
		const lim = Math.min(Math.max(isNaN(parsedLimit) ? DEFAULT_PAGE_SIZE : parsedLimit, 1), 200);

		const data = this.appLogger.getLatest(afterId, lim);

		const next = data.length === lim ? data[data.length - 1].id : undefined;

		setResponseMeta(req, { next_cursor: next, has_more: Boolean(next) });

		const response = new LogEntriesResponseModel();
		response.data = data;

		return response;
	}

	@ApiOperation({
		tags: [SYSTEM_MODULE_API_TAG_NAME],
		summary: 'Create log entries',
		description: 'Submit new log entries to the system',
		operationId: 'create-system-module-log-entries',
	})
	@ApiBody({ type: ReqCreateLogEntriesDto, description: 'Log entries to create' })
	@ApiAcceptedSuccessResponse(LogEntryAcceptedResponseModel, 'Log entries accepted successfully')
	@ApiBadRequestResponse('Invalid log entry data')
	@ApiInternalServerErrorResponse('Internal server error')
	@Post()
	@HttpCode(HttpStatus.ACCEPTED)
	create(@Body() createDto: ReqCreateLogEntriesDto): LogEntryAcceptedResponseModel {
		let accepted = 0;
		let rejected = 0;

		for (const event of createDto.data) {
			try {
				const prefix = event.tag ? `[${event.tag}]` : '';
				const message = event.message ?? '(no message)';
				const extra = event.args?.length ? JSON.stringify(event.args) : '';

				switch (event.type) {
					case LogEntryType.FATAL:
					case LogEntryType.ERROR:
						this.logger.error(`${prefix} ${message} ${extra}`, { ...event.context, source: event.source });
						break;

					case LogEntryType.WARN:
						this.logger.warn(`${prefix} ${message} ${extra}`, { ...event.context, source: event.source });
						break;

					case LogEntryType.INFO:
						this.logger.log(`${prefix} ${message} ${extra}`, { ...event.context, source: event.source });
						break;

					case LogEntryType.DEBUG:
					case LogEntryType.TRACE:
						this.logger.debug(`${prefix} ${message} ${extra}`, { ...event.context, source: event.source });
						break;

					default:
						this.logger.debug(`${prefix} ${message} ${extra}`, { ...event.context, source: event.source });
						break;
				}

				accepted++;
			} catch (err) {
				rejected++;

				this.logger.error('Failed to process log event', err);
			}
		}

		const data = toInstance(LogEntryAcceptedModel, { accepted, rejected });

		const response = new LogEntryAcceptedResponseModel();
		response.data = data;

		return response;
	}
}
