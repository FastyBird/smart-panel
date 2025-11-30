/**
 * OpenAPI extra models for Devices Home Assistant plugin
 */
import { CreateHomeAssistantChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeAssistantChannelDto } from './dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from './dto/create-device.dto';
import { HomeAssistantDiscoveredDeviceDto } from './dto/home-assistant-discovered-device.dto';
import { HomeAssistantServiceRequestDto } from './dto/home-assistant-service-request.dto';
import {
	HomeAssistantStateChangedEventDataDto,
	HomeAssistantStateChangedEventDto,
	HomeAssistantStateDto,
} from './dto/home-assistant-state.dto';
import { UpdateHomeAssistantChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeAssistantChannelDto } from './dto/update-channel.dto';
import { HomeAssistantUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeAssistantDeviceDto } from './dto/update-device.dto';
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
	// DTOs
	CreateHomeAssistantDeviceDto,
	UpdateHomeAssistantDeviceDto,
	CreateHomeAssistantChannelDto,
	UpdateHomeAssistantChannelDto,
	CreateHomeAssistantChannelPropertyDto,
	UpdateHomeAssistantChannelPropertyDto,
	HomeAssistantUpdatePluginConfigDto,
	HomeAssistantDiscoveredDeviceDto,
	HomeAssistantStateDto,
	HomeAssistantStateChangedEventDataDto,
	HomeAssistantStateChangedEventDto,
	HomeAssistantServiceRequestDto,
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
