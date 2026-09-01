import { z } from 'zod';

import {
	ExtensionsModuleServiceActivationPolicy,
	ExtensionsModuleServiceDesiredState,
	ExtensionsModuleServiceOwnerKind,
	ExtensionsModuleServiceState,
} from '../../../openapi.constants';

export const ServiceSchema = z.object({
	extensionKind: z.nativeEnum(ExtensionsModuleServiceOwnerKind),
	extensionType: z.string(),
	serviceId: z.string(),
	activationPolicy: z.nativeEnum(ExtensionsModuleServiceActivationPolicy),
	state: z.nativeEnum(ExtensionsModuleServiceState),
	desiredState: z.nativeEnum(ExtensionsModuleServiceDesiredState),
	enabled: z.boolean(),
	healthy: z.boolean().optional(),
	lastStartedAt: z.string().optional(),
	lastStoppedAt: z.string().optional(),
	lastError: z.string().optional(),
	startCount: z.number(),
	uptimeMs: z.number().optional(),
});
