/**
 * OpenAPI extra models for Devices Shelly NG plugin
 */
import { AdoptDeviceDto, AdoptDevicesDto } from './dto/adopt-devices.dto';
import { CreateShellyNgChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateShellyNgChannelDto } from './dto/create-channel.dto';
import { CreateShellyNgDeviceDto } from './dto/create-device.dto';
import { UpdateShellyNgChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateShellyNgChannelDto } from './dto/update-channel.dto';
import {
	ShellyNgUpdatePluginConfigDto,
	ShellyNgUpdatePluginConfigMdnsDto,
	ShellyNgUpdatePluginConfigWebsocketsDto,
} from './dto/update-config.dto';
import { UpdateShellyNgDeviceDto } from './dto/update-device.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from './entities/devices-shelly-ng.entity';
import { ShellyNgConfigModel, ShellyNgMdnsConfigModel, ShellyNgWebsocketsConfigModel } from './models/config.model';
import {
	ShellyNgAdoptionResponseModel,
	ShellyNgDeviceInfoResponseModel,
	ShellyNgDiscoverySessionResponseModel,
	ShellyNgMappingReloadResponseModel,
	ShellyNgSupportedDevicesResponseModel,
} from './models/shelly-ng-response.model';
import {
	ShellyNgAdoptionResultModel,
	ShellyNgDeviceInfoAuthenticationModel,
	ShellyNgDeviceInfoComponentModel,
	ShellyNgDeviceInfoModel,
	ShellyNgDiscoveryDeviceAuthenticationModel,
	ShellyNgDiscoveryDeviceModel,
	ShellyNgDiscoverySessionModel,
	ShellyNgMappingReloadCacheStatsModel,
	ShellyNgMappingReloadModel,
	ShellyNgSupportedDeviceComponentModel,
	ShellyNgSupportedDeviceModel,
	ShellyNgSupportedDeviceSystemComponentModel,
} from './models/shelly-ng.model';

export const DEVICES_SHELLY_NG_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateShellyNgDeviceDto,
	UpdateShellyNgDeviceDto,
	CreateShellyNgChannelDto,
	UpdateShellyNgChannelDto,
	CreateShellyNgChannelPropertyDto,
	UpdateShellyNgChannelPropertyDto,
	ShellyNgUpdatePluginConfigDto,
	ShellyNgUpdatePluginConfigMdnsDto,
	ShellyNgUpdatePluginConfigWebsocketsDto,
	AdoptDeviceDto,
	AdoptDevicesDto,
	// Response models
	ShellyNgAdoptionResponseModel,
	ShellyNgDeviceInfoResponseModel,
	ShellyNgDiscoverySessionResponseModel,
	ShellyNgMappingReloadResponseModel,
	ShellyNgSupportedDevicesResponseModel,
	// Data models
	ShellyNgAdoptionResultModel,
	ShellyNgDiscoveryDeviceAuthenticationModel,
	ShellyNgDiscoveryDeviceModel,
	ShellyNgDiscoverySessionModel,
	ShellyNgMappingReloadCacheStatsModel,
	ShellyNgMappingReloadModel,
	ShellyNgSupportedDeviceComponentModel,
	ShellyNgSupportedDeviceSystemComponentModel,
	ShellyNgSupportedDeviceModel,
	ShellyNgDeviceInfoComponentModel,
	ShellyNgDeviceInfoAuthenticationModel,
	ShellyNgDeviceInfoModel,
	ShellyNgMdnsConfigModel,
	ShellyNgWebsocketsConfigModel,
	ShellyNgConfigModel,
	// Entities
	ShellyNgDeviceEntity,
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
];
