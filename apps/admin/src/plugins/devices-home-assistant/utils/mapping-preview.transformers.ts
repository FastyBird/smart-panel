import { camelToSnake, logger, snakeToCamel } from '../../../common';
import { DevicesHomeAssistantValidationException } from '../devices-home-assistant.exceptions';
import {
	AdoptDeviceRequestSchema,
	EntityMappingPreviewSchema,
	HaDeviceInfoSchema,
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
