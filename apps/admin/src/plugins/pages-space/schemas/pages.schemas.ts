import { z } from 'zod';

import { PageAddFormSchema, PageEditFormSchema } from '../../../modules/dashboard';
import { QuickActionType } from '../pages-space.constants';

export const SpacePageAddFormSchema = PageAddFormSchema.extend({
	space: z.string().uuid().optional(),
	viewMode: z.enum(['simple', 'advanced']).optional().nullable(),
	quickActions: z.array(z.nativeEnum(QuickActionType)).optional().nullable(),
});

export const SpacePageEditFormSchema = PageEditFormSchema.extend({
	space: z.string().uuid(),
	viewMode: z.enum(['simple', 'advanced']).optional().nullable(),
	quickActions: z.array(z.nativeEnum(QuickActionType)).optional().nullable(),
});
