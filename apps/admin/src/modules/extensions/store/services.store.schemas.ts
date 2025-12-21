import { z } from 'zod';

import { ExtensionsModuleServiceState } from '../../../openapi.constants';

export const ServiceSchema = z.object({
	pluginName: z.string(),
	serviceId: z.string(),
	state: z.nativeEnum(ExtensionsModuleServiceState),
	enabled: z.boolean(),
	healthy: z.boolean().optional(),
	lastStartedAt: z.string().optional(),
	lastStoppedAt: z.string().optional(),
	lastError: z.string().optional(),
	startCount: z.number(),
	uptimeMs: z.number().optional(),
});
