import { CreateReTerminalChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateReTerminalChannelDto } from './dto/create-channel.dto';
import { CreateReTerminalDeviceDto } from './dto/create-device.dto';
import { UpdateReTerminalChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateReTerminalChannelDto } from './dto/update-channel.dto';
import { ReTerminalUpdatePluginConfigDto, ReTerminalUpdatePollingDto } from './dto/update-config.dto';
import { UpdateReTerminalDeviceDto } from './dto/update-device.dto';
import {
	ReTerminalChannelEntity,
	ReTerminalChannelPropertyEntity,
	ReTerminalDeviceEntity,
} from './entities/devices-reterminal.entity';
import { ReTerminalConfigModel, ReTerminalPollingConfigModel } from './models/config.model';

export const DEVICES_RETERMINAL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateReTerminalDeviceDto,
	UpdateReTerminalDeviceDto,
	CreateReTerminalChannelDto,
	UpdateReTerminalChannelDto,
	CreateReTerminalChannelPropertyDto,
	UpdateReTerminalChannelPropertyDto,
	ReTerminalUpdatePluginConfigDto,
	ReTerminalUpdatePollingDto,
	// Config models
	ReTerminalConfigModel,
	ReTerminalPollingConfigModel,
	// Entities
	ReTerminalDeviceEntity,
	ReTerminalChannelEntity,
	ReTerminalChannelPropertyEntity,
];
