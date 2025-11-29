/**
 * OpenAPI extra models for Devices module
 */
import { Type } from '@nestjs/common';

import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './entities/devices.entity';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleDeviceCategory,
} from './models/devices-enums.model';
import {
	ChannelControlResponseModel,
	ChannelControlsResponseModel,
	ChannelPropertiesResponseModel,
	ChannelPropertyResponseModel,
	ChannelResponseModel,
	ChannelsResponseModel,
	DeviceChannelResponseModel,
	DeviceChannelsResponseModel,
	DeviceControlResponseModel,
	DeviceControlsResponseModel,
	DeviceResponseModel,
	DevicesResponseModel,
	PropertyTimeseriesResponseModel,
} from './models/devices-response.model';
import {
	ChannelPropertySpecModel,
	ChannelSpecModel,
	DeviceChannelSpecModel,
	DeviceSpecModel,
	ModuleStatsModel,
	OnlineNowModel,
	PropertyTimeseriesModel,
	RegisteredChannelsModel,
	RegisteredDevicesModel,
	TimeseriesPointModel,
	UpdatesPerMinModel,
	UpdatesTodayModel,
} from './models/devices.model';

export const DEVICES_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	DeviceResponseModel,
	DevicesResponseModel,
	ChannelResponseModel,
	ChannelsResponseModel,
	DeviceChannelResponseModel,
	DeviceChannelsResponseModel,
	ChannelPropertyResponseModel,
	ChannelPropertiesResponseModel,
	DeviceControlResponseModel,
	DeviceControlsResponseModel,
	ChannelControlResponseModel,
	ChannelControlsResponseModel,
	PropertyTimeseriesResponseModel,
	// Data models
	DeviceChannelSpecModel,
	DeviceSpecModel,
	ChannelPropertySpecModel,
	ChannelSpecModel,
	RegisteredDevicesModel,
	RegisteredChannelsModel,
	UpdatesPerMinModel,
	UpdatesTodayModel,
	OnlineNowModel,
	ModuleStatsModel,
	TimeseriesPointModel,
	PropertyTimeseriesModel,
	// Enum wrapper models
	DevicesModuleDeviceCategory,
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	// Entities
	DeviceEntity,
	DeviceControlEntity,
	ChannelEntity,
	ChannelControlEntity,
	ChannelPropertyEntity,
];
