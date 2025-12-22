import { ulid } from 'ulid';

import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType } from '../../config/config.constants';
import { ConfigService } from '../../config/services/config.service';
import { ILogger } from '../logger/logger';
import { RingBuffer } from '../logger/ring-buffer';
import { SystemConfigModel } from '../models/config.model';
import { LogEntryModel } from '../models/system.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';
import { LogEntrySource, LogEntryType } from '../system.constants';

const LEVEL_MAP: Record<LogEntryType, number> = {
	silent: 0,
	trace: 0,
	verbose: 1,
	debug: 1,
	info: 2,
	log: 2,
	success: 2,
	warn: 3,
	error: 5,
	fail: 5,
	fatal: 6,
};

@Injectable()
export class SystemLoggerService implements LoggerService {
	private readonly consoleLogger = new ConsoleLogger('SystemLogger', { timestamp: false });

	private readonly rb = new RingBuffer<LogEntryModel>(/* capacity */ 2000);

	private readonly loggers: ILogger[] = [];

	private seq = 0;

	private systemConfig: SystemConfigModel | null = null;

	private allowedTypes = new Set<LogEntryType>([
		LogEntryType.INFO,
		LogEntryType.WARN,
		LogEntryType.ERROR,
		LogEntryType.FATAL,
	]);

	constructor(private readonly configService: ConfigService) {}

	setAllowedTypes(levels: LogEntryType[]) {
		this.allowedTypes = new Set(levels);
	}

	public register(logger: ILogger): void {
		this.loggers.push(logger);
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.systemConfig = null;

		this.setAllowedTypes(this.config.logLevels as unknown as LogEntryType[]);
	}

	private emit(entry: Omit<LogEntryModel, 'id' | 'ts' | 'seq' | 'ingestedAt'>) {
		if (!this.allowedTypes.has(entry.type)) {
			return;
		}

		const now = new Date();

		const withMeta: LogEntryModel = toInstance(LogEntryModel, {
			id: ulid(),
			ts: now.toISOString(),
			ingestedAt: now.toISOString(),
			seq: this.seq++,
			source: entry.source,
			resource: entry.resource,
			...entry,
		});

		this.rb.push(withMeta);

		for (const logger of this.loggers) {
			logger.append(withMeta).catch(() => {
				/* swallow */
			});
		}

		const line = `[${withMeta.type.toUpperCase()}]${withMeta.tag ? ' [' + withMeta.tag + ']' : ''} ${withMeta.message ?? ''}`;
		const extra = withMeta.args?.length ? ' ' + JSON.stringify(withMeta.args) : '';

		switch (withMeta.type) {
			case LogEntryType.FATAL:
			case LogEntryType.ERROR:
				this.consoleLogger.error(line + extra);
				break;

			case LogEntryType.WARN:
				this.consoleLogger.warn(line + extra);
				break;

			case LogEntryType.INFO:
				this.consoleLogger.log(line + extra);
				break;

			case LogEntryType.DEBUG:
			case LogEntryType.TRACE:
			default:
				this.consoleLogger.debug?.(line + extra);
				break;
		}
	}

	log(message: any, contextOrTag?: any[], tagOrNothing?: string) {
		this.emit({
			type: LogEntryType.INFO,
			level: LEVEL_MAP.info,
			source:
				contextOrTag !== null &&
				typeof contextOrTag === 'object' &&
				'source' in contextOrTag &&
				typeof contextOrTag.source === 'string'
					? (contextOrTag.source as LogEntrySource)
					: LogEntrySource.BACKEND,
			resource:
				contextOrTag !== null &&
				typeof contextOrTag === 'object' &&
				'resource' in contextOrTag &&
				typeof contextOrTag.resource === 'string'
					? contextOrTag.resource
					: undefined,
			message: String(message),
			tag:
				typeof contextOrTag === 'string'
					? contextOrTag
					: contextOrTag !== null &&
						  typeof contextOrTag === 'object' &&
						  'tag' in contextOrTag &&
						  typeof contextOrTag.tag === 'string'
						? contextOrTag.tag
						: tagOrNothing,
		});
	}

