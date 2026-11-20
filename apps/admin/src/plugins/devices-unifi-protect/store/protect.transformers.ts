import type { ZodType } from 'zod';

import { logger, snakeToCamel } from '../../../common';
import type {
	DevicesUnifiProtectPluginDiscoverySchema,
	DevicesUnifiProtectPluginProbeSchema,
	DevicesUnifiProtectPluginStatusSchema,
	DevicesUnifiProtectPluginTestConnectionSchema,
} from '../../../openapi.constants';
import { ProtectValidationException } from '../devices-unifi-protect.exceptions';

import { ProtectDiscoverySchema, ProtectProbeSchema, ProtectStatusSchema, ProtectTestConnectionSchema } from './protect.schemas';
import type { IProtectDiscovery, IProtectProbe, IProtectStatus, IProtectTestConnection } from './protect.types';

const parse = <T>(value: unknown, schema: ZodType<T>, label: string): T => {
	const result = schema.safeParse(snakeToCamel(value as Record<string, unknown>));

	if (!result.success) {
		logger.error(`UniFi Protect ${label} schema validation failed:`, result.error);

		throw new ProtectValidationException(`Failed to validate UniFi Protect ${label}.`);
	}

	return result.data;
};

export const transformProtectStatus = (value: DevicesUnifiProtectPluginStatusSchema): IProtectStatus => parse(value, ProtectStatusSchema, 'status');

export const transformProtectTestConnection = (value: DevicesUnifiProtectPluginTestConnectionSchema): IProtectTestConnection =>
	parse(value, ProtectTestConnectionSchema, 'connection test');

export const transformProtectDiscovery = (value: DevicesUnifiProtectPluginDiscoverySchema): IProtectDiscovery =>
	parse(value, ProtectDiscoverySchema, 'discovery');

export const transformProtectProbe = (value: DevicesUnifiProtectPluginProbeSchema): IProtectProbe => parse(value, ProtectProbeSchema, 'probe');
