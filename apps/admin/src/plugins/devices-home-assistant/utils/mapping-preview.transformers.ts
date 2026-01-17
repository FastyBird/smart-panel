import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import {
	AdoptDeviceRequestSchema,
	EntityMappingPreviewSchema,
	HaDeviceInfoSchema,
	HelperMappingPreviewResponseSchema,
	MappingPreviewRequestSchema,
	MappingPreviewResponseSchema,
	PropertyMappingPreviewSchema,
	SuggestedChannelSchema,
	SuggestedDeviceSchema,
} from '../schemas/mapping-preview.schemas';
import type {
	IAdoptDeviceRequest,
	IEntityMappingPreview,
	IHaDeviceInfo,
	IMappingPreviewRequest,
	IMappingPreviewResponse,
	IPropertyMappingPreview,
	ISuggestedChannel,
	ISuggestedDevice,
} from '../schemas/mapping-preview.types';

// ============================================================================
// Request Transformers
// ============================================================================

export const transformMappingPreviewRequest = (data: IMappingPreviewRequest): object => {
	const parsed = MappingPreviewRequestSchema.safeParse(data);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate mapping preview request.');
	}

	return camelToSnake(parsed.data);
};

export const transformAdoptDeviceRequest = (data: IAdoptDeviceRequest): object => {
	const parsed = AdoptDeviceRequestSchema.safeParse(data);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate adopt device request.');
	}

	return camelToSnake(parsed.data);
};

/**
 * Transform adopt device request to helper adoption format.
 * Helper adoption uses entity_id instead of ha_device_id and has a single channel.
 */
export const transformAdoptHelperRequest = (data: IAdoptDeviceRequest): object => {
	const parsed = AdoptDeviceRequestSchema.safeParse(data);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate adopt helper request.');
	}

	// Transform to helper adoption format
	// Helper uses entityId instead of haDeviceId, and has a simplified structure
	const helperRequest = {
		entity_id: parsed.data.haDeviceId, // haDeviceId contains the entity_id for helpers
		name: parsed.data.name,
		category: parsed.data.category,
		description: parsed.data.description ?? null,
		enabled: parsed.data.enabled ?? true,
		channels: parsed.data.channels.map((channel) => ({
			category: channel.category,
			name: channel.name,
			properties: channel.properties.map((prop) => ({
				category: prop.category,
				ha_attribute: prop.haAttribute,
				data_type: prop.dataType,
				permissions: prop.permissions,
				unit: prop.unit ?? null,
				format: prop.format ?? null,
				ha_transformer: prop.haTransformer ?? null,
			})),
		})),
	};

	return helperRequest;
};

// ============================================================================
// Response Transformers
// ============================================================================

export const transformMappingPreviewResponse = (response: object): IMappingPreviewResponse => {
	const parsed = MappingPreviewResponseSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate mapping preview response.');
	}

	return parsed.data;
};

export const transformPropertyMappingPreviewResponse = (response: object): IPropertyMappingPreview => {
	const parsed = PropertyMappingPreviewSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate property mapping preview response.');
	}

	return parsed.data;
};

export const transformSuggestedChannelResponse = (response: object): ISuggestedChannel => {
	const parsed = SuggestedChannelSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate suggested channel response.');
	}

	return parsed.data;
};

export const transformEntityMappingPreviewResponse = (response: object): IEntityMappingPreview => {
	const parsed = EntityMappingPreviewSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate entity mapping preview response.');
	}

	return parsed.data;
};

export const transformHaDeviceInfoResponse = (response: object): IHaDeviceInfo => {
	const parsed = HaDeviceInfoSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate HA device info response.');
	}

	return parsed.data;
};

export const transformSuggestedDeviceResponse = (response: object): ISuggestedDevice => {
	const parsed = SuggestedDeviceSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate suggested device response.');
	}

	return parsed.data;
};

/**
 * Transform helper mapping preview response to match device mapping preview structure.
 * This normalizes helper responses to use the same interface as device responses.
 * For helpers with multiple channels (like climate entities), each channel becomes
 * a separate "entity" in the normalized response to work with the existing UI.
 */
export const transformHelperMappingPreviewResponse = (response: object): IMappingPreviewResponse => {
	// Validate raw response structure first to catch malformed data early
	const parsedHelper = HelperMappingPreviewResponseSchema.safeParse(snakeToCamel(response));

	if (!parsedHelper.success) {
		logger.error('Helper mapping preview response validation failed with:', parsedHelper.error);

		throw new DevicesHomeAssistantValidationException('Failed to validate helper mapping preview response.');
	}

	const camelResponse = parsedHelper.data;

	// Use suggestedChannels if available, otherwise fall back to single suggestedChannel
	const channels = camelResponse.suggestedChannels ?? [camelResponse.suggestedChannel];

	// Transform to device mapping preview format
	// Each channel becomes a separate "entity" entry for UI compatibility
	const entities: IEntityMappingPreview[] = channels.map((channel, index) => ({
		// Use a unique entityId for each channel to differentiate them in the UI
		// The first channel uses the original entityId, subsequent ones append the channel category
		entityId: index === 0 ? camelResponse.helper.entityId : `${camelResponse.helper.entityId}#${channel.category}`,
		domain: camelResponse.helper.domain,
		deviceClass: null,
		currentState: channel.suggestedProperties[0]?.currentValue ?? null,
		attributes: {},
		status: 'mapped' as const,
		suggestedChannel: {
			category: channel.category as ISuggestedChannel['category'],
			name: channel.name,
			confidence: channel.confidence as ISuggestedChannel['confidence'],
		},
		suggestedProperties: channel.suggestedProperties.map((prop) => ({
			category: prop.category as IPropertyMappingPreview['category'],
			name: prop.name,
			haAttribute: prop.haAttribute,
			dataType: prop.dataType as IPropertyMappingPreview['dataType'],
			permissions: prop.permissions as IPropertyMappingPreview['permissions'],
			unit: prop.unit ?? null,
			format: prop.format ?? null,
			required: prop.required,
			currentValue: prop.currentValue ?? null,
			// All properties map back to the original entity
			haEntityId: camelResponse.helper.entityId,
			// Include transformer from YAML mapping if specified
			haTransformer: prop.haTransformer ?? null,
		})),
		unmappedAttributes: [],
		missingRequiredProperties: [],
	}));

	const normalizedResponse: IMappingPreviewResponse = {
		haDevice: {
			id: camelResponse.helper.entityId,
			name: camelResponse.helper.name,
			manufacturer: 'Home Assistant',
			model: `Helper (${camelResponse.helper.domain})`,
		},
		suggestedDevice: {
			category: camelResponse.suggestedDevice.category as ISuggestedDevice['category'],
			name: camelResponse.suggestedDevice.name,
			confidence: camelResponse.suggestedDevice.confidence as ISuggestedDevice['confidence'],
		},
		entities,
		warnings: camelResponse.warnings.map((w) => ({
			type: w.type as IMappingPreviewResponse['warnings'][0]['type'],
			entityId: camelResponse.helper.entityId,
			message: w.message,
			suggestion: w.suggestion,
		})),
		readyToAdopt: camelResponse.readyToAdopt,
	};

	// Validate the normalized response
	const parsed = MappingPreviewResponseSchema.safeParse(normalizedResponse);

	if (!parsed.success) {
		logger.error('Helper response normalization failed with:', parsed.error);

		throw new DevicesHomeAssistantValidationException('Failed to normalize helper mapping preview response.');
	}

	return parsed.data;
};
