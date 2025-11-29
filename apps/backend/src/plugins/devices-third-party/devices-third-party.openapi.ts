/**
 * OpenAPI extra models for Devices Third Party plugin
 */
import { PropertyUpdateRequestDto } from './dto/third-party-property-update-request.dto';
import { PropertiesUpdateResultModel, PropertyUpdateResultModel } from './dto/third-party-property-update-response.dto';
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
