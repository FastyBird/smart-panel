/**
 * OpenAPI extra models for Devices Virtual plugin
 */
import { CreateVirtualChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from './dto/create-channel.dto';
import { CreateVirtualDeviceDto } from './dto/create-device.dto';
import { UpdateVirtualChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateVirtualChannelDto } from './dto/update-channel.dto';
import { VirtualUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateVirtualDeviceDto } from './dto/update-device.dto';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
} from './entities/devices-virtual.entity';
import { VirtualConfigModel } from './models/config.model';

export const DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateVirtualDeviceDto,
	UpdateVirtualDeviceDto,
	CreateVirtualChannelDto,
	UpdateVirtualChannelDto,
	CreateVirtualChannelPropertyDto,
	UpdateVirtualChannelPropertyDto,
	VirtualUpdatePluginConfigDto,
	// Data models
	VirtualConfigModel,
	// Entities
	VirtualDeviceEntity,
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
];
