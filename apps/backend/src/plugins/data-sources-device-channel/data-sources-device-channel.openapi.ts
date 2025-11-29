/**
 * OpenAPI extra models for Data Sources Device Channel plugin
 */
import { Type } from '@nestjs/common';

import { DeviceChannelDataSourceEntity } from './entities/data-sources-device-channel.entity';
import { DeviceChannelConfigModel } from './models/config.model';

export const DATA_SOURCES_DEVICE_CHANNEL_PLUGIN_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Data models
	DeviceChannelConfigModel,
	// Entities
	DeviceChannelDataSourceEntity,
];
