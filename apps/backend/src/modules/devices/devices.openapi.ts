/**
 * OpenAPI extra models for Devices module
 */
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from './entities/devices.entity';
import {
	DeviceValidationResponseModel,
	DeviceValidationResultModel,
	DevicesValidationModel,
	DevicesValidationResponseModel,
	ValidationIssueModel,
	ValidationSummaryModel,
} from './models/device-validation.model';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleDeviceCategory,
} from './models/devices-enums.model';
import {
	ChannelControlResponseModel,
	ChannelControlsResponseModel,
	ChannelPropertiesResponseModel,
	ChannelPropertyResponseModel,
	ChannelResponseModel,
	ChannelsResponseModel,
	DeviceChannelResponseModel,
	DeviceChannelsResponseModel,
	DeviceControlResponseModel,
	DeviceControlsResponseModel,
	DeviceResponseModel,
	DevicesResponseModel,
	PropertyTimeseriesResponseModel,
} from './models/devices-response.model';
import {
	ChannelPropertySpecModel,
	ChannelSpecModel,
	DataTypeVariantSpecModel,
	DeviceChannelSpecModel,
	DeviceSpecModel,
	ModuleStatsModel,
	OnlineNowModel,
	PropertyTimeseriesModel,
	RegisteredChannelsModel,
	RegisteredDevicesModel,
	TimeseriesPointModel,
	UpdatesPerMinModel,
	UpdatesTodayModel,
} from './models/devices.model';

export const DEVICES_SWAGGER_EXTRA_MODELS = [
	// Response models
	DeviceResponseModel,
	DevicesResponseModel,
	ChannelResponseModel,
	ChannelsResponseModel,
	DeviceChannelResponseModel,
	DeviceChannelsResponseModel,
	ChannelPropertyResponseModel,
	ChannelPropertiesResponseModel,
	DeviceControlResponseModel,
	DeviceControlsResponseModel,
	ChannelControlResponseModel,
	ChannelControlsResponseModel,
	PropertyTimeseriesResponseModel,
	// Validation response models
	DevicesValidationResponseModel,
	DeviceValidationResponseModel,
	// Validation data models
	DevicesValidationModel,
	DeviceValidationResultModel,
	ValidationSummaryModel,
	ValidationIssueModel,
	// Data models
	DeviceChannelSpecModel,
	DeviceSpecModel,
	ChannelPropertySpecModel,
	ChannelSpecModel,
	DataTypeVariantSpecModel,
	RegisteredDevicesModel,
	RegisteredChannelsModel,
	UpdatesPerMinModel,
	UpdatesTodayModel,
	OnlineNowModel,
	ModuleStatsModel,
	TimeseriesPointModel,
	PropertyTimeseriesModel,
	// Enum wrapper models
	DevicesModuleDeviceCategory,
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	// Entities
	DeviceEntity,
	DeviceControlEntity,
	ChannelEntity,
	ChannelControlEntity,
	ChannelPropertyEntity,
];
