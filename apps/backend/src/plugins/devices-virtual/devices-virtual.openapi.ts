/**
 * OpenAPI extra models for Devices Virtual plugin
 */
import { CompatibilityCandidateDto, CompatibilityDto, ReqCompatibilityDto } from './dto/compatibility-request.dto';
import { CreateVirtualChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from './dto/create-channel.dto';
import { CreateVirtualDeviceChannelDto } from './dto/create-device-channel.dto';
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
import { CompatibilityReportModel, CompatibilityResponseModel } from './models/compatibility-response.model';
import { VirtualConfigModel } from './models/config.model';
import { VirtualSourceDevicesResponseModel } from './models/virtual-response.model';

export const DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateVirtualDeviceDto,
	UpdateVirtualDeviceDto,
	CreateVirtualChannelDto,
	CreateVirtualDeviceChannelDto,
	UpdateVirtualChannelDto,
	CreateVirtualChannelPropertyDto,
	UpdateVirtualChannelPropertyDto,
	VirtualUpdatePluginConfigDto,
	CompatibilityCandidateDto,
	CompatibilityDto,
	ReqCompatibilityDto,
	// Data models
	VirtualConfigModel,
	CompatibilityReportModel,
	// Response models
	VirtualSourceDevicesResponseModel,
	CompatibilityResponseModel,
	// Entities
	VirtualDeviceEntity,
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
];
