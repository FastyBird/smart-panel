import { type ZodType, z } from 'zod';

import type { ConfigModuleUpdateModuleSchema, NotificationsModuleConfigSchema } from '../../../openapi.constants';
import { ConfigModuleEditFormSchema } from '../../config';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { NOTIFICATIONS_MODULE_NAME } from '../notifications.constants';

type ApiConfigModule = NotificationsModuleConfigSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// Bounds mirror the backend's `RETENTION_DAYS_MIN/MAX` and `MAX_NOTIFICATIONS_MIN/MAX`
// (`apps/backend/src/modules/notifications/notifications.constants.ts`) - duplicated here rather
// than shared because the admin has no runtime dependency on backend source.
const RETENTION_DAYS_MIN = 1;
const RETENTION_DAYS_MAX = 365;
const MAX_NOTIFICATIONS_MIN = 50;
const MAX_NOTIFICATIONS_MAX = 5000;

// STORE STATE
// ===========

// Parses the generic config module's response into the camelCase shape this module's config
// form reads and writes. Bound to `moduleConfigSchema` on the module element below, where the
// generic `config-modules.store.ts` actually calls it - this is not a compile-time-only check.
export const NotificationsConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(NOTIFICATIONS_MODULE_NAME),
	retentionDays: z.number().int().min(RETENTION_DAYS_MIN).max(RETENTION_DAYS_MAX),
	maxNotifications: z.number().int().min(MAX_NOTIFICATIONS_MIN).max(MAX_NOTIFICATIONS_MAX),
});

// EDIT FORM
// =========

// The config edit form's model shape. `useConfigModuleEditForm`'s `submit()` also parses the
// live form model against this schema before sending the request, so these bounds are the actual
// gate - the `el-form` rules in `notifications-config-form.vue` exist for inline field feedback,
// not as the source of truth.
export const NotificationsConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	retentionDays: z.number().int().min(RETENTION_DAYS_MIN).max(RETENTION_DAYS_MAX),
	maxNotifications: z.number().int().min(MAX_NOTIFICATIONS_MIN).max(MAX_NOTIFICATIONS_MAX),
});

export type INotificationsConfigEditForm = z.infer<typeof NotificationsConfigEditFormSchema>;

// BACKEND API
// ===========

// Wire-shaped mirrors of the generated OpenAPI types. `moduleConfigUpdateReqSchema` is used by
// `config-modules.store.ts` to shape the PATCH body; `NotificationsConfigResSchema` is a
// compile-time-only cross-check against the generated response type, exactly as
// `WeatherConfigResSchema` is in the weather module - never wired into the module element itself.
export const NotificationsConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_MODULE_NAME),
		retention_days: z.number().int().min(RETENTION_DAYS_MIN).max(RETENTION_DAYS_MAX).optional(),
		max_notifications: z.number().int().min(MAX_NOTIFICATIONS_MIN).max(MAX_NOTIFICATIONS_MAX).optional(),
	})
);

export const NotificationsConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(NOTIFICATIONS_MODULE_NAME),
		retention_days: z.number(),
		max_notifications: z.number(),
	})
);
