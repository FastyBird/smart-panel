/**
 * OpenAPI extra models for Devices WLED plugin
 */
import { CreateWledChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateWledChannelDto } from './dto/create-channel.dto';
import { CreateWledDeviceDto } from './dto/create-device.dto';
import { UpdateWledChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateWledChannelDto } from './dto/update-channel.dto';
import {
	WledUpdateDeviceHostDto,
	WledUpdatePluginConfigDto,
	WledUpdatePollingDto,
	WledUpdateTimeoutsDto,
} from './dto/update-config.dto';
import { UpdateWledDeviceDto } from './dto/update-device.dto';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from './entities/devices-wled.entity';
import {
	WledConfigModel,
	WledDeviceHostConfigModel,
	WledPollingConfigModel,
	WledTimeoutsConfigModel,
} from './models/config.model';

export const DEVICES_WLED_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateWledDeviceDto,
	UpdateWledDeviceDto,
	CreateWledChannelDto,
	UpdateWledChannelDto,
	CreateWledChannelPropertyDto,
	UpdateWledChannelPropertyDto,
	WledUpdatePluginConfigDto,
	WledUpdateDeviceHostDto,
	WledUpdateTimeoutsDto,
	WledUpdatePollingDto,
	// Config models
	WledConfigModel,
	WledDeviceHostConfigModel,
	WledTimeoutsConfigModel,
	WledPollingConfigModel,
	// Entities
	WledDeviceEntity,
	WledChannelEntity,
	WledChannelPropertyEntity,
];
