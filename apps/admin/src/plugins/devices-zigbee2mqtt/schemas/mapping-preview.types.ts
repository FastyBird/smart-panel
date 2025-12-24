import { z } from 'zod';

import {
	AdoptChannelDefinitionSchema,
	AdoptDeviceRequestSchema,
	AdoptPropertyDefinitionSchema,
	ExposeMappingPreviewSchema,
	MappingExposeOverrideSchema,
	MappingPreviewRequestSchema,
	MappingPreviewResponseSchema,
	MappingWarningSchema,
	PropertyMappingPreviewSchema,
	SuggestedChannelSchema,
	SuggestedDeviceSchema,
	Z2mDeviceInfoSchema,
} from './mapping-preview.schemas';

// ============================================================================
// Request Types
// ============================================================================

export type IMappingExposeOverride = z.infer<typeof MappingExposeOverrideSchema>;

export type IMappingPreviewRequest = z.infer<typeof MappingPreviewRequestSchema>;

// ============================================================================
// Response Types
// ============================================================================

export type IPropertyMappingPreview = z.infer<typeof PropertyMappingPreviewSchema>;

export type ISuggestedChannel = z.infer<typeof SuggestedChannelSchema>;

export type IExposeMappingPreview = z.infer<typeof ExposeMappingPreviewSchema>;

export type IMappingWarning = z.infer<typeof MappingWarningSchema>;

export type ISuggestedDevice = z.infer<typeof SuggestedDeviceSchema>;

export type IZ2mDeviceInfo = z.infer<typeof Z2mDeviceInfoSchema>;

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

export type ExposeMappingStatus = 'mapped' | 'partial' | 'unmapped' | 'skipped';

export type MappingConfidence = 'high' | 'medium' | 'low';

export type MappingWarningType =
	| 'missing_required_channel'
	| 'missing_required_property'
	| 'unsupported_expose'
	| 'device_not_available'
	| 'unknown_device_class';
