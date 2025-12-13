import { z } from 'zod';

import { ExtensionKind } from '../extensions.constants';

export const ExtensionsFilterSchema = z.object({
	search: z.string().optional(),
	kind: z.enum(['all', ExtensionKind.MODULE, ExtensionKind.PLUGIN]).default('all'),
	enabled: z.enum(['all', 'enabled', 'disabled']).default('all'),
	isCore: z.enum(['all', 'core', 'addon']).default('all'),
});
