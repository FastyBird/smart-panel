/**
 * OpenAPI extra models for Devices Virtual plugin
 */
import { CompatibilityCandidateDto, CompatibilityDto, ReqCompatibilityDto } from './dto/compatibility-request.dto';
import { CreateVirtualChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateVirtualChannelDto } from './dto/create-channel.dto';
import { CreateVirtualDeviceChannelDto } from './dto/create-device-channel.dto';
import { CreateVirtualDeviceDto } from './dto/create-device.dto';
import * as LightGroupDraftDtos from './dto/light-group-draft.dto';
import * as MeasurementAuthoringDtos from './dto/measurement-authoring.dto';
import * as ProducerDtos from './dto/producer-config.dto';
import { CreateVirtualThermostatProducerDto } from './dto/thermostat-authoring.dto';
import * as ThermostatDtos from './dto/thermostat-config.dto';
import {
	ConfigureVirtualTransformDto,
	VirtualCalibrationPointDto,
	VirtualNumericRangeDto,
	VirtualNumericTransformPolicyDto,
} from './dto/transform-config.dto';
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
import * as LightGroupDraftModels from './models/light-group-draft.model';
import * as MeasurementAuthoringModels from './models/measurement-authoring-response.model';
import * as ProducerModels from './models/producer-response.model';
import * as ThermostatAuthoringModels from './models/thermostat-authoring-response.model';
import * as ThermostatModels from './models/thermostat-response.model';
import * as TransformModels from './models/transform-response.model';
import { VirtualSourceDevicesResponseModel } from './models/virtual-response.model';

export const DEVICES_VIRTUAL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	...Object.values(LightGroupDraftDtos),
	...Object.values(LightGroupDraftModels),
	...Object.values(MeasurementAuthoringDtos),
	...Object.values(MeasurementAuthoringModels),
	ConfigureVirtualTransformDto,
	VirtualNumericTransformPolicyDto,
	VirtualNumericRangeDto,
	VirtualCalibrationPointDto,
	...Object.values(TransformModels),
	...Object.values(ThermostatDtos),
	CreateVirtualThermostatProducerDto,
	...Object.values(ThermostatModels),
	...Object.values(ThermostatAuthoringModels),
	...Object.values(ProducerDtos),
	...Object.values(ProducerModels),
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
