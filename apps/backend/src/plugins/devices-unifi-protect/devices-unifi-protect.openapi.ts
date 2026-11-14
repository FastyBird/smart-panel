import { CreateProtectChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateProtectChannelDto } from './dto/create-channel.dto';
import { CreateProtectDeviceChannelPropertyDto } from './dto/create-device-channel-property.dto';
import { CreateProtectDeviceChannelDto } from './dto/create-device-channel.dto';
import { CreateProtectDeviceDto } from './dto/create-device.dto';
import { UpdateProtectChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateProtectChannelDto } from './dto/update-channel.dto';
import { ProtectUpdatePluginConfigDto, ProtectUpdateTlsConfigDto } from './dto/update-config.dto';
import { UpdateProtectDeviceDto } from './dto/update-device.dto';
import {
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	ProtectDeviceEntity,
} from './entities/devices-unifi-protect.entity';
import { ProtectConfigModel, ProtectTlsConfigModel } from './models/config.model';

export const DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS = [
	ProtectTlsConfigModel,
	ProtectConfigModel,
	ProtectUpdateTlsConfigDto,
	ProtectUpdatePluginConfigDto,
	ProtectDeviceEntity,
	ProtectChannelEntity,
	ProtectChannelPropertyEntity,
	CreateProtectDeviceDto,
	CreateProtectDeviceChannelDto,
	CreateProtectDeviceChannelPropertyDto,
	UpdateProtectDeviceDto,
	CreateProtectChannelDto,
	UpdateProtectChannelDto,
	CreateProtectChannelPropertyDto,
	UpdateProtectChannelPropertyDto,
];
