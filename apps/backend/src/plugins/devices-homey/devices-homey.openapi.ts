import { HomeyAdoptDeviceDto, HomeyBatchAdoptDevicesDto } from './dto/adoption.dto';
import { CreateHomeyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeyChannelDto } from './dto/create-channel.dto';
import { CreateHomeyDeviceChannelPropertyDto } from './dto/create-device-channel-property.dto';
import { CreateHomeyDeviceChannelDto } from './dto/create-device-channel.dto';
import { CreateHomeyDeviceDto } from './dto/create-device.dto';
import { ListHomeyDevicesQueryDto } from './dto/list-homey-devices.dto';
import { HomeyMappingPreviewRequestDto } from './dto/mapping-preview.dto';
import {
	HomeyTestCandidateConnectionDto,
	HomeyTestConnectionDto,
	HomeyTestConnectionRequestDto,
	HomeyTestSavedConnectionDto,
} from './dto/test-connection.dto';
import { UpdateHomeyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeyChannelDto } from './dto/update-channel.dto';
import { HomeyUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeyDeviceDto } from './dto/update-device.dto';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from './entities/devices-homey.entity';
import {
	HomeyAdoptionResponseModel,
	HomeyAdoptionResultModel,
	HomeyBatchAdoptionModel,
	HomeyBatchAdoptionResponseModel,
} from './models/adoption.model';
import { HomeyConfigModel } from './models/config.model';
import {
	HomeyCapabilitySummaryModel,
	HomeyInventoryDeviceModel,
	HomeyInventoryDeviceResponseModel,
	HomeyInventoryDevicesResponseModel,
} from './models/inventory.model';
import {
	HomeyMappingPreviewChannelModel,
	HomeyMappingPreviewConversionModel,
	HomeyMappingPreviewDeviceModel,
	HomeyMappingPreviewModel,
	HomeyMappingPreviewPropertyModel,
	HomeyMappingPreviewRangeModel,
	HomeyMappingPreviewResponseModel,
	HomeyMappingPreviewWarningModel,
} from './models/mapping-preview.model';
import { HomeyStatusModel, HomeyStatusResponseModel } from './models/status.model';
import { HomeyTestConnectionModel, HomeyTestConnectionResponseModel } from './models/test-connection.model';

export const DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS = [
	HomeyConfigModel,
	HomeyUpdatePluginConfigDto,
	ListHomeyDevicesQueryDto,
	HomeyCapabilitySummaryModel,
	HomeyInventoryDeviceModel,
	HomeyInventoryDevicesResponseModel,
	HomeyInventoryDeviceResponseModel,
	HomeyMappingPreviewRequestDto,
	HomeyMappingPreviewRangeModel,
	HomeyMappingPreviewConversionModel,
	HomeyMappingPreviewPropertyModel,
	HomeyMappingPreviewChannelModel,
	HomeyMappingPreviewWarningModel,
	HomeyMappingPreviewDeviceModel,
	HomeyMappingPreviewModel,
	HomeyMappingPreviewResponseModel,
	HomeyAdoptDeviceDto,
	HomeyBatchAdoptDevicesDto,
	HomeyAdoptionResultModel,
	HomeyBatchAdoptionModel,
	HomeyAdoptionResponseModel,
	HomeyBatchAdoptionResponseModel,
	HomeyStatusModel,
	HomeyStatusResponseModel,
	HomeyTestConnectionDto,
	HomeyTestSavedConnectionDto,
	HomeyTestCandidateConnectionDto,
	HomeyTestConnectionRequestDto,
	HomeyTestConnectionModel,
	HomeyTestConnectionResponseModel,
	HomeyDeviceEntity,
	HomeyChannelEntity,
	HomeyChannelPropertyEntity,
	CreateHomeyDeviceDto,
	CreateHomeyDeviceChannelDto,
	CreateHomeyDeviceChannelPropertyDto,
	UpdateHomeyDeviceDto,
	CreateHomeyChannelDto,
	UpdateHomeyChannelDto,
	CreateHomeyChannelPropertyDto,
	UpdateHomeyChannelPropertyDto,
];
