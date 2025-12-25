import { z } from 'zod';

import { SpaceType } from '../spaces.constants';

export const SpacesFilterSchema = z.object({
	search: z.string().optional(),
	type: z.union([z.nativeEnum(SpaceType), z.literal('all')]).default('all'),
});

export type SpacesFilterSchemaType = z.infer<typeof SpacesFilterSchema>;
