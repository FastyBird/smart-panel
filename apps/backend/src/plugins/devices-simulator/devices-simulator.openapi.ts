import { CreateSimulatorChannelDto } from './dto/create-channel.dto';
import { CreateSimulatorChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateSimulatorDeviceDto } from './dto/create-device.dto';
import { GenerateDeviceDto, ReqGenerateDeviceDto } from './dto/generate-device.dto';
import {
	ReqSimulateConnectionStateDto,
	ReqSimulateValueDto,
	SimulateConnectionStateDto,
	SimulateValueDto,
} from './dto/simulate-value.dto';
import { UpdateSimulatorChannelDto } from './dto/update-channel.dto';
import { UpdateSimulatorChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateSimulatorDeviceDto } from './dto/update-device.dto';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from './entities/devices-simulator.entity';
import {
	ConnectionStateResponseModel,
	ConnectionStateResultModel,
	DeviceCategoriesResponseModel,
	DeviceCategoryModel,
	GeneratedDeviceResponseModel,
	SimulatedValueResponseModel,
	SimulatedValueResultModel,
} from './models/simulator-response.model';

export const DEVICES_SIMULATOR_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Entities
	SimulatorDeviceEntity,
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,

	// Create DTOs
	CreateSimulatorDeviceDto,
	CreateSimulatorChannelDto,
	CreateSimulatorChannelPropertyDto,

	// Update DTOs
	UpdateSimulatorDeviceDto,
	UpdateSimulatorChannelDto,
	UpdateSimulatorChannelPropertyDto,

	// Simulator-specific DTOs
	GenerateDeviceDto,
	ReqGenerateDeviceDto,
	SimulateValueDto,
	ReqSimulateValueDto,
	SimulateConnectionStateDto,
	ReqSimulateConnectionStateDto,

	// Response models
	GeneratedDeviceResponseModel,
	DeviceCategoryModel,
	DeviceCategoriesResponseModel,
	SimulatedValueResultModel,
	SimulatedValueResponseModel,
	ConnectionStateResultModel,
	ConnectionStateResponseModel,
];
