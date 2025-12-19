import { z } from 'zod';

export const ListQueryFilterValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]);

export const ListQueryFilterDataSchema = z.record(z.string(), ListQueryFilterValueSchema);

export const SortDirSchema = z.enum(['asc', 'desc']);

export const SortEntrySchema = z.object({ by: z.string(), dir: SortDirSchema.nullable().default(null) });

export const PaginationEntrySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	size: z.coerce.number().int().min(10).optional(),
});

export const ListQueryDataSchema = z.object({
	filters: ListQueryFilterDataSchema.optional(),
	sort: z.array(SortEntrySchema).default([]).optional(),
	pagination: PaginationEntrySchema.optional(),
	viewMode: z.string().optional(),
});

export const ListQueryEntrySchema = z.object({
	version: z.number(),
	updatedAt: z.number(),
	data: ListQueryDataSchema,
});

export const ListQueryKey = z.string();

// STORE STATE
// ===========

export const ListQueryStateSchema = z.record(z.string(), ListQueryEntrySchema.optional());

// STORE ACTIONS
// =============

export const ListQueryGetActionPayloadSchema = z.object({
	key: ListQueryKey,
	expectedVersion: z.number().default(1),
});

export const ListQuerySetActionPayloadSchema = z.object({
	key: ListQueryKey,
	data: z.object({
		filters: ListQueryFilterDataSchema.optional(),
		sort: z.array(SortEntrySchema).default([]).optional(),
		pagination: PaginationEntrySchema.optional(),
		viewMode: z.string().optional(),
	}),
	version: z.number().default(1),
});

export const ListQueryPatchActionPayloadSchema = z.object({
	key: ListQueryKey,
	data: z.object({
		filters: ListQueryFilterDataSchema.optional(),
		sort: z.array(SortEntrySchema).default([]).optional(),
		pagination: PaginationEntrySchema.optional(),
		viewMode: z.string().optional(),
	}),
	version: z.number().default(1),
});

export const ListQueryResetActionPayloadSchema = z.object({
	key: ListQueryKey,
});
