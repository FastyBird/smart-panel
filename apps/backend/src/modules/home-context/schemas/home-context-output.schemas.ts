import { z } from 'zod';

import { HOME_CONTEXT_LIMIT_PROFILES, HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';

const limits = HOME_CONTEXT_LIMIT_PROFILES[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY];

const scopeSchema = z.union([
	z.object({ type: z.literal('home') }).strict(),
	z.object({ type: z.literal('space'), id: z.string(), name: z.string() }).strict(),
]);

const spaceSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		type: z.string(),
		parent_id: z.string().nullable(),
		device_count: z.number().int().nonnegative(),
	})
	.strict();

const deviceSchema = z
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
	})
	.strict();

const sceneSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		category: z.string(),
		enabled: z.boolean(),
		triggerable: z.boolean(),
		primary_space_id: z.string().nullable(),
	})
	.strict();

const weatherSchema = z
	.object({
		location_id: z.string().nullable(),
		location: z.unknown(),
		current: z.unknown(),
		forecast: z.array(z.unknown()).max(limits.forecastDays),
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

const energySchema = z.union([
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

const securitySchema = z
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

export const homeSnapshotResultSchema = z
	.object({
		scope: scopeSchema,
		spaces: z.array(spaceSchema).max(limits.spaces),
		devices: z.array(deviceSchema).max(limits.devices),
		scenes: z.array(sceneSchema).max(limits.scenes),
		weather: weatherSchema.nullable(),
		energy: energySchema.nullable(),
		security: securitySchema.nullable(),
		limits: z
			.object({
				spaces_truncated: z.boolean(),
				devices_truncated: z.boolean(),
				scenes_truncated: z.boolean(),
			})
			.strict(),
	})
	.strict();
