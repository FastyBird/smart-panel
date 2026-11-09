/**
 * OpenAPI extra models for Devices Modbus plugin
 */
import { CreateModbusChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateModbusChannelDto } from './dto/create-channel.dto';
import { CreateModbusDeviceDto } from './dto/create-device.dto';
import { CreateModbusEndpointDto, ReqCreateModbusEndpointDto } from './dto/create-endpoint.dto';
import { UpdateModbusChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateModbusChannelDto } from './dto/update-channel.dto';
import { ModbusUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateModbusDeviceDto } from './dto/update-device.dto';
import { ReqUpdateModbusEndpointDto, UpdateModbusEndpointDto } from './dto/update-endpoint.dto';
import { ModbusChannelEntity, ModbusChannelPropertyEntity, ModbusDeviceEntity } from './entities/devices-modbus.entity';
import { ModbusBindingEntity } from './entities/modbus-binding.entity';
import { ModbusEndpointEntity } from './entities/modbus-endpoint.entity';
import { ModbusConfigModel } from './models/config.model';
import { ModbusEndpointHealthModel, ModbusEndpointHealthResponseModel } from './models/endpoint-health.model';
import { ModbusEndpointResponseModel, ModbusEndpointsResponseModel } from './models/endpoint-response.model';

export const DEVICES_MODBUS_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateModbusDeviceDto,
	UpdateModbusDeviceDto,
	CreateModbusChannelDto,
	UpdateModbusChannelDto,
	CreateModbusChannelPropertyDto,
	UpdateModbusChannelPropertyDto,
	ModbusUpdatePluginConfigDto,
	CreateModbusEndpointDto,
	UpdateModbusEndpointDto,
	ReqCreateModbusEndpointDto,
	ReqUpdateModbusEndpointDto,
	// Response models
	ModbusEndpointResponseModel,
	ModbusEndpointsResponseModel,
	ModbusEndpointHealthModel,
	ModbusEndpointHealthResponseModel,
	// Config models
	ModbusConfigModel,
	// Entities
	ModbusDeviceEntity,
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusEndpointEntity,
	ModbusBindingEntity,
];
