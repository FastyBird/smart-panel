import { z } from 'zod';

import {
	DevicesHomeyPluginAdoptionFailureCode,
	DevicesHomeyPluginAdoptionStatus,
	DevicesHomeyPluginConnectionState,
	DevicesHomeyPluginErrorCategory,
	DevicesHomeyPluginSupportReason,
	DevicesHomeyPluginSupportState,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';

export const HomeyStatusSchema = z.object({
	serviceState: z.string(),
	connectionState: z.nativeEnum(DevicesHomeyPluginConnectionState),
	enabled: z.boolean(),
	configured: z.boolean(),
	healthy: z.boolean(),
	degraded: z.boolean(),
	homeyId: z.string().nullable().optional(),
	homeyName: z.string().nullable().optional(),
	homeyVersion: z.string().nullable().optional(),
	lastConnectedAt: z.string().nullable().optional(),
	lastInventorySyncAt: z.string().nullable().optional(),
	lastEventAt: z.string().nullable().optional(),
	lastEventAgeMs: z.number().nullable().optional(),
	adoptedDeviceCount: z.number().int().nonnegative(),
	missingDeviceCount: z.number().int().nonnegative(),
	unsupportedDeviceCount: z.number().int().nonnegative(),
	unavailableDeviceCount: z.number().int().nonnegative(),
	reconnectCount: z.number().int().nonnegative(),
	reconciliationCount: z.number().int().nonnegative(),
	reconciliationFailureCount: z.number().int().nonnegative(),
	lastReconciliationDurationMs: z.number().nullable().optional(),
	lastErrorCategory: z.nativeEnum(DevicesHomeyPluginErrorCategory).nullable().optional(),
	lastError: z.string().nullable().optional(),
});

export const HomeyTestConnectionSchema = z.object({
	mode: z.enum(['saved', 'candidate']),
	success: z.boolean(),
	homeyId: z.string().nullable().optional(),
	homeyName: z.string().nullable().optional(),
	homeyVersion: z.string().nullable().optional(),
	errorCategory: z.nativeEnum(DevicesHomeyPluginErrorCategory).nullable().optional(),
	error: z.string().nullable().optional(),
});

export const HomeyCapabilitySchema = z.object({
	id: z.string(),
	baseId: z.string(),
	type: z.enum(['boolean', 'number', 'string', 'enum', 'unknown']),
	unit: z.string().nullable().optional(),
	readable: z.boolean(),
	writable: z.boolean(),
	available: z.boolean().nullable().optional(),
});

export const HomeyInventoryDeviceSchema = z.object({
	id: z.string(),
	name: z.string(),
	class: z.string(),
	zoneId: z.string().nullable().optional(),
	zoneName: z.string().nullable().optional(),
	zonePath: z.array(z.string()),
	available: z.boolean(),
	driverId: z.string().nullable().optional(),
	manufacturer: z.string().nullable().optional(),
	model: z.string().nullable().optional(),
	capabilities: z.array(HomeyCapabilitySchema),
	supportState: z.nativeEnum(DevicesHomeyPluginSupportState),
	supportReasons: z.array(z.nativeEnum(DevicesHomeyPluginSupportReason)),
	suggestedCategory: z.nativeEnum(DevicesModuleDeviceCategory).nullable().optional(),
	adopted: z.boolean(),
	adoptedDeviceId: z.string().uuid().nullable().optional(),
});

const HomeyPreviewRangeSchema = z.object({
	minimum: z.number().nullable().optional(),
	maximum: z.number().nullable().optional(),
	step: z.number().nullable().optional(),
});

const HomeyPreviewConversionSchema = z.object({
	type: z.enum(['identity', 'scale', 'map', 'boolean', 'clamp', 'round', 'constant', 'threshold', 'thresholds']),
	reversible: z.boolean(),
	lossy: z.boolean(),
	ambiguous: z.boolean(),
	inputRange: z.array(z.number()).nullable().optional(),
	outputRange: z.array(z.number()).nullable().optional(),
	clamp: z.boolean().nullable().optional(),
	minimum: z.number().nullable().optional(),
	maximum: z.number().nullable().optional(),
	precision: z.number().nullable().optional(),
	readTableSize: z.number().nullable().optional(),
	writeTableSize: z.number().nullable().optional(),
});

const HomeyPreviewPropertySchema = z.object({
	capabilityId: z.string(),
	capabilityBaseId: z.string(),
	mappingName: z.string(),
	mappingSource: z.enum(['builtin', 'user']),
	category: z.string(),
	dataType: z.string(),
	direction: z.enum(['read_only', 'write_only', 'bidirectional']),
	permissions: z.array(z.string()),
	readable: z.boolean(),
	writable: z.boolean(),
	unit: z.string().nullable().optional(),
	range: HomeyPreviewRangeSchema.optional(),
	sourceRange: HomeyPreviewRangeSchema.optional(),
	enumValues: z.array(z.string()),
	panelEnumValues: z.array(z.string()),
	currentValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
	valueAvailable: z.boolean(),
	capabilityAvailable: z.boolean().nullable().optional(),
	conversion: HomeyPreviewConversionSchema,
});

export const HomeyMappingPreviewSchema = z.object({
	device: z.object({
		id: z.string(),
		name: z.string(),
		class: z.string(),
		zoneId: z.string().nullable().optional(),
		zonePath: z.array(z.string()),
		available: z.boolean(),
	}),
	suggestedCategory: z.nativeEnum(DevicesModuleDeviceCategory).nullable().optional(),
	selectedCategory: z.nativeEnum(DevicesModuleDeviceCategory).nullable().optional(),
	validCategories: z.array(z.nativeEnum(DevicesModuleDeviceCategory)),
	channels: z.array(
		z.object({
			identifier: z.string(),
			mappingName: z.string(),
			mappingSource: z.enum(['builtin', 'user']),
			category: z.string(),
			name: z.string(),
			properties: z.array(HomeyPreviewPropertySchema),
		})
	),
	unsupportedCapabilityIds: z.array(z.string()),
	warnings: z.array(
		z.object({
			code: z.string(),
			severity: z.string(),
			scope: z.enum(['device', 'channel', 'capability', 'conversion']),
			identifier: z.string().nullable().optional(),
			mappingNames: z.array(z.string()),
			message: z.string(),
		})
	),
	readyToAdopt: z.boolean(),
});

export const HomeyAdoptionResultSchema = z.object({
	deviceId: z.string(),
	status: z.nativeEnum(DevicesHomeyPluginAdoptionStatus),
	panelDeviceId: z.string().uuid().nullable().optional(),
	failureCode: z.nativeEnum(DevicesHomeyPluginAdoptionFailureCode).nullable().optional(),
	message: z.string().nullable().optional(),
});
