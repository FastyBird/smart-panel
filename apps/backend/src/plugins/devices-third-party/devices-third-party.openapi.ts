/**
 * OpenAPI extra models for Devices Third Party plugin
 */
import { CreateThirdPartyChannelPropertyDto } from './dto/create-channel-property.dto';
import { CreateThirdPartyChannelDto } from './dto/create-channel.dto';
import { CreateThirdPartyDeviceDto } from './dto/create-device.dto';
import { PropertyUpdateRequestDto } from './dto/third-party-property-update-request.dto';
import { PropertiesUpdateResultModel, PropertyUpdateResultModel } from './dto/third-party-property-update-response.dto';
import { UpdateThirdPartyChannelPropertyDto } from './dto/update-channel-property.dto';
import { UpdateThirdPartyChannelDto } from './dto/update-channel.dto';
import { ThirdPartyUpdatePluginConfigDto } from './dto/update-config.dto';
import { UpdateThirdPartyDeviceDto } from './dto/update-device.dto';
import {
	ThirdPartyChannelEntity,
	ThirdPartyChannelPropertyEntity,
	ThirdPartyDeviceEntity,
} from './entities/devices-third-party.entity';
import { ThirdPartyConfigModel } from './models/config.model';
import { PropertiesUpdateResultResponseModel } from './models/demo-control-response.model';
import {
	DevicesThirdPartyPluginErrorCode,
	ThirdPartyDemoControlModel,
	ThirdPartyDemoControlPropertyModel,
} from './models/demo-control.model';

export const DEVICES_THIRD_PARTY_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// DTOs
	CreateThirdPartyDeviceDto,
	UpdateThirdPartyDeviceDto,
	CreateThirdPartyChannelDto,
	UpdateThirdPartyChannelDto,
	CreateThirdPartyChannelPropertyDto,
	UpdateThirdPartyChannelPropertyDto,
	ThirdPartyUpdatePluginConfigDto,
	PropertyUpdateRequestDto,
	// Response models
	PropertiesUpdateResultResponseModel,
	// Data models
	DevicesThirdPartyPluginErrorCode,
	ThirdPartyDemoControlPropertyModel,
	ThirdPartyDemoControlModel,
	PropertyUpdateResultModel,
	PropertiesUpdateResultModel,
	ThirdPartyConfigModel,
	// Entities
	ThirdPartyDeviceEntity,
	ThirdPartyChannelEntity,
	ThirdPartyChannelPropertyEntity,
];
