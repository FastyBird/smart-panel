import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

export const ScenesFilterSchema = z.object({
	search: z.string().optional(),
	categories: z.array(z.nativeEnum(SceneCategory)),
	primarySpaceId: z.union([z.string().uuid(), z.literal('whole_home')]).optional(),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
});
