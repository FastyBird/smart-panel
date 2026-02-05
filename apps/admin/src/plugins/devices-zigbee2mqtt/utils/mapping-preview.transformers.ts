import type {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyDataType,
	DevicesModuleChannelPropertyPermissions,
	DevicesModuleDeviceCategory,
} from '../../../openapi.constants';
import type {
	IAdoptChannelDefinition,
	IAdoptDeviceRequest,
	IAdoptPropertyDefinition,
	IExposeMappingPreview,
	IMappingExposeOverride,
	IMappingPreviewRequest,
	IMappingPreviewResponse,
	IMappingWarning,
	IPropertyMappingPreview,
	ISuggestedChannel,
	ISuggestedDevice,
	IZ2mDeviceInfo,
} from '../schemas/mapping-preview.types';

// ============================================================================
// Request Transformers
// ============================================================================

interface ApiMappingPreviewRequestData {
	device_category?: string;
	expose_overrides?: Array<{
		expose_name: string;
		channel_category?: string;
		skip?: boolean;
	}>;
}

interface ApiMappingPreviewRequest {
	data?: ApiMappingPreviewRequestData;
}

export const transformMappingPreviewRequest = (request: IMappingPreviewRequest): ApiMappingPreviewRequest => {
	return {
		data: {
			device_category: request.deviceCategory,
			expose_overrides: request.exposeOverrides?.map((override) => ({
				expose_name: override.exposeName,
				channel_category: override.channelCategory,
				skip: override.skip,
			})),
		},
	};
};

interface ApiAdoptDeviceRequestData {
	ieee_address: string;
	name: string;
	category: string;
	description?: string | null;
	enabled?: boolean;
	channels: Array<{
		identifier?: string;
		category: string;
		name: string;
		properties: Array<{
			category: string;
			z2m_property: string;
			data_type: string;
			permissions: string[];
			format?: (string | number)[] | null;
		}>;
	}>;
}

interface ApiAdoptDeviceRequest {
	data: ApiAdoptDeviceRequestData;
}

export const transformAdoptDeviceRequest = (request: IAdoptDeviceRequest): ApiAdoptDeviceRequest => {
	return {
		data: {
			ieee_address: request.ieeeAddress,
			name: request.name,
			category: request.category,
			description: request.description,
			enabled: request.enabled,
			channels: request.channels.map((channel) => ({
				identifier: channel.identifier,
				category: channel.category,
				name: channel.name,
				properties: channel.properties.map((prop) => ({
					category: prop.category,
					z2m_property: prop.z2mProperty,
					data_type: prop.dataType,
					permissions: prop.permissions,
					format: prop.format,
				})),
			})),
		},
	};
};

// ============================================================================
// Response Transformers
// ============================================================================

interface ApiZ2mDeviceInfo {
	ieee_address: string;
	friendly_name: string;
	manufacturer?: string | null;
	model?: string | null;
	description?: string | null;
}

interface ApiSuggestedDevice {
	category: string;
	name: string;
	confidence: 'high' | 'medium' | 'low';
}

interface ApiSuggestedChannel {
	category: string;
	name: string;
	confidence: 'high' | 'medium' | 'low';
}

interface ApiPropertyMappingPreview {
	category: string;
	name: string;
	z2m_property: string;
	data_type: string;
	permissions: string[];
	format?: (string | number)[] | null;
	required: boolean;
	current_value?: string | number | boolean | null;
}

interface ApiExposeMappingPreview {
	expose_name: string;
	expose_type: string;
	status: 'mapped' | 'partial' | 'unmapped' | 'skipped';
	suggested_channel?: ApiSuggestedChannel | null;
	suggested_properties: ApiPropertyMappingPreview[];
	missing_required_properties: string[];
}

interface ApiMappingWarning {
	type: string;
	expose_name?: string;
	message: string;
	suggestion?: string;
}

interface ApiMappingPreviewResponse {
	z2m_device: ApiZ2mDeviceInfo;
	suggested_device: ApiSuggestedDevice;
	exposes: ApiExposeMappingPreview[];
	warnings: ApiMappingWarning[];
	ready_to_adopt: boolean;
}

const transformZ2mDeviceInfo = (info: ApiZ2mDeviceInfo): IZ2mDeviceInfo => ({
	ieeeAddress: info.ieee_address,
	friendlyName: info.friendly_name,
	manufacturer: info.manufacturer ?? null,
	model: info.model ?? null,
	description: info.description ?? null,
});

