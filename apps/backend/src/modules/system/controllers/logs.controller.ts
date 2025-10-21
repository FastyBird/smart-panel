import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Post, Query, Req } from '@nestjs/common';

import { setResponseMeta } from '../../../common/utils/http.utils';
import { toInstance } from '../../../common/utils/transform.utils';
import { ReqCreateLogEntriesDto } from '../dto/create-log-entry.dto';
import { LogEntryAcceptedModel, LogEntryModel } from '../models/system.model';
import { SystemLoggerService } from '../services/system-logger.service';
import { DEFAULT_PAGE_SIZE, LogEntryType } from '../system.constants';

@Controller('logs')
export class LogsController {
	private readonly logger = new Logger(LogsController.name);

	constructor(private readonly appLogger: SystemLoggerService) {}

	@Get()
	list(
		@Req() req: Request,
		@Query('after_id') afterId?: string,
		@Query('limit') limit = DEFAULT_PAGE_SIZE,
	): LogEntryModel[] {
		const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

		const data = this.appLogger.getLatest(afterId, lim);

		const next = data.length === lim ? data[data.length - 1].id : undefined;

		setResponseMeta(req, { next_cursor: next, has_more: Boolean(next) });

		return data;
	}

	@Post()
	@HttpCode(HttpStatus.ACCEPTED)
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
