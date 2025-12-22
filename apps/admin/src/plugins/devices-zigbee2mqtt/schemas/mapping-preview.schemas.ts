import { z } from 'zod';

import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';

// ============================================================================
// Request Schemas
// ============================================================================

export const MappingExposeOverrideSchema = z.object({
	exposeName: z.string(),
	channelCategory: z.nativeEnum(DevicesModuleChannelCategory).optional(),
	skip: z.boolean().optional(),
});

export const MappingPreviewRequestSchema = z.object({
	deviceCategory: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
	exposeOverrides: z.array(MappingExposeOverrideSchema).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const PropertyMappingPreviewSchema = z.object({
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	name: z.string(),
	z2mProperty: z.string(),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	unit: z.string().nullable().optional(),
	format: z.array(z.union([z.string(), z.number()])).nullable().optional(),
	required: z.boolean(),
	currentValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
});

export const SuggestedChannelSchema = z.object({
	category: z.nativeEnum(DevicesModuleChannelCategory),
	name: z.string(),
	confidence: z.enum(['high', 'medium', 'low']),
});

export const ExposeMappingPreviewSchema = z.object({
	exposeName: z.string(),
	exposeType: z.string(),
	status: z.enum(['mapped', 'partial', 'unmapped', 'skipped']),
	suggestedChannel: SuggestedChannelSchema.nullable(),
	suggestedProperties: z.array(PropertyMappingPreviewSchema),
	missingRequiredProperties: z.array(z.nativeEnum(DevicesModuleChannelPropertyCategory)),
});

export const MappingWarningSchema = z.object({
	type: z.enum([
		'missing_required_channel',
		'missing_required_property',
		'unsupported_expose',
		'device_not_available',
		'unknown_device_class',
	]),
	exposeName: z.string().optional(),
	message: z.string(),
	suggestion: z.string().optional(),
});

export const SuggestedDeviceSchema = z.object({
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	name: z.string(),
	confidence: z.enum(['high', 'medium', 'low']),
});

export const Z2mDeviceInfoSchema = z.object({
	ieeeAddress: z.string(),
	friendlyName: z.string(),
	manufacturer: z.string().nullable(),
	model: z.string().nullable(),
	description: z.string().nullable(),
});

export const MappingPreviewResponseSchema = z.object({
	z2mDevice: Z2mDeviceInfoSchema,
	suggestedDevice: SuggestedDeviceSchema,
	exposes: z.array(ExposeMappingPreviewSchema),
	warnings: z.array(MappingWarningSchema),
	readyToAdopt: z.boolean(),
});

// ============================================================================
// Adopt Device Request Schemas
// ============================================================================

export const AdoptPropertyDefinitionSchema = z.object({
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	z2mProperty: z.string(),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	unit: z.string().nullable().optional(),
	format: z.array(z.union([z.string(), z.number()])).nullable().optional(),
});

export const AdoptChannelDefinitionSchema = z.object({
	identifier: z.string().optional(),
	category: z.nativeEnum(DevicesModuleChannelCategory),
	name: z.string(),
	properties: z.array(AdoptPropertyDefinitionSchema),
});

export const AdoptDeviceRequestSchema = z.object({
	ieeeAddress: z.string(),
	name: z.string(),
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	description: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	enabled: z.boolean().default(true).optional(),
	channels: z.array(AdoptChannelDefinitionSchema),
});
