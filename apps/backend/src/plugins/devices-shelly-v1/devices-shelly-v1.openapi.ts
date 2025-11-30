/**
 * OpenAPI extra models for Devices Shelly V1 plugin
 */
import { CreateShellyV1ChannelDto } from './dto/create-channel.dto';
import { CreateShellyV1ChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateShellyV1DeviceDto } from './dto/create-device.dto';
import {
	ShellyV1UpdatePluginConfigDto,
	ShellyV1UpdatePluginConfigDiscoveryDto,
	ShellyV1UpdatePluginConfigTimeoutsDto,
} from './dto/update-config.dto';
import { UpdateShellyV1ChannelDto } from './dto/update-channel.dto';
import { UpdateShellyV1ChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateShellyV1DeviceDto } from './dto/update-device.dto';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from './entities/devices-shelly-v1.entity';
import { ShellyV1ConfigModel, ShellyV1DiscoveryConfigModel, ShellyV1TimeoutsConfigModel } from './models/config.model';
import {
	ShellyV1DeviceInfoResponseModel,
	ShellyV1SupportedDevicesResponseModel,
} from './models/shelly-v1-response.model';
import { ShellyV1DeviceInfoModel, ShellyV1SupportedDeviceModel } from './models/shelly-v1.model';

export const DEVICES_SHELLY_V1_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateShellyV1DeviceDto,
	UpdateShellyV1DeviceDto,
	CreateShellyV1ChannelDto,
	UpdateShellyV1ChannelDto,
	CreateShellyV1ChannelPropertyDto,
	UpdateShellyV1ChannelPropertyDto,
	ShellyV1UpdatePluginConfigDto,
	ShellyV1UpdatePluginConfigDiscoveryDto,
	ShellyV1UpdatePluginConfigTimeoutsDto,
	// Response models
	ShellyV1DeviceInfoResponseModel,
	ShellyV1SupportedDevicesResponseModel,
	// Data models
	ShellyV1SupportedDeviceModel,
	ShellyV1DeviceInfoModel,
	ShellyV1DiscoveryConfigModel,
	ShellyV1TimeoutsConfigModel,
	ShellyV1ConfigModel,
	// Entities
	ShellyV1DeviceEntity,
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
];
