import { z } from 'zod';

import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

const profileSchema = z.literal(HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY);

export const homeDeviceStateQuerySchema = z
	.object({
		deviceId: z.string(),
		profile: profileSchema,
	})
	.strict();

export const homePropertyTimeseriesQuerySchema = z
	.object({
		propertyId: z.string(),
		from: z.string(),
		to: z.string(),
		bucket: z.enum(['1m', '5m', '15m', '1h']),
		profile: profileSchema,
	})
	.strict();

export const homeEnergySummaryQuerySchema = z
	.object({
		from: z.string().optional(),
		to: z.string().optional(),
		spaceId: z.string().optional(),
		profile: profileSchema,
	})
	.strict();

export const homeWeatherQuerySchema = z
	.object({
		locationId: z.string().optional(),
		profile: profileSchema,
	})
	.strict();

export const homeSecurityStatusQuerySchema = z.object({ profile: profileSchema }).strict();
