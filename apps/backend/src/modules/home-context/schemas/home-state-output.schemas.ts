import { z } from 'zod';

import { HOME_CONTEXT_LIMIT_PROFILES, HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

const limits = HOME_CONTEXT_LIMIT_PROFILES[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY];

const propertyValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const devicePropertySchema = z
	.object({
		id: z.string(),
		name: z.string().nullable(),
		category: z.string(),
		data_type: z.string(),
		unit: z.string().nullable(),
		value: propertyValueSchema,
		last_updated: z.string().nullable(),
		trend: z.string().nullable(),
	})
	.strict();

const deviceChannelSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		category: z.string(),
		properties: z.array(devicePropertySchema).max(limits.propertiesPerChannel),
		properties_truncated: z.boolean(),
	})
	.strict();

export const homeDeviceStateResultSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		category: z.string(),
		enabled: z.boolean(),
		room_id: z.string().nullable(),
		zone_ids: z.array(z.string()),
		status: z
			.object({
				online: z.boolean(),
				state: z.string(),
				last_changed: z.string().nullable(),
			})
			.strict(),
		channels: z.array(deviceChannelSchema).max(limits.channelsPerDevice),
		channels_truncated: z.boolean(),
	})
	.strict();

export const homePropertyTimeseriesResultSchema = z
	.object({
		property_id: z.string(),
		from: z.string(),
		to: z.string(),
		bucket: z.string().nullable(),
		points: z
			.array(
				z
					.object({
						time: z.string(),
						value: propertyValueSchema,
					})
					.strict(),
			)
			.max(limits.timeseriesPoints),
		truncated: z.boolean(),
	})
	.strict();

const energyMetricsSchema = z.object({
	from: z.string(),
	to: z.string(),
	totalConsumptionKwh: z.number(),
	totalProductionKwh: z.number(),
	totalGridImportKwh: z.number(),
	totalGridExportKwh: z.number(),
	hasGridMetrics: z.boolean(),
	lastUpdatedAt: z.string().nullable(),
});

export const homeEnergySummaryResultSchema = z.union([
	energyMetricsSchema.extend({ scope: z.object({ type: z.literal('home') }).strict() }).strict(),
	energyMetricsSchema
		.extend({
			scope: z.object({ type: z.literal('space'), id: z.string() }).strict(),
			netKwh: z.number(),
			netGridKwh: z.number(),
		})
		.strict(),
	energyMetricsSchema.extend({ scope: z.object({ type: z.literal('space'), id: z.string() }).strict() }).strict(),
]);

export const homeWeatherResultSchema = z
	.object({
		location_id: z.string().nullable(),
		location: z.unknown(),
		current: z.unknown(),
		forecast: z.array(z.unknown()).max(limits.forecastDays),
	})
	.strict();

const securityAlertSchema = z
	.object({
		id: z.string(),
		type: z.string(),
		severity: z.string(),
		timestamp: z.string(),
		acknowledged: z.boolean(),
		source_device_id: z.string().optional(),
		message: z.string().optional(),
	})
	.strict();

const securityLastEventSchema = z
	.object({
		type: z.string(),
		timestamp: z.string(),
		sourceDeviceId: z.string().optional(),
		severity: z.string().optional(),
	})
	.passthrough();

export const homeSecurityStatusResultSchema = z
	.object({
		armed_state: z.string().nullable(),
		alarm_state: z.string().nullable(),
		highest_severity: z.string(),
		active_alerts_count: z.number().int().nonnegative(),
		has_critical_alert: z.boolean(),
		active_alerts: z.array(securityAlertSchema).max(limits.securityAlerts),
		alerts_truncated: z.boolean(),
		devices_truncated: z.boolean(),
		channels_truncated: z.boolean(),
		properties_truncated: z.boolean(),
		state_truncated: z.boolean(),
		last_event: securityLastEventSchema.nullable(),
	})
	.strict();
