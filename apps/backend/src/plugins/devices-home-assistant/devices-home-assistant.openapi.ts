/**
 * OpenAPI extra models for Devices Home Assistant plugin
 */
import { CreateHomeAssistantChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeAssistantChannelDto } from './dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from './dto/create-device.dto';
import {
	AdoptHelperChannelDefinitionDto,
	AdoptHelperPropertyDefinitionDto,
	AdoptHelperRequestDto,
	HelperMappingPreviewRequestDto,
} from './dto/helper-mapping-preview.dto';
import { HomeAssistantDiscoveredDeviceDto } from './dto/home-assistant-discovered-device.dto';
import { HomeAssistantServiceRequestDto } from './dto/home-assistant-service-request.dto';
import {
	HomeAssistantStateChangedEventDataDto,
	HomeAssistantStateChangedEventDto,
	HomeAssistantStateDto,
} from './dto/home-assistant-state.dto';
import {
	AdoptChannelDefinitionDto,
	AdoptDeviceRequestDto,
	AdoptPropertyDefinitionDto,
	MappingEntityOverrideDto,
	MappingPreviewRequestDto,
} from './dto/mapping-preview.dto';
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
import { DiscoveredInstanceModel, DiscoveredInstancesResponseModel } from './models/discovered-instance.model';
import {
	HelperChannelMappingPreviewModel,
	HelperInfoModel,
	HelperMappingPreviewModel,
	HelperMappingPreviewResponseModel,
	HelperMappingWarningModel,
	HelperPropertyMappingPreviewModel,
	SuggestedHelperDeviceModel,
} from './models/helper-mapping-preview.model';
import {
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
	HomeAssistantDiscoveredHelperResponseModel,
	HomeAssistantDiscoveredHelpersResponseModel,
	HomeAssistantEntityRegistryResponseModel,
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
} from './models/home-assistant-response.model';
import {
	HomeAssistantDeviceRegistryModel,
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantDiscoveredDeviceModel,
	HomeAssistantDiscoveredHelperModel,
	HomeAssistantEntityRegistryModel,
	HomeAssistantEntityRegistryResultModel,
	HomeAssistantStateModel,
} from './models/home-assistant.model';
import {
	EntityMappingPreviewModel,
	HaDeviceInfoModel,
	MappingPreviewModel,
	MappingPreviewResponseModel,
	MappingWarningModel,
	PropertyMappingPreviewModel,
	SuggestedChannelModel,
	SuggestedDeviceModel,
} from './models/mapping-preview.model';

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
	// Mapping preview DTOs
	MappingPreviewRequestDto,
	MappingEntityOverrideDto,
	AdoptDeviceRequestDto,
	AdoptChannelDefinitionDto,
	AdoptPropertyDefinitionDto,
	// Helper mapping preview DTOs
	HelperMappingPreviewRequestDto,
	AdoptHelperRequestDto,
	AdoptHelperChannelDefinitionDto,
	AdoptHelperPropertyDefinitionDto,
	// Response models
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
	HomeAssistantDiscoveredHelperResponseModel,
	HomeAssistantDiscoveredHelpersResponseModel,
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantEntityRegistryResponseModel,
	// Data models
	HomeAssistantStateModel,
	HomeAssistantDiscoveredDeviceModel,
	HomeAssistantDiscoveredHelperModel,
	HomeAssistantEntityRegistryResultModel,
	HomeAssistantEntityRegistryModel,
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantDeviceRegistryModel,
	HomeAssistantConfigModel,
	// Mapping preview models
	MappingPreviewModel,
	MappingPreviewResponseModel,
	EntityMappingPreviewModel,
	PropertyMappingPreviewModel,
	SuggestedChannelModel,
	SuggestedDeviceModel,
	MappingWarningModel,
	HaDeviceInfoModel,
	// Helper mapping preview models
	HelperMappingPreviewModel,
	HelperMappingPreviewResponseModel,
	HelperChannelMappingPreviewModel,
	HelperPropertyMappingPreviewModel,
	HelperInfoModel,
	SuggestedHelperDeviceModel,
	HelperMappingWarningModel,
	// Entities
	HomeAssistantDeviceEntity,
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	// Discovery models
	DiscoveredInstanceModel,
	DiscoveredInstancesResponseModel,
];
