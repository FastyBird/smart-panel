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

export const MappingEntityOverrideSchema = z.object({
	entityId: z.string(),
	channelCategory: z.nativeEnum(DevicesModuleChannelCategory).optional(),
	skip: z.boolean().optional(),
});

export const MappingPreviewRequestSchema = z.object({
	deviceCategory: z.nativeEnum(DevicesModuleDeviceCategory).optional(),
	entityOverrides: z.array(MappingEntityOverrideSchema).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const VirtualPropertyTypeSchema = z.enum(['static', 'derived', 'command']);

export const PropertyMappingPreviewSchema = z.object({
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	name: z.string(),
	haAttribute: z.string(),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	unit: z.string().nullable().optional(),
	format: z.array(z.union([z.string(), z.number()])).nullable().optional(),
	required: z.boolean(),
	currentValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
	haEntityId: z.string().nullable().optional(),
	isVirtual: z.boolean().optional(),
	virtualType: VirtualPropertyTypeSchema.nullable().optional(),
});

export const SuggestedChannelSchema = z.object({
	category: z.nativeEnum(DevicesModuleChannelCategory),
	name: z.string(),
	confidence: z.enum(['high', 'medium', 'low']),
});

export const EntityMappingPreviewSchema = z.object({
	entityId: z.string(),
	domain: z.string(),
	deviceClass: z.string().nullable(),
	currentState: z.union([z.string(), z.number(), z.boolean()]).nullable(),
	attributes: z.record(z.unknown()),
	status: z.enum(['mapped', 'partial', 'unmapped', 'skipped', 'incompatible']),
	suggestedChannel: SuggestedChannelSchema.nullable(),
	suggestedProperties: z.array(PropertyMappingPreviewSchema),
	unmappedAttributes: z.array(z.string()),
	missingRequiredProperties: z.array(z.nativeEnum(DevicesModuleChannelPropertyCategory)),
	incompatibleReason: z.string().nullable().optional(),
});

export const MappingWarningSchema = z.object({
	type: z.enum([
		'missing_required_channel',
		'missing_required_property',
		'unsupported_entity',
		'unknown_device_class',
		'no_mapping_rule',
		'incompatible_channel',
	]),
	entityId: z.string().optional(),
	message: z.string(),
	suggestion: z.string().optional(),
});

export const SuggestedDeviceSchema = z.object({
	category: z.nativeEnum(DevicesModuleDeviceCategory),
	name: z.string(),
	confidence: z.enum(['high', 'medium', 'low']),
});

export const HaDeviceInfoSchema = z.object({
	id: z.string(),
	name: z.string(),
	manufacturer: z.string().nullable(),
	model: z.string().nullable(),
});

export const ValidationSummarySchema = z.object({
	isValid: z.boolean(),
	missingChannelsCount: z.number(),
	missingPropertiesCount: z.number(),
	fillableWithVirtualCount: z.number(),
	missingChannels: z.array(z.string()),
	missingProperties: z.record(z.array(z.string())),
	autoFilledVirtual: z.record(z.array(z.string())),
	unknownChannels: z.array(z.string()),
	duplicateChannels: z.array(z.string()),
	constraintViolations: z.array(z.string()),
});

export const MappingPreviewResponseSchema = z.object({
	haDevice: HaDeviceInfoSchema,
	suggestedDevice: SuggestedDeviceSchema,
	entities: z.array(EntityMappingPreviewSchema),
	warnings: z.array(MappingWarningSchema),
	readyToAdopt: z.boolean(),
	validation: ValidationSummarySchema.optional(),
});

// ============================================================================
// Adopt Device Request Schemas
// ============================================================================

export const AdoptPropertyDefinitionSchema = z.object({
	category: z.nativeEnum(DevicesModuleChannelPropertyCategory),
	haAttribute: z.string(),
	dataType: z.nativeEnum(DevicesModuleChannelPropertyDataType),
	permissions: z.array(z.nativeEnum(DevicesModuleChannelPropertyPermissions)),
	unit: z.string().nullable().optional(),
	format: z.array(z.union([z.string(), z.number()])).nullable().optional(),
	haEntityId: z.string().optional(),
});

export const AdoptChannelDefinitionSchema = z.object({
	entityId: z.string(),
	category: z.nativeEnum(DevicesModuleChannelCategory),
	name: z.string(),
	properties: z.array(AdoptPropertyDefinitionSchema),
});

export const AdoptDeviceRequestSchema = z.object({
	haDeviceId: z.string(),
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

// ============================================================================
// Helper Mapping Preview Schemas
// ============================================================================

const HelperPropertyMappingSchema = z.object({
	category: z.string(),
	name: z.string(),
	haAttribute: z.string(),
	dataType: z.string(),
	permissions: z.array(z.string()),
	unit: z.string().nullable().optional(),
	format: z.array(z.union([z.string(), z.number()])).nullable().optional(),
	required: z.boolean(),
	currentValue: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
});

const HelperChannelMappingSchema = z.object({
	category: z.string(),
	name: z.string(),
	confidence: z.string(),
	suggestedProperties: z.array(HelperPropertyMappingSchema),
});

export const HelperMappingPreviewResponseSchema = z.object({
	helper: z.object({
		entityId: z.string(),
		name: z.string(),
		domain: z.string(),
	}),
	suggestedDevice: z.object({
		category: z.string(),
		name: z.string(),
		confidence: z.string(),
	}),
	suggestedChannel: HelperChannelMappingSchema,
	suggestedChannels: z.array(HelperChannelMappingSchema).optional(),
	warnings: z.array(
		z.object({
			type: z.string(),
			message: z.string(),
			suggestion: z.string().optional(),
		})
	),
	readyToAdopt: z.boolean(),
});