	error(message: any, stackOrContext?: any[], contextOrTag?: any[], tagOrNothing?: string) {
		this.emit({
			type: LogEntryType.ERROR,
			level: LEVEL_MAP.error,
			source:
				stackOrContext !== null &&
				typeof stackOrContext === 'object' &&
				'source' in stackOrContext &&
				typeof stackOrContext.source === 'string'
					? (stackOrContext.source as LogEntrySource)
					: contextOrTag !== null &&
						  typeof contextOrTag === 'object' &&
						  'source' in contextOrTag &&
						  typeof contextOrTag.source === 'string'
						? (contextOrTag.source as LogEntrySource)
						: LogEntrySource.BACKEND,
			resource:
				stackOrContext !== null &&
				typeof stackOrContext === 'object' &&
				'resource' in stackOrContext &&
				typeof stackOrContext.resource === 'string'
					? stackOrContext.resource
					: contextOrTag !== null &&
						  typeof contextOrTag === 'object' &&
						  'resource' in contextOrTag &&
						  typeof contextOrTag.resource === 'string'
						? contextOrTag.resource
						: undefined,
			message: String(message),
			args: stackOrContext ? [stackOrContext] : undefined,
			tag:
				typeof stackOrContext === 'string'
					? stackOrContext
					: stackOrContext !== null &&
						  typeof stackOrContext === 'object' &&
						  'tag' in stackOrContext &&
						  typeof stackOrContext.tag === 'string'
						? stackOrContext.tag
						: typeof contextOrTag === 'string'
							? contextOrTag
							: contextOrTag !== null &&
								  typeof contextOrTag === 'object' &&
								  'tag' in contextOrTag &&
								  typeof contextOrTag.tag === 'string'
								? contextOrTag.tag
								: tagOrNothing,
		});
	}

	warn(message: any, contextOrTag?: any[], tagOrNothing?: string) {
		this.emit({
			type: LogEntryType.WARN,
			level: LEVEL_MAP.warn,
			source:
				contextOrTag !== null &&
				typeof contextOrTag === 'object' &&
				'source' in contextOrTag &&
				typeof contextOrTag.source === 'string'
					? (contextOrTag.source as LogEntrySource)
					: LogEntrySource.BACKEND,
			resource:
				contextOrTag !== null &&
				typeof contextOrTag === 'object' &&
				'resource' in contextOrTag &&
				typeof contextOrTag.resource === 'string'
					? contextOrTag.resource
					: undefined,
			message: String(message),
			tag:
				typeof contextOrTag === 'string'
					? contextOrTag
					: contextOrTag !== null &&
						  typeof contextOrTag === 'object' &&
						  'tag' in contextOrTag &&
						  typeof contextOrTag.tag === 'string'
						? contextOrTag.tag
						: tagOrNothing,
		});
	}

	debug?(message: any, contextOrTag?: any[], tagOrNothing?: string) {
		this.emit({
			type: LogEntryType.DEBUG,
			level: LEVEL_MAP.debug,
			source:
				contextOrTag !== null &&
				typeof contextOrTag === 'object' &&
				'source' in contextOrTag &&
				typeof contextOrTag.source === 'string'
					? (contextOrTag.source as LogEntrySource)
					: LogEntrySource.BACKEND,
			resource:
				contextOrTag !== null &&
				typeof contextOrTag === 'object' &&
				'resource' in contextOrTag &&
				typeof contextOrTag.resource === 'string'
					? contextOrTag.resource
					: undefined,
			message: String(message),
			tag:
				typeof contextOrTag === 'string'
					? contextOrTag
					: contextOrTag !== null &&
						  typeof contextOrTag === 'object' &&
						  'tag' in contextOrTag &&
						  typeof contextOrTag.tag === 'string'
						? contextOrTag.tag
						: tagOrNothing,
		});
	}

	verbose?(message: any, context?: any[]) {
		this.emit({
			type: LogEntryType.TRACE,
			level: LEVEL_MAP.trace,
			source:
				context !== null && typeof context === 'object' && 'source' in context && typeof context.source === 'string'
					? (context.source as LogEntrySource)
					: LogEntrySource.BACKEND,
			resource:
				context !== null && typeof context === 'object' && 'resource' in context && typeof context.resource === 'string'
					? context.resource
					: undefined,
			message: String(message),
			tag:
				typeof context === 'string'
					? context
					: context !== null && typeof context === 'object' && 'tag' in context && typeof context.tag === 'string'
						? context.tag
						: undefined,
		});
	}

	getLatest(afterId?: string, limit = 50, tags?: string[], resources?: string[]): LogEntryModel[] {
		let all = this.rb.toArrayNewestFirst();

		// Filter by tags if provided (case-insensitive)
		if (tags && tags.length > 0) {
			const lowerTags = tags.map((t) => t.toLowerCase());
			all = all.filter((e) => e.tag && lowerTags.includes(e.tag.toLowerCase()));
		}

		// Filter by resource IDs if provided (case-insensitive)
		if (resources && resources.length > 0) {
			const lowerResources = resources.map((r) => r.toLowerCase());
			all = all.filter((e) => e.resource && lowerResources.includes(e.resource.toLowerCase()));
		}

		const start = afterId ? all.findIndex((e) => e.id === afterId) : -1;
		const slice = start >= 0 ? all.slice(start + 1) : all;

		return slice.slice(0, limit);
	}

	private get config(): SystemConfigModel {
		if (!this.systemConfig) {
			this.systemConfig = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
		}

		return this.systemConfig;
	}
}
