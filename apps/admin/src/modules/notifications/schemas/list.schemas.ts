import { z } from 'zod';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

// `useListQuery` hands a plain scalar straight through from `route.query` for any field whose
// schema is not a `ZodArray` - on a fresh load that is the raw string `"true"`/`"false"`, not a
// real boolean. A bare `z.boolean()` would fail to parse that string and, because `useListQuery`
// falls back to defaults for the *whole* filter object on a parse failure, silently reset every
// other filter too. Accepting both shapes here keeps the round trip safe in both directions: a
// real boolean when the switch is toggled in memory, the URL's string form when it is restored.
const BooleanFilterFlagSchema = z.union([z.boolean(), z.enum(['true', 'false'])]).transform((value) => value === true || value === 'true');

export const NotificationsFilterSchema = z.object({
	status: z.enum(['all', 'active', 'dismissed', 'resolved']).default('all'),
	severity: z.array(z.nativeEnum(NotificationsModuleNotificationSeverity)).default([]),
	source: z.string().optional(),
	unread: BooleanFilterFlagSchema.default(false),
});

export type INotificationsFilter = z.infer<typeof NotificationsFilterSchema>;
