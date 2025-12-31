import { z } from 'zod';

import { SceneCategory } from '../scenes.constants';

export const ScenesFilterSchema = z.object({
	search: z.string().optional(),
	categories: z.array(z.nativeEnum(SceneCategory)),
	spaceId: z.string().uuid().optional(),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
});
