import { z } from 'zod';

import { AutomationStatus, WHOLE_HOME_SPACE_FILTER } from '../automations.constants';

export const AutomationsFilterSchema = z.object({
	search: z.string().optional(),
	spaceId: z.union([z.string().uuid(), z.literal(WHOLE_HOME_SPACE_FILTER)]).optional(),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
	statuses: z.array(z.nativeEnum(AutomationStatus)),
});
