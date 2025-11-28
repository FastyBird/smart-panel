/**
 * Central collection point for all Swagger extra models
 * 
 * Each module/plugin maintains isolation by:
 * 1. Declaring models via @ApiExtraModels decorator on the module
 * 2. Exporting models from module-specific files
 * 
 * This file imports and collects all models for SwaggerModule.createDocument()
 * This is necessary because @ApiExtraModels alone doesn't register models during OpenAPI generation
 */

import { Type } from '@nestjs/common';

// Import models from each module (modules maintain their own exports)
import {
	// Base models from ApiModule
	BaseSuccessResponseModel,
	BaseErrorResponseModel,
	BadRequestErrorModel,
	ForbiddenErrorModel,
	NotFoundErrorModel,
	UnprocessableEntityErrorModel,
	InternalServerErrorModel,
} from './api-response.model';

// Auth module models
import {
	ProfileResponseModel,
	LoginResponseModel,
	RefreshResponseModel,
	RegisterDisplayResponseModel,
	CheckEmailResponseModel,
	CheckUsernameResponseModel,
	DisplaySecretResponseModel,
	TokenPairResponseModel,
	TokenResponseModel,
	TokensResponseModel,
} from '../../auth/models/auth-response.model';
import {
	CreateAccessTokenDto,
	CreateRefreshTokenDto,
	CreateLongLiveTokenDto,
} from '../../auth/dto/create-token.dto';
import {
	UpdateAccessTokenDto,
	UpdateRefreshTokenDto,
	UpdateLongLiveTokenDto,
} from '../../auth/dto/update-token.dto';

// Config module models
import {
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
} from '../../config/models/config-response.model';
import {
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherZipCodeConfigDto,
	UpdateSystemConfigDto,
} from '../../config/dto/config.dto';
import {
	WeatherLatLonConfigModel,
	WeatherCityNameConfigModel,
	WeatherCityIdConfigModel,
	WeatherZipCodeConfigModel,
} from '../../config/models/config.model';

// Dashboard module models
import {
	PageResponseModel,
	PagesResponseModel,
	TileResponseModel,
	TilesResponseModel,
	DataSourceResponseModel,
	DataSourcesResponseModel,
} from '../../dashboard/models/dashboard-response.model';
import { CreateDataSourceDto, CreateSingleDataSourceDto } from '../../dashboard/dto/create-data-source.dto';
import { CreateTileDto } from '../../dashboard/dto/create-tile.dto';

// Devices module models
import {
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
} from '../../devices/models/devices-response.model';
import { TimeseriesPointModel } from '../../devices/models/devices.model';

// Stats module models
import {
	StatsResponseModel,
	StatResponseModel,
	StatsKeysResponseModel,
} from '../../stats/models/stats-response.model';

// System module models
import {
	DisplayProfileResponseModel,
	DisplayProfilesResponseModel,
	DisplayProfileByUidResponseModel,
	ExtensionsResponseModel,
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
} from '../../system/models/system-response.model';
import { CreateLogEntryDto } from '../../system/dto/create-log-entry.dto';
import { ExtensionAdminModel, ExtensionBackendModel, ExtensionBaseModel, LogEntryModel } from '../../system/models/system.model';

// Users module models
import {
	UserResponseModel,
	UsersResponseModel,
	DisplayInstanceResponseModel,
	DisplayInstancesResponseModel,
	DisplayInstanceByUidResponseModel,
} from '../../users/models/users-response.model';

// Weather module models
import {
	LocationWeatherResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
} from '../../weather/models/weather-response.model';
import { GeolocationCityModel } from '../../weather/models/geolocation.model';

// Plugin models
import {
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantEntityRegistryResponseModel,
} from '../../../plugins/devices-home-assistant/models/home-assistant-response.model';
import {
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantEntityRegistryResultModel,
} from '../../../plugins/devices-home-assistant/models/home-assistant.model';

import { DemoControlResponseModel } from '../../../plugins/devices-third-party/models/demo-control-response.model';
import { PropertyUpdateRequestDto } from '../../../plugins/devices-third-party/dto/third-party-property-update-request.dto';

import {
	ShellyNgDeviceInfoResponseModel,
	ShellyNgSupportedDevicesResponseModel,
} from '../../../plugins/devices-shelly-ng/models/shelly-ng-response.model';
import {
	ShellyNgDeviceInfoComponentModel,
	ShellyNgSupportedDeviceModel,
	ShellyNgSupportedDeviceComponentModel,
	ShellyNgSupportedDeviceSystemComponentModel,
} from '../../../plugins/devices-shelly-ng/models/shelly-ng.model';

import {
	ShellyV1DeviceInfoResponseModel,
	ShellyV1SupportedDevicesResponseModel,
} from '../../../plugins/devices-shelly-v1/models/shelly-v1-response.model';
import { ShellyV1SupportedDeviceModel } from '../../../plugins/devices-shelly-v1/models/shelly-v1.model';

import {
	CardResponseModel,
	CardsResponseModel,
} from '../../../plugins/pages-cards/models/pages-cards-response.model';
import { CreateSingleCardDto } from '../../../plugins/pages-cards/dto/create-card.dto';

// Tile plugin DTOs
import { CreateDayWeatherTileDto, CreateForecastWeatherTileDto } from '../../../plugins/tiles-weather/dto/create-tile.dto';
import { UpdateDayWeatherTileDto, UpdateForecastWeatherTileDto } from '../../../plugins/tiles-weather/dto/update-tile.dto';
import { CreateTimeTileDto } from '../../../plugins/tiles-time/dto/create-tile.dto';
import { UpdateTimeTileDto } from '../../../plugins/tiles-time/dto/update-tile.dto';
import { CreateDevicePreviewTileDto } from '../../../plugins/tiles-device-preview/dto/create-tile.dto';
import { UpdateDevicePreviewTileDto } from '../../../plugins/tiles-device-preview/dto/update-tile.dto';