const transformSuggestedDevice = (device: ApiSuggestedDevice): ISuggestedDevice => ({
	category: device.category as DevicesModuleDeviceCategory,
	name: device.name,
	confidence: device.confidence,
});

const transformSuggestedChannel = (channel: ApiSuggestedChannel): ISuggestedChannel => ({
	category: channel.category as DevicesModuleChannelCategory,
	name: channel.name,
	confidence: channel.confidence,
});

const transformPropertyMappingPreview = (prop: ApiPropertyMappingPreview): IPropertyMappingPreview => ({
	category: prop.category as DevicesModuleChannelPropertyCategory,
	name: prop.name,
	z2mProperty: prop.z2m_property,
	dataType: prop.data_type as DevicesModuleChannelPropertyDataType,
	permissions: prop.permissions as DevicesModuleChannelPropertyPermissions[],
	format: prop.format ?? null,
	required: prop.required,
	currentValue: prop.current_value ?? null,
});

const transformExposeMappingPreview = (expose: ApiExposeMappingPreview): IExposeMappingPreview => ({
	exposeName: expose.expose_name,
	exposeType: expose.expose_type,
	status: expose.status,
	suggestedChannel: expose.suggested_channel ? transformSuggestedChannel(expose.suggested_channel) : null,
	suggestedProperties: expose.suggested_properties.map(transformPropertyMappingPreview),
	missingRequiredProperties: expose.missing_required_properties as DevicesModuleChannelPropertyCategory[],
});

const transformMappingWarning = (warning: ApiMappingWarning): IMappingWarning => ({
	type: warning.type as IMappingWarning['type'],
	exposeName: warning.expose_name,
	message: warning.message,
	suggestion: warning.suggestion,
});

export const transformMappingPreviewResponse = (response: ApiMappingPreviewResponse): IMappingPreviewResponse => ({
	z2mDevice: transformZ2mDeviceInfo(response.z2m_device),
	suggestedDevice: transformSuggestedDevice(response.suggested_device),
	exposes: response.exposes.map(transformExposeMappingPreview),
	warnings: response.warnings.map(transformMappingWarning),
	readyToAdopt: response.ready_to_adopt,
});

// ============================================================================
// Adopt Device Response Transformer
// ============================================================================

export const transformAdoptChannelDefinition = (channel: IAdoptChannelDefinition): IAdoptChannelDefinition => channel;

export const transformAdoptPropertyDefinition = (property: IAdoptPropertyDefinition): IAdoptPropertyDefinition =>
	property;

// ============================================================================
// Helper: Build adopt request from preview and overrides
// ============================================================================

export const buildAdoptDeviceRequest = (
	ieeeAddress: string,
	name: string,
	category: DevicesModuleDeviceCategory,
	description: string | null | undefined,
	enabled: boolean,
	preview: IMappingPreviewResponse,
	exposeOverrides: IMappingExposeOverride[]
): IAdoptDeviceRequest => {
	// Build override lookup
	const overrideMap = new Map(exposeOverrides.map((o) => [o.exposeName, o]));

	// Group exposes by channel category
	const channelMap = new Map<DevicesModuleChannelCategory, IAdoptChannelDefinition>();

	for (const expose of preview.exposes) {
		const override = overrideMap.get(expose.exposeName);

		// Skip if explicitly skipped
		if (override?.skip) {
			continue;
		}

		// Skip if no suggested channel
		if (!expose.suggestedChannel) {
			continue;
		}

		const channelCategory = (override?.channelCategory ?? expose.suggestedChannel.category) as DevicesModuleChannelCategory;
		const channelName = expose.suggestedChannel.name;

		// Get or create channel
		let channel = channelMap.get(channelCategory);
		if (!channel) {
			channel = {
				identifier: channelCategory.toLowerCase(),
				category: channelCategory,
				name: channelName,
				properties: [],
			};
			channelMap.set(channelCategory, channel);
		}

		// Add properties from this expose
		for (const prop of expose.suggestedProperties) {
			channel.properties.push({
				category: prop.category,
				z2mProperty: prop.z2mProperty,
				dataType: prop.dataType,
				permissions: prop.permissions,
				format: prop.format,
			});
		}
	}

	return {
		ieeeAddress,
		name,
		category,
		description,
		enabled,
		channels: Array.from(channelMap.values()),
	};
};
