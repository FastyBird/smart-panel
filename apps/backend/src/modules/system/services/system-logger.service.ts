import { ulid } from 'ulid';

import { ConsoleLogger, Injectable, LoggerService } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType, SectionType } from '../../config/config.constants';
import { SystemConfigModel } from '../../config/models/config.model';
import { ConfigService } from '../../config/services/config.service';
import { ILogger } from '../logger/logger';
import { RingBuffer } from '../logger/ring-buffer';
import { LogEntryModel } from '../models/system.model';
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
			message: String(message),
			tag: typeof contextOrTag === 'string' ? contextOrTag : tagOrNothing,
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
			message: String(message),
			args: stackOrContext ? [stackOrContext] : undefined,
			tag:
				typeof stackOrContext === 'string'
					? stackOrContext
					: typeof contextOrTag === 'string'
						? contextOrTag
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
			message: String(message),
			tag: typeof contextOrTag === 'string' ? contextOrTag : tagOrNothing,
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
			message: String(message),
			tag: typeof contextOrTag === 'string' ? contextOrTag : tagOrNothing,
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
			message: String(message),
			tag: typeof context === 'string' ? context : undefined,
		});
	}

	getLatest(afterId?: string, limit = 50): LogEntryModel[] {
		const all = this.rb.toArrayNewestFirst();

		const start = afterId ? all.findIndex((e) => e.id === afterId) : -1;
		const slice = start >= 0 ? all.slice(start + 1) : all;

		return slice.slice(0, limit);
	}

	private get config(): SystemConfigModel {
		if (!this.systemConfig) {
			this.systemConfig = this.configService.getConfigSection<SystemConfigModel>(SectionType.SYSTEM, SystemConfigModel);
		}

		return this.systemConfig;
	}
}