// Page plugin DTOs
import { CreateTilesPageDto } from '../../../plugins/pages-tiles/dto/create-page.dto';
import { UpdateTilesPageDto } from '../../../plugins/pages-tiles/dto/update-page.dto';
import { CreateDeviceDetailPageDto } from '../../../plugins/pages-device-detail/dto/create-page.dto';
import { UpdateDeviceDetailPageDto } from '../../../plugins/pages-device-detail/dto/update-page.dto';

// Data source plugin DTOs
import { CreateDeviceChannelDataSourceDto } from '../../../plugins/data-sources-device-channel/dto/create-data-source.dto';
import { UpdateDeviceChannelDataSourceDto } from '../../../plugins/data-sources-device-channel/dto/update-data-source.dto';

/**
 * Array of all models that need to be included in Swagger extraModels
 * This collects models declared via @ApiExtraModels in each module
 */
export const swaggerExtraModels: Type<any>[] = [
	// Base models
	BaseSuccessResponseModel,
	BaseErrorResponseModel,
	BadRequestErrorModel,
	ForbiddenErrorModel,
	NotFoundErrorModel,
	UnprocessableEntityErrorModel,
	InternalServerErrorModel,
	// Auth module
	ProfileResponseModel,
	LoginResponseModel,
	RefreshResponseModel,
	RegisterDisplayResponseModel,
	CheckEmailResponseModel,
	CheckUsernameResponseModel,
	DisplaySecretResponseModel,
	TokenPairResponseModel,
	TokenResponseModel,
	TokensResponseModel,
	CreateAccessTokenDto,
	CreateRefreshTokenDto,
	CreateLongLiveTokenDto,
	UpdateAccessTokenDto,
	UpdateRefreshTokenDto,
	UpdateLongLiveTokenDto,
	// Config module
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
	UpdateAudioConfigDto,
	UpdateDisplayConfigDto,
	UpdateLanguageConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherZipCodeConfigDto,
	UpdateSystemConfigDto,
	WeatherLatLonConfigModel,
	WeatherCityNameConfigModel,
	WeatherCityIdConfigModel,
	WeatherZipCodeConfigModel,
	// Dashboard module
	PageResponseModel,
	PagesResponseModel,
	TileResponseModel,
	TilesResponseModel,
	DataSourceResponseModel,
	DataSourcesResponseModel,
	CreateSingleDataSourceDto,
	// Abstract classes - needed for getSchemaPath() references, using 'as any' to bypass type check
	CreateDataSourceDto as any,
	CreateTileDto as any,
	// Devices module
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
	TimeseriesPointModel,
	// Stats module
	StatsResponseModel,
	StatResponseModel,
	StatsKeysResponseModel,
	// System module
	DisplayProfileResponseModel,
	DisplayProfilesResponseModel,
	DisplayProfileByUidResponseModel,
	ExtensionsResponseModel,
	LogEntriesResponseModel,
	LogEntryAcceptedResponseModel,
	SystemHealthResponseModel,
	SystemInfoResponseModel,
	ThrottleStatusResponseModel,
	CreateLogEntryDto,
	LogEntryModel,
	// Abstract class and implementations - needed for getSchemaPath() references
	ExtensionBaseModel as any,
	ExtensionAdminModel,
	ExtensionBackendModel,
	// Users module
	UserResponseModel,
	UsersResponseModel,
	DisplayInstanceResponseModel,
	DisplayInstancesResponseModel,
	DisplayInstanceByUidResponseModel,
	// Weather module
	LocationWeatherResponseModel,
	LocationCurrentResponseModel,
	LocationForecastResponseModel,
	GeolocationCityToCoordinatesResponseModel,
	GeolocationCoordinatesToCityResponseModel,
	GeolocationZipToCoordinatesResponseModel,
	GeolocationCityModel,
	// Plugin models
	HomeAssistantDiscoveredDeviceResponseModel,
	HomeAssistantDiscoveredDevicesResponseModel,
	HomeAssistantStateResponseModel,
	HomeAssistantStatesResponseModel,
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantEntityRegistryResponseModel,
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantEntityRegistryResultModel,
	DemoControlResponseModel,
	PropertyUpdateRequestDto,
	ShellyNgDeviceInfoResponseModel,
	ShellyNgSupportedDevicesResponseModel,
	ShellyNgDeviceInfoComponentModel,
	ShellyNgSupportedDeviceModel,
	ShellyNgSupportedDeviceComponentModel,
	ShellyNgSupportedDeviceSystemComponentModel,
	ShellyV1DeviceInfoResponseModel,
	ShellyV1SupportedDevicesResponseModel,
	ShellyV1SupportedDeviceModel,
	CardResponseModel,
	CardsResponseModel,
	CreateSingleCardDto,
	// Tile plugin DTOs
	CreateDayWeatherTileDto,
	CreateForecastWeatherTileDto,
	UpdateDayWeatherTileDto,
	UpdateForecastWeatherTileDto,
	CreateTimeTileDto,
	UpdateTimeTileDto,
	CreateDevicePreviewTileDto,
	UpdateDevicePreviewTileDto,
	// Page plugin DTOs
	CreateTilesPageDto,
	UpdateTilesPageDto,
	CreateDeviceDetailPageDto,
	UpdateDeviceDetailPageDto,
	// Data source plugin DTOs
	CreateDeviceChannelDataSourceDto,
	UpdateDeviceChannelDataSourceDto,
];
