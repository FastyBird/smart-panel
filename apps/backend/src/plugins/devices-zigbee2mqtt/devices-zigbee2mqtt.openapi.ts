/**
 * OpenAPI extra models for Zigbee2MQTT plugin
 */
import { CreateZigbee2mqttChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateZigbee2mqttChannelDto } from './dto/create-channel.dto';
import { CreateZigbee2mqttDeviceDto } from './dto/create-device.dto';
import {
	AdoptChannelDefinitionDto,
	AdoptDeviceRequestDto,
	AdoptPropertyDefinitionDto,
	MappingExposeOverrideDto,
	MappingPreviewRequestDto,
} from './dto/mapping-preview.dto';
import { UpdateZigbee2mqttChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateZigbee2mqttChannelDto } from './dto/update-channel.dto';
import {
	Z2mUpdateDiscoveryDto,
	Z2mUpdateMqttDto,
	Z2mUpdateTlsDto,
	Zigbee2mqttUpdatePluginConfigDto,
} from './dto/update-config.dto';
import { UpdateZigbee2mqttDeviceDto } from './dto/update-device.dto';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from './entities/devices-zigbee2mqtt.entity';
import {
	Z2mDiscoveryConfigModel,
	Z2mMqttConfigModel,
	Z2mTlsConfigModel,
	Zigbee2mqttConfigModel,
} from './models/config.model';
import {
	Z2mDeviceInfoModel,
	Z2mExposeInfoModel,
	Z2mExposeMappingPreviewModel,
	Z2mMappingPreviewModel,
	Z2mMappingPreviewResponseModel,
	Z2mMappingWarningModel,
	Z2mPropertyMappingPreviewModel,
	Z2mSuggestedChannelModel,
	Z2mSuggestedDeviceModel,
	Zigbee2mqttDiscoveredDeviceModel,
	Zigbee2mqttDiscoveredDeviceResponseModel,
	Zigbee2mqttDiscoveredDevicesResponseModel,
} from './models/zigbee2mqtt-response.model';

export const DEVICES_ZIGBEE2MQTT_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateZigbee2mqttDeviceDto,
	UpdateZigbee2mqttDeviceDto,
	CreateZigbee2mqttChannelDto,
	UpdateZigbee2mqttChannelDto,
	CreateZigbee2mqttChannelPropertyDto,
	UpdateZigbee2mqttChannelPropertyDto,
	Zigbee2mqttUpdatePluginConfigDto,
	Z2mUpdateMqttDto,
	Z2mUpdateTlsDto,
	Z2mUpdateDiscoveryDto,
	// Mapping preview DTOs
	MappingPreviewRequestDto,
	MappingExposeOverrideDto,
	AdoptDeviceRequestDto,
	AdoptChannelDefinitionDto,
	AdoptPropertyDefinitionDto,
	// Config models
	Zigbee2mqttConfigModel,
	Z2mMqttConfigModel,
	Z2mTlsConfigModel,
	Z2mDiscoveryConfigModel,
	// Response models
	Zigbee2mqttDiscoveredDeviceModel,
	Zigbee2mqttDiscoveredDeviceResponseModel,
	Zigbee2mqttDiscoveredDevicesResponseModel,
	Z2mExposeInfoModel,
	Z2mMappingPreviewModel,
	Z2mMappingPreviewResponseModel,
	Z2mDeviceInfoModel,
	Z2mSuggestedDeviceModel,
	Z2mExposeMappingPreviewModel,
	Z2mSuggestedChannelModel,
	Z2mPropertyMappingPreviewModel,
	Z2mMappingWarningModel,
	// Entities
	Zigbee2mqttDeviceEntity,
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
];
