import { CreateHomeyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeyChannelDto } from './dto/create-channel.dto';
import { CreateHomeyDeviceDto } from './dto/create-device.dto';
import { ListHomeyDevicesQueryDto } from './dto/list-homey-devices.dto';
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
import { HomeyConfigModel } from './models/config.model';
import {
	HomeyCapabilitySummaryModel,
	HomeyInventoryDeviceModel,
	HomeyInventoryDeviceResponseModel,
	HomeyInventoryDevicesResponseModel,
} from './models/inventory.model';
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
	UpdateHomeyDeviceDto,
	CreateHomeyChannelDto,
	UpdateHomeyChannelDto,
	CreateHomeyChannelPropertyDto,
	UpdateHomeyChannelPropertyDto,
];
