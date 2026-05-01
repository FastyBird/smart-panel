/**
 * OpenAPI extra models for Zigbee Herdsman plugin
 */
import { CreateZigbeeHerdsmanChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateZigbeeHerdsmanChannelDto } from './dto/create-channel.dto';
import { CreateZigbeeHerdsmanDeviceDto } from './dto/create-device.dto';
import {
	ReqZhAdoptDeviceDto,
	ReqZhMappingPreviewDto,
	ReqZhPermitJoinDto,
	ZhAdoptChannelDefinitionDto,
	ZhAdoptDeviceRequestDto,
	ZhAdoptPropertyDefinitionDto,
	ZhMappingExposeOverrideDto,
	ZhMappingPreviewRequestDto,
	ZhPermitJoinRequestDto,
} from './dto/mapping-preview.dto';
import { UpdateZigbeeHerdsmanChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateZigbeeHerdsmanChannelDto } from './dto/update-channel.dto';
import {
	ZhUpdateDiscoveryDto,
	ZhUpdateNetworkDto,
	ZhUpdateSerialDto,
	ZigbeeHerdsmanUpdatePluginConfigDto,
} from './dto/update-config.dto';
import { UpdateZigbeeHerdsmanDeviceDto } from './dto/update-device.dto';
import {
	ZigbeeHerdsmanChannelEntity,
	ZigbeeHerdsmanChannelPropertyEntity,
	ZigbeeHerdsmanDeviceEntity,
} from './entities/devices-zigbee-herdsman.entity';
import {
	ZhDiscoveryConfigModel,
	ZhNetworkConfigModel,
	ZhSerialConfigModel,
	ZigbeeHerdsmanConfigModel,
} from './models/config.model';
import {
	ZhCoordinatorInfoModel,
	ZhCoordinatorInfoResponseModel,
	ZhDeviceInfoModel,
	ZhExposeInfoModel,
	ZhExposeMappingPreviewModel,
	ZhMappingPreviewModel,
	ZhMappingPreviewResponseModel,
	ZhMappingWarningModel,
	ZhPermitJoinModel,
	ZhPermitJoinResponseModel,
	ZhPropertyMappingPreviewModel,
	ZhSuggestedChannelModel,
	ZhSuggestedDeviceModel,
	ZigbeeHerdsmanDiscoveredDeviceModel,
	ZigbeeHerdsmanDiscoveredDeviceResponseModel,
	ZigbeeHerdsmanDiscoveredDevicesResponseModel,
} from './models/zigbee-herdsman-response.model';

export const DEVICES_ZIGBEE_HERDSMAN_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateZigbeeHerdsmanDeviceDto,
	UpdateZigbeeHerdsmanDeviceDto,
	CreateZigbeeHerdsmanChannelDto,
	UpdateZigbeeHerdsmanChannelDto,
	CreateZigbeeHerdsmanChannelPropertyDto,
	UpdateZigbeeHerdsmanChannelPropertyDto,
	ZigbeeHerdsmanUpdatePluginConfigDto,
	ZhUpdateSerialDto,
	ZhUpdateNetworkDto,
	ZhUpdateDiscoveryDto,
	// Mapping preview DTOs
	ZhMappingPreviewRequestDto,
	ZhMappingExposeOverrideDto,
	ZhAdoptDeviceRequestDto,
	ZhAdoptChannelDefinitionDto,
	ZhAdoptPropertyDefinitionDto,
	ZhPermitJoinRequestDto,
	ReqZhMappingPreviewDto,
	ReqZhAdoptDeviceDto,
	ReqZhPermitJoinDto,
	// Config models
	ZigbeeHerdsmanConfigModel,
	ZhSerialConfigModel,
	ZhNetworkConfigModel,
	ZhDiscoveryConfigModel,
	// Response models
	ZigbeeHerdsmanDiscoveredDeviceModel,
	ZigbeeHerdsmanDiscoveredDeviceResponseModel,
	ZigbeeHerdsmanDiscoveredDevicesResponseModel,
	ZhExposeInfoModel,
	ZhMappingPreviewModel,
	ZhMappingPreviewResponseModel,
	ZhDeviceInfoModel,
	ZhSuggestedDeviceModel,
	ZhExposeMappingPreviewModel,
	ZhSuggestedChannelModel,
	ZhPropertyMappingPreviewModel,
	ZhMappingWarningModel,
	ZhCoordinatorInfoModel,
	ZhCoordinatorInfoResponseModel,
	ZhPermitJoinModel,
	ZhPermitJoinResponseModel,
	// Entities
	ZigbeeHerdsmanDeviceEntity,
	ZigbeeHerdsmanChannelEntity,
	ZigbeeHerdsmanChannelPropertyEntity,
];
