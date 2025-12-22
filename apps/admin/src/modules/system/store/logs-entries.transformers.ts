import { z } from 'zod';

import { SystemValidationException } from '../system.exceptions';

import { LogEntryCreateReqSchema, LogEntrySchema } from './logs-entries.store.schemas';
import type { ILogEntry, ILogEntryCreateReq, ILogEntryRes, ILogsEntriesAddActionPayload } from './logs-entries.store.types';

export const transformLogEntryResponse = (response: ILogEntryRes): ILogEntry => {
	const parsedLogEntry = LogEntrySchema.safeParse({
		id: response.id,
		ts: response.ts,
		ingestedAt: response.ingested_at,
		seq: response.seq,
		source: response.source,
		level: response.level,
		type: response.type,
		tag: response.tag,
		device: response.device,
		message: response.message,
		args: response.args,
		user: {
			id: response.user?.id,
		},
		context: {
			appVersion: response.context?.app_version,
			url: response.context?.url,
			userAgent: response.context?.user_agent,
			locale: response.context?.locale,
		},
	});

	if (!parsedLogEntry.success) {
		throw new SystemValidationException('Failed to validate received log entry data.');
	}

	return parsedLogEntry.data;
};

export const transformLogEntryCreateRequest = (logEntries: ILogsEntriesAddActionPayload['data'] & { id?: string }): ILogEntryCreateReq[] => {
	const wire = logEntries.map((e) => ({
		ts: e.ts,
		level: e.level,
		type: e.type,
		tag: e.tag,
		message: e.message,
		args: e.args,
		user: e.user?.id ? { id: e.user.id } : undefined,
		context: e.context
			? {
					app_version: e.context.appVersion,
					url: e.context.url,
					user_agent: e.context.userAgent,
					locale: e.context.locale,
				}
			: undefined,
	}));

	const parsed = z.array(LogEntryCreateReqSchema).safeParse(wire);

	if (!parsed.success) {
		throw new SystemValidationException('Failed to validate create log entry request.');
	}

	return parsed.data;
};
