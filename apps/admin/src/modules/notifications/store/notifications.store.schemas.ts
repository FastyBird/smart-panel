import { type ZodType, z } from 'zod';

import { ExtensionKind } from '../../../openapi.constants';
import type { NotificationsModuleNotificationActionSchema, NotificationsModuleNotificationSchema } from '../../../openapi.constants';
import {
	NotificationsModuleNotificationActionOperation,
	NotificationsModuleNotificationActionType,
	NotificationsModuleNotificationKind,
	NotificationsModuleNotificationSeverity,
} from '../../../openapi.constants';

type ApiNotification = NotificationsModuleNotificationSchema;
type ApiNotificationAction = NotificationsModuleNotificationActionSchema;

// A date the API always sends as an ISO string; the store keeps it as a `Date` once parsed.
const DateSchema = z.union([z.string().datetime({ offset: true }), z.date()]).transform((date) => (date instanceof Date ? date : new Date(date)));

const NullableDateSchema = DateSchema.optional().nullable().default(null);

// STORE STATE
// ===========

/**
 * A notification's call to action. Field names are camelCase, matching the rest of the store's
 * internal representation - the wire's snake_case keys (`extension_type`, `action_id`, ...) are
 * translated in `notifications.store.ts`'s `transformNotificationResponse`.
 */
export const NotificationActionSchema = z.object({
	type: z.nativeEnum(NotificationsModuleNotificationActionType),
	label: z.string(),
	primary: z.boolean().optional(),
	url: z.string().optional(),
	extensionType: z.string().optional(),
	actionId: z.string().optional(),
	// Opaque parameters an extension action defines for itself - never renamed or interpreted here.
	params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
	extensionKind: z.nativeEnum(ExtensionKind).optional(),
	serviceId: z.string().optional(),
	operation: z.nativeEnum(NotificationsModuleNotificationActionOperation).optional(),
});

export const NotificationSchema = z.object({
	id: z.string().uuid(),
	source: z.string(),
	kind: z.nativeEnum(NotificationsModuleNotificationKind),
	key: z.string().nullable().default(null),
	severity: z.nativeEnum(NotificationsModuleNotificationSeverity),
	title: z.string(),
	message: z.string().nullable().default(null),
	actions: z.array(NotificationActionSchema).default([]),
	// Free-form, emitter-supplied context - keys are never case-converted, unlike every other field.
	data: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
		.nullable()
		.default(null),
	persistent: z.boolean().default(false),
	occurrences: z.number().int().default(1),
	readAt: NullableDateSchema,
	dismissedAt: NullableDateSchema,
	resolvedAt: NullableDateSchema,
	createdAt: DateSchema,
	updatedAt: NullableDateSchema,
});

export const NotificationsStateSemaphoreSchema = z.object({
	fetching: z.object({
		items: z.boolean().default(false),
		item: z.array(z.string()),
	}),
	updating: z.array(z.string()),
	deleting: z.array(z.string()),
});

// STORE ACTIONS
// =============

export const NotificationsBulkResultSchema = z.object({
	succeeded: z.array(z.string()),
	failed: z.array(z.object({ id: z.string(), reason: z.string() })),
});

// BACKEND API
// ===========

// Wire-shaped mirrors of the generated OpenAPI types, kept in sync through the `ZodType<...>`
// binding below. Not parsed against live responses - `NotificationSchema` above is the runtime
// gatekeeper, exactly as `DeviceResSchema` is a compile-time-only cross-check in the devices store.
export const NotificationActionResSchema: ZodType<ApiNotificationAction> = z.object({
	type: z.nativeEnum(NotificationsModuleNotificationActionType),
	label: z.string(),
	primary: z.boolean().optional(),
	url: z.string().optional(),
	extension_type: z.string().optional(),
	action_id: z.string().optional(),
	params: z.record(z.string(), z.unknown()).optional(),
	extension_kind: z.nativeEnum(ExtensionKind).optional(),
	service_id: z.string().optional(),
	operation: z.nativeEnum(NotificationsModuleNotificationActionOperation).optional(),
});

export const NotificationResSchema: ZodType<ApiNotification> = z.object({
	id: z.string().uuid(),
	created_at: z.string(),
	updated_at: z.string().nullable().optional(),
	source: z.string(),
	kind: z.nativeEnum(NotificationsModuleNotificationKind),
	key: z.string().nullable().optional(),
	severity: z.nativeEnum(NotificationsModuleNotificationSeverity),
	title: z.string(),
	message: z.string().nullable().optional(),
	actions: z.array(NotificationActionResSchema),
	data: z.record(z.string(), z.unknown()).nullable().optional(),
	persistent: z.boolean(),
	occurrences: z.number(),
	read_at: z.string().nullable().optional(),
	dismissed_at: z.string().nullable().optional(),
	resolved_at: z.string().nullable().optional(),
});

// TYPES
// =====

export type INotificationAction = z.infer<typeof NotificationActionSchema>;

export type INotification = z.infer<typeof NotificationSchema>;

export type INotificationsStateSemaphore = z.infer<typeof NotificationsStateSemaphoreSchema>;

export type IBulkResult = z.infer<typeof NotificationsBulkResultSchema>;

export type INotificationActionRes = z.infer<typeof NotificationActionResSchema>;

export type INotificationRes = z.infer<typeof NotificationResSchema>;
