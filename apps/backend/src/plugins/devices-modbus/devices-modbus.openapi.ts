/**
 * OpenAPI extra models for Devices Modbus plugin
 */
import { ModbusBindingDto, ModbusValueMapEntryDto } from './dto/binding.dto';
import { CreateModbusChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateModbusChannelDto } from './dto/create-channel.dto';
import {
	CreateModbusDeviceStructureChannelDto,
	CreateModbusDeviceStructureDto,
	CreateModbusDeviceStructurePropertyDto,
	ReqCreateModbusDeviceStructureDto,
} from './dto/create-device-structure.dto';
import { CreateModbusDeviceDto } from './dto/create-device.dto';
import { CreateModbusEndpointDto, ReqCreateModbusEndpointDto } from './dto/create-endpoint.dto';
import { PreviewModbusTemplateDto, ReqPreviewModbusTemplateDto } from './dto/preview-template.dto';
import {
	ProbeModbusPointDto,
	ProbeModbusPointsDto,
	ProbeModbusReadDto,
	ProbeModbusWriteDto,
	ReqProbeModbusPointsDto,
	ReqProbeModbusReadDto,
	ReqProbeModbusWriteDto,
} from './dto/probe.dto';
import { UpdateModbusChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateModbusChannelDto } from './dto/update-channel.dto';
import { ModbusUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateModbusDeviceDto } from './dto/update-device.dto';
import { ReqUpdateModbusEndpointDto, UpdateModbusEndpointDto } from './dto/update-endpoint.dto';
import { ModbusChannelEntity, ModbusChannelPropertyEntity, ModbusDeviceEntity } from './entities/devices-modbus.entity';
import { ModbusBindingEntity } from './entities/modbus-binding.entity';
import { ModbusEndpointEntity } from './entities/modbus-endpoint.entity';
import { ModbusBindingsResponseModel } from './models/bindings-response.model';
import { ModbusConfigModel } from './models/config.model';
import { ModbusDeviceResponseModel } from './models/device-response.model';
import { ModbusEndpointHealthModel, ModbusEndpointHealthResponseModel } from './models/endpoint-health.model';
import { ModbusEndpointResponseModel, ModbusEndpointsResponseModel } from './models/endpoint-response.model';
import {
	ModbusProbePointsResponseModel,
	ModbusProbeReadResponseModel,
	ModbusProbeWriteResponseModel,
} from './models/probe-response.model';
import {
	ModbusProbeErrorModel,
	ModbusProbePointModel,
	ModbusProbePointsModel,
	ModbusProbeReadModel,
	ModbusProbeWriteModel,
} from './models/probe.model';
import {
	ModbusTemplatePreviewResponseModel,
	ModbusTemplateResponseModel,
	ModbusTemplatesResponseModel,
} from './models/template-response.model';
import {
	ModbusTemplateCatalogModel,
	ModbusTemplateDefaultsModel,
	ModbusTemplateFileModel,
	ModbusTemplatePreviewBindingModel,
	ModbusTemplatePreviewChannelModel,
	ModbusTemplatePreviewEndpointDefaultsModel,
	ModbusTemplatePreviewModel,
	ModbusTemplatePreviewPropertyModel,
	ModbusTemplatePreviewValueMapEntryModel,
	ModbusTemplateSummaryModel,
	ModbusTemplateUnitIdModel,
} from './models/template.model';

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
	ModbusValueMapEntryDto,
	ModbusBindingDto,
	CreateModbusDeviceStructurePropertyDto,
	CreateModbusDeviceStructureChannelDto,
	CreateModbusDeviceStructureDto,
	ReqCreateModbusDeviceStructureDto,
	PreviewModbusTemplateDto,
	ReqPreviewModbusTemplateDto,
	ProbeModbusPointDto,
	ProbeModbusReadDto,
	ProbeModbusPointsDto,
	ProbeModbusWriteDto,
	ReqProbeModbusReadDto,
	ReqProbeModbusPointsDto,
	ReqProbeModbusWriteDto,
	// Response models
	ModbusEndpointResponseModel,
	ModbusEndpointsResponseModel,
	ModbusEndpointHealthModel,
	ModbusEndpointHealthResponseModel,
	ModbusDeviceResponseModel,
	ModbusBindingsResponseModel,
	ModbusTemplatesResponseModel,
	ModbusTemplateResponseModel,
	ModbusTemplatePreviewResponseModel,
	ModbusProbeReadResponseModel,
	ModbusProbePointsResponseModel,
	ModbusProbeWriteResponseModel,
	// Probe models
	ModbusProbeErrorModel,
	ModbusProbeReadModel,
	ModbusProbePointModel,
	ModbusProbePointsModel,
	ModbusProbeWriteModel,
	// Template models
	ModbusTemplateUnitIdModel,
	ModbusTemplateDefaultsModel,
	ModbusTemplateSummaryModel,
	ModbusTemplateFileModel,
	ModbusTemplateCatalogModel,
	ModbusTemplatePreviewValueMapEntryModel,
	ModbusTemplatePreviewBindingModel,
	ModbusTemplatePreviewPropertyModel,
	ModbusTemplatePreviewChannelModel,
	ModbusTemplatePreviewEndpointDefaultsModel,
	ModbusTemplatePreviewModel,
	// Config models
	ModbusConfigModel,
	// Entities
	ModbusDeviceEntity,
	ModbusChannelEntity,
	ModbusChannelPropertyEntity,
	ModbusEndpointEntity,
	ModbusBindingEntity,
];
