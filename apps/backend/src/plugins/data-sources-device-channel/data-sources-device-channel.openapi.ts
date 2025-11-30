/**
 * OpenAPI extra models for Data Sources Device Channel plugin
 */
import { CreateDeviceChannelDataSourceDto } from './dto/create-data-source.dto';
import { DeviceChannelUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateDeviceChannelDataSourceDto } from './dto/update-data-source.dto';
import { DeviceChannelDataSourceEntity } from './entities/data-sources-device-channel.entity';
import { DeviceChannelConfigModel } from './models/config.model';

export const DATA_SOURCES_DEVICE_CHANNEL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateDeviceChannelDataSourceDto,
	UpdateDeviceChannelDataSourceDto,
	DeviceChannelUpdatePluginConfigDto,
	// Data models
	DeviceChannelConfigModel,
	// Entities
	DeviceChannelDataSourceEntity,
];
