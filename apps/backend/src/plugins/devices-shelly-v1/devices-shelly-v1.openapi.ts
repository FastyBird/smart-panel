/**
 * OpenAPI extra models for Devices Shelly V1 plugin
 */
import { Type } from '@nestjs/common';

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

export const DEVICES_SHELLY_V1_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
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
