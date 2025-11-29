/**
 * OpenAPI extra models for Devices Home Assistant plugin
 */
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from './entities/devices-home-assistant.entity';
import { HomeAssistantConfigModel } from './models/config.model';
import {
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
	HomeAssistantEntityRegistryResponseModel,
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
} from './models/home-assistant-response.model';
import {
	HomeAssistantDeviceRegistryModel,
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantDiscoveredDeviceModel,
	HomeAssistantEntityRegistryModel,
	HomeAssistantEntityRegistryResultModel,
	HomeAssistantStateModel,
} from './models/home-assistant.model';

export const DEVICES_HOME_ASSISTANT_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Response models
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantEntityRegistryResponseModel,
	// Data models
	HomeAssistantStateModel,
	HomeAssistantDiscoveredDeviceModel,
	HomeAssistantEntityRegistryResultModel,
	HomeAssistantEntityRegistryModel,
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantDeviceRegistryModel,
	HomeAssistantConfigModel,
	// Entities
	HomeAssistantDeviceEntity,
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
];
