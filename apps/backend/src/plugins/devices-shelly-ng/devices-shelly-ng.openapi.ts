/**
 * OpenAPI extra models for Devices Shelly NG plugin
 */
import { Type } from '@nestjs/common';

import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from './entities/devices-shelly-ng.entity';
import { ShellyNgConfigModel, ShellyNgMdnsConfigModel, ShellyNgWebsocketsConfigModel } from './models/config.model';
import {
	ShellyNgDeviceInfoResponseModel,
	ShellyNgSupportedDevicesResponseModel,
} from './models/shelly-ng-response.model';
import {
	ShellyNgDeviceInfoAuthenticationModel,
	ShellyNgDeviceInfoComponentModel,
	ShellyNgDeviceInfoModel,
	ShellyNgSupportedDeviceComponentModel,
	ShellyNgSupportedDeviceModel,
	ShellyNgSupportedDeviceSystemComponentModel,
} from './models/shelly-ng.model';

export const DEVICES_SHELLY_NG_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	ShellyNgDeviceInfoResponseModel,
	ShellyNgSupportedDevicesResponseModel,
	// Data models
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
