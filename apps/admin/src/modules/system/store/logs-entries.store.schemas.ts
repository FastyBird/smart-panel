import { type ZodType, z } from 'zod';

import { ConfigModuleSystemLog_levels, SystemModuleLogEntrySource, type components } from '../../../openapi';
import { DEFAULT_PAGE_SIZE } from '../system.constants';

type ApiCreateLogEntry = components['schemas']['SystemModuleCreateLogEntry'];
type ApiLogEntry = components['schemas']['SystemModuleDataLogEntry'];

export const LogEntryIdSchema = z.string().ulid();

// STORE STATE
// ===========

export const LogEntrySchema = z.object({
	id: LogEntryIdSchema,
	ts: z.string().datetime(),
	ingestedAt: z.string().datetime().optional(),
	seq: z.number().int().min(0).optional(),
	source: z.nativeEnum(SystemModuleLogEntrySource),
	level: z.number().int().min(0).max(6),
	type: z.nativeEnum(ConfigModuleSystemLog_levels),
	tag: z.string().max(128).optional(),
	message: z.string().max(2000).optional(),
	args: z
		.array(
			z.union([
				z.string(),
				z.number(),
				z.boolean(),
				z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
				z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
				z.null(),
			])
		)
		.max(20)
		.optional(),
	user: z.object({
		id: z.string().uuid().optional(),
	}),
	context: z.object({
		appVersion: z.string().optional(),
		url: z.string().optional(),
		userAgent: z.string().optional(),
		locale: z.string().optional(),
	}),
});

export const AddLogEntrySchema = z.object({
	ts: z.string().datetime(),
	level: z.number().int().min(0).max(6),
	type: z.nativeEnum(ConfigModuleSystemLog_levels),
	tag: z.string().max(128).optional(),
	message: z.string().max(2000).optional(),
	args: z
		.array(
			z.union([
				z.string(),
				z.number(),
				z.boolean(),
				z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
				z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
				z.null(),
			])
		)
		.max(20)
		.optional(),
	user: z
		.object({
			id: z.string().uuid().optional(),
		})
		.optional(),
	context: z
		.object({
			appVersion: z.string().optional(),
			url: z.string().optional(),
			userAgent: z.string().optional(),
			locale: z.string().optional(),
		})
		.optional(),
});

export const LogsEntriesStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
	}),
	creating: z.array(LogEntryIdSchema),
	deleting: z.array(LogEntryIdSchema),
});

// STORE ACTIONS
// =============

export const LogsEntriesOnEventActionPayloadSchema = z.object({
	id: LogEntryIdSchema,
	data: z.object({}),
});

export const LogsEntriesSetActionPayloadSchema = z.object({
	id: LogEntryIdSchema,
	data: z.object({
		id: LogEntryIdSchema,
		ts: z.string().datetime(),
		ingestedAt: z.string().datetime().optional(),
		seq: z.number().int().min(0).optional(),
		source: z.nativeEnum(SystemModuleLogEntrySource),
		level: z.number().int().min(0).max(6),
		type: z.nativeEnum(ConfigModuleSystemLog_levels),
		tag: z.string().max(128).optional(),
		message: z.string().max(2000).optional(),
		args: z
			.array(
				z.union([
					z.string(),
					z.number(),
					z.boolean(),
					z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
					z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
					z.null(),
				])
			)
			.max(20)
			.optional(),
		user: z.object({
			id: z.string().uuid().optional(),
		}),
		context: z.object({
			appVersion: z.string().optional(),
			url: z.string().optional(),
			userAgent: z.string().optional(),
			locale: z.string().optional(),
		}),
	}),
});

export const LogsEntriesUnsetActionPayloadSchema = z.object({
	id: LogEntryIdSchema,
});

export const LogsEntriesFetchActionPayloadSchema = z.object({
	afterId: z.string().optional(),
	limit: z.number().min(1).max(200).default(DEFAULT_PAGE_SIZE).optional(),
	append: z.boolean().default(false).optional(),
});

export const LogsEntriesAddActionPayloadSchema = z.object({
	data: z.array(AddLogEntrySchema),
});

// BACKEND API
// ===========

export const LogEntryCreateReqSchema: ZodType<ApiCreateLogEntry> = z.object({
	ts: z.string(),
	source: z.nativeEnum(SystemModuleLogEntrySource),
	level: z.number(),
	type: z.nativeEnum(ConfigModuleSystemLog_levels),
	tag: z.string().optional(),
	message: z.string().optional(),
	args: z
		.array(
			z.union([
				z.string(),
				z.number(),
				z.boolean(),
				z.record(z.string(), z.never()),
				z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
				z.null(),
			])
		)
		.optional(),
	user: z
		.object({
			id: z.string().uuid().optional(),
		})
		.optional(),
	context: z
		.object({
			app_version: z.string().optional(),
			url: z.string().optional(),
			user_agent: z.string().optional(),
			locale: z.string().optional(),
		})
		.optional(),
});

export const LogEntryResSchema: ZodType<ApiLogEntry> = z.object({
	id: z.string().ulid(),
	ts: z.string(),
	ingested_at: z.string().optional(),
	seq: z.number().optional(),
	source: z.nativeEnum(SystemModuleLogEntrySource),
	level: z.number(),
	type: z.nativeEnum(ConfigModuleSystemLog_levels),
	tag: z.string().optional(),
	message: z.string().optional(),
	args: z
		.array(
			z.union([
				z.string(),
				z.number(),
				z.boolean(),
				z.record(z.string(), z.never()),
				z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
				z.null(),
			])
		)
		.optional(),
	user: z.object({
		id: z.string().uuid().optional(),
	}),
	context: z.object({
		app_version: z.string().optional(),
		url: z.string().optional(),
		user_agent: z.string().optional(),
		locale: z.string().optional(),
	}),
});
