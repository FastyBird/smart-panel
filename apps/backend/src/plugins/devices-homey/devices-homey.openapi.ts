import { CreateHomeyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateHomeyChannelDto } from './dto/create-channel.dto';
import { CreateHomeyDeviceDto } from './dto/create-device.dto';
import { UpdateHomeyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateHomeyChannelDto } from './dto/update-channel.dto';
import { HomeyUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateHomeyDeviceDto } from './dto/update-device.dto';
import { HomeyChannelEntity, HomeyChannelPropertyEntity, HomeyDeviceEntity } from './entities/devices-homey.entity';
import { HomeyConfigModel } from './models/config.model';
import { HomeyStatusModel, HomeyStatusResponseModel } from './models/status.model';

export const DEVICES_HOMEY_PLUGIN_SWAGGER_EXTRA_MODELS = [
	HomeyConfigModel,
	HomeyUpdatePluginConfigDto,
	HomeyStatusModel,
	HomeyStatusResponseModel,
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
