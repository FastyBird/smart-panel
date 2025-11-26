import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
	ApiAcceptedSuccessResponse,
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiSuccessArrayResponse,
} from '../../../common/decorators/api-documentation.decorator';
import { setResponseMeta } from '../../../common/utils/http.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { ReqCreateLogEntriesDto } from '../dto/create-log-entry.dto';
import {
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	SystemModuleLogIngestResult,
} from '../models/system-response.model';
import { LogEntryAcceptedModel, LogEntryModel } from '../models/system.model';
import { SystemLoggerService } from '../services/system-logger.service';
import { DEFAULT_PAGE_SIZE, LogEntryType } from '../system.constants';

@ApiTags('system-module')
@ApiExtraModels(LogEntriesResponseModel, LogEntryAcceptedResponseModel, SystemModuleLogIngestResult)
@Controller('logs')
export class LogsController {
	private readonly logger = new Logger(LogsController.name);

	constructor(private readonly appLogger: SystemLoggerService) {}

	@Get()
	@ApiOperation({ summary: 'List log entries', description: 'Retrieve a list of log entries with optional pagination' })
	@ApiQuery({ name: 'after_id', required: false, description: 'Cursor for pagination', type: 'string' })
	@ApiQuery({ name: 'limit', required: false, description: 'Number of entries to return', type: 'number' })
	@ApiSuccessArrayResponse(LogEntryModel, 'Log entries retrieved successfully')
	@ApiInternalServerErrorResponse()
	list(
		@Req() req: Request,
		@Query('after_id') afterId?: string,
		@Query('limit') limit: number | string = DEFAULT_PAGE_SIZE,
	): LogEntryModel[] {
		const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
		const lim = Math.min(Math.max(isNaN(parsedLimit) ? DEFAULT_PAGE_SIZE : parsedLimit, 1), 200);

		const data = this.appLogger.getLatest(afterId, lim);

		const next = data.length === lim ? data[data.length - 1].id : undefined;

		setResponseMeta(req, { next_cursor: next, has_more: Boolean(next) });

		return data;
	}

	@Post()
	@HttpCode(HttpStatus.ACCEPTED)
	@ApiOperation({ summary: 'Create log entries', description: 'Submit new log entries to the system' })
	@ApiBody({ type: ReqCreateLogEntriesDto, description: 'Log entries to create' })
	@ApiAcceptedSuccessResponse(LogEntryAcceptedModel, 'Log entries accepted successfully')
	@ApiBadRequestResponse('Invalid log entry data')
	@ApiInternalServerErrorResponse()
	create(@Body() createDto: ReqCreateLogEntriesDto): LogEntryAcceptedModel {
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

		return toInstance(LogEntryAcceptedModel, { accepted, rejected });
	}
}
