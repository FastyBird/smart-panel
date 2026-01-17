import { z } from 'zod';

import {
	AdoptChannelDefinitionSchema,
	AdoptDeviceRequestSchema,
	AdoptPropertyDefinitionSchema,
	EntityMappingPreviewSchema,
	HaDeviceInfoSchema,
	MappingEntityOverrideSchema,
	MappingPreviewRequestSchema,
	MappingPreviewResponseSchema,
	MappingWarningSchema,
	PropertyMappingPreviewSchema,
	SuggestedChannelSchema,
	SuggestedDeviceSchema,
	ValidationSummarySchema,
	VirtualPropertyTypeSchema,
} from './mapping-preview.schemas';

// ============================================================================
// Request Types
// ============================================================================

export type IMappingEntityOverride = z.infer<typeof MappingEntityOverrideSchema>;

export type IMappingPreviewRequest = z.infer<typeof MappingPreviewRequestSchema>;

// ============================================================================
// Response Types
// ============================================================================

export type IPropertyMappingPreview = z.infer<typeof PropertyMappingPreviewSchema>;

export type ISuggestedChannel = z.infer<typeof SuggestedChannelSchema>;

export type IEntityMappingPreview = z.infer<typeof EntityMappingPreviewSchema>;

export type IMappingWarning = z.infer<typeof MappingWarningSchema>;

export type ISuggestedDevice = z.infer<typeof SuggestedDeviceSchema>;

export type IHaDeviceInfo = z.infer<typeof HaDeviceInfoSchema>;

export type IMappingPreviewResponse = z.infer<typeof MappingPreviewResponseSchema>;

// ============================================================================
// Adopt Device Request Types
// ============================================================================

export type IAdoptPropertyDefinition = z.infer<typeof AdoptPropertyDefinitionSchema>;

export type IAdoptChannelDefinition = z.infer<typeof AdoptChannelDefinitionSchema>;

export type IAdoptDeviceRequest = z.infer<typeof AdoptDeviceRequestSchema>;

// ============================================================================
// Helper Types
// ============================================================================

export type EntityMappingStatus = 'mapped' | 'partial' | 'unmapped' | 'skipped' | 'incompatible';

export type MappingConfidence = 'high' | 'medium' | 'low';

export type MappingWarningType =
	| 'missing_required_channel'
	| 'missing_required_property'
	| 'unsupported_entity'
	| 'unknown_device_class'
	| 'no_mapping_rule'
	| 'incompatible_channel';

export type IVirtualPropertyType = z.infer<typeof VirtualPropertyTypeSchema>;

export type IValidationSummary = z.infer<typeof ValidationSummarySchema>;
