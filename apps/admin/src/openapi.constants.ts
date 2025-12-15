/**
 * OpenAPI Constants - Backward Compatible Re-exports
 *
 * This file provides backward-compatible re-exports of enums and types
 * from openapi.ts using their old names. This allows existing code to
 * continue working without requiring widespread changes.
 *
 * @module openapi.constants
 */

// Core OpenAPI Types
// ==================
import type { components, operations, paths } from './openapi';

// Paths type alias for Client<paths> usage
export type OpenApiPaths = paths;

// Component Schema Type Aliases
// =============================

// Auth Module Schemas
export type AuthModuleLoginSchema = components['schemas']['AuthModuleLogin'];
export type AuthModuleTokenPairSchema = components['schemas']['AuthModuleDataTokenPair'];

// Users Module Schemas
export type UsersModuleCreateUserSchema = components['schemas']['UsersModuleCreateUser'];
export type UsersModuleUpdateUserSchema = components['schemas']['UsersModuleUpdateUser'];
export type UsersModuleUserSchema = components['schemas']['UsersModuleDataUser'];

// Devices Module Schemas
export type DevicesModuleCreateDeviceSchema = components['schemas']['DevicesModuleCreateDevice'];
export type DevicesModuleUpdateDeviceSchema = components['schemas']['DevicesModuleUpdateDevice'];
export type DevicesModuleDeviceSchema = components['schemas']['DevicesModuleDataDevice'];
export type DevicesModuleCreateChannelSchema = components['schemas']['DevicesModuleCreateChannel'];
export type DevicesModuleUpdateChannelSchema = components['schemas']['DevicesModuleUpdateChannel'];
export type DevicesModuleChannelSchema = components['schemas']['DevicesModuleDataChannel'];
export type DevicesModuleCreateChannelPropertySchema = components['schemas']['DevicesModuleCreateChannelProperty'];
export type DevicesModuleUpdateChannelPropertySchema = components['schemas']['DevicesModuleUpdateChannelProperty'];
export type DevicesModuleChannelPropertySchema = components['schemas']['DevicesModuleDataChannelProperty'];
export type DevicesModuleCreateChannelControlSchema = components['schemas']['DevicesModuleCreateChannelControl'];
export type DevicesModuleChannelControlSchema = components['schemas']['DevicesModuleDataChannelControl'];
export type DevicesModuleCreateDeviceControlSchema = components['schemas']['DevicesModuleCreateDeviceControl'];
export type DevicesModuleDeviceControlSchema = components['schemas']['DevicesModuleDataDeviceControl'];

// Dashboard Module Schemas
export type DashboardModuleCreatePageSchema = components['schemas']['DashboardModuleCreatePage'];
export type DashboardModuleUpdatePageSchema = components['schemas']['DashboardModuleUpdatePage'];
export type DashboardModulePageSchema = components['schemas']['DashboardModuleDataPage'];
export type DashboardModuleCreateTileSchema = components['schemas']['DashboardModuleCreateTile'];
export type DashboardModuleUpdateTileSchema = components['schemas']['DashboardModuleUpdateSingleTile'];
export type DashboardModuleTileSchema = components['schemas']['DashboardModuleDataTile'];
export type DashboardModuleCreateDataSourceSchema = components['schemas']['DashboardModuleCreateDataSource'];
export type DashboardModuleUpdateDataSourceSchema = components['schemas']['DashboardModuleUpdateSingleDataSource'];
export type DashboardModuleDataSourceSchema = components['schemas']['DashboardModuleDataDataSource'];

// Config Module Schemas
// Weather, System, and Language section schemas removed - these configs are now accessed via modules (weather-module, system-module)
export type ConfigModuleAppSchema = components['schemas']['ConfigModuleDataApp'];
export type ConfigModulePluginSchema = components['schemas']['ConfigModuleDataPlugin'];
export type ConfigModuleUpdatePluginSchema = components['schemas']['ConfigModuleUpdatePlugin'];
export type ConfigModuleModuleSchema = components['schemas']['ConfigModuleDataModule'];
export type ConfigModuleUpdateModuleSchema = components['schemas']['ConfigModuleUpdateModule'];

// Displays Module Schemas
export type DisplaysModuleDisplaySchema = components['schemas']['DisplaysModuleDataDisplay'];
export type DisplaysModuleUpdateDisplaySchema = components['schemas']['DisplaysModuleUpdateDisplay'];
export type DisplaysModuleRegisterDisplaySchema = components['schemas']['DisplaysModuleRegisterDisplay'];
export type DisplaysModuleRegistrationSchema = components['schemas']['DisplaysModuleDataRegistration'];
export type DisplaysModuleLongLiveTokenSchema = components['schemas']['AuthModuleDataLongLiveToken'];

// System Module Schemas
export type SystemModuleExtensionAdminSchema = components['schemas']['SystemModuleDataExtensionAdmin'];
export type SystemModuleExtensionBackendSchema = components['schemas']['SystemModuleDataExtensionBackend'];
export type SystemModuleCreateLogEntrySchema = components['schemas']['SystemModuleCreateLogEntry'];
export type SystemModuleLogEntrySchema = components['schemas']['SystemModuleDataLogEntry'];
export type SystemModuleSystemInfoSchema = components['schemas']['SystemModuleDataSystemInfo'];
export type SystemModuleThrottleStatusSchema = components['schemas']['SystemModuleDataThrottleStatus'];

// Weather Module Schemas
export type WeatherModuleCurrentDaySchema = components['schemas']['WeatherModuleDataCurrentDay'];
export type WeatherModuleForecastDaySchema = components['schemas']['WeatherModuleDataForecastDay'];
export type WeatherModuleGeolocationCitySchema = components['schemas']['WeatherModuleDataGeolocationCity'];
export type WeatherModuleGeolocationZipSchema = components['schemas']['WeatherModuleDataGeolocationZip'];

// Stats Module Schemas
export type StatsModuleStatsSchema = components['schemas']['StatsModuleDataStats'];

// Tiles Weather Plugin Schemas
export type TilesWeatherPluginCreateDayWeatherTileSchema = components['schemas']['TilesWeatherPluginCreateDayWeatherTile'];
export type TilesWeatherPluginCreateForecastWeatherTileSchema = components['schemas']['TilesWeatherPluginCreateForecastWeatherTile'];
export type TilesWeatherPluginUpdateDayWeatherTileSchema = components['schemas']['TilesWeatherPluginUpdateDayWeatherTile'];
export type TilesWeatherPluginUpdateForecastWeatherTileSchema = components['schemas']['TilesWeatherPluginUpdateForecastWeatherTile'];
export type TilesWeatherPluginDayWeatherTileSchema = components['schemas']['TilesWeatherPluginDataDayWeatherTile'];
export type TilesWeatherPluginForecastWeatherTileSchema = components['schemas']['TilesWeatherPluginDataForecastWeatherTile'];

// Tiles Time Plugin Schemas
export type TilesTimePluginCreateTimeTileSchema = components['schemas']['TilesTimePluginCreateTimeTile'];
export type TilesTimePluginUpdateTimeTileSchema = components['schemas']['TilesTimePluginUpdateTimeTile'];
export type TilesTimePluginTimeTileSchema = components['schemas']['TilesTimePluginDataTimeTile'];

// Tiles Device Preview Plugin Schemas
export type TilesDevicePreviewPluginCreateDevicePreviewTileSchema = components['schemas']['TilesDevicePreviewPluginCreateDevicePreviewTile'];
export type TilesDevicePreviewPluginUpdateDevicePreviewTileSchema = components['schemas']['TilesDevicePreviewPluginUpdateDevicePreviewTile'];
export type TilesDevicePreviewPluginDevicePreviewTileSchema = components['schemas']['TilesDevicePreviewPluginDataDevicePreviewTile'];

// Pages Device Detail Plugin Schemas
export type PagesDeviceDetailPluginCreateDeviceDetailPageSchema = components['schemas']['PagesDeviceDetailPluginCreateDeviceDetailPage'];
export type PagesDeviceDetailPluginUpdateDeviceDetailPageSchema = components['schemas']['PagesDeviceDetailPluginUpdateDeviceDetailPage'];
export type PagesDeviceDetailPluginDeviceDetailPageSchema = components['schemas']['PagesDeviceDetailPluginDataDeviceDetailPage'];

// Pages Tiles Plugin Schemas
export type PagesTilesPluginCreateTilesPageSchema = components['schemas']['PagesTilesPluginCreateTilesPage'];
export type PagesTilesPluginUpdateTilesPageSchema = components['schemas']['PagesTilesPluginUpdateTilesPage'];
export type PagesTilesPluginTilesPageSchema = components['schemas']['PagesTilesPluginDataTilesPage'];

// Logger Rotating File Plugin Schemas
export type LoggerRotatingFilePluginUpdateConfigSchema = components['schemas']['LoggerRotatingFilePluginUpdateConfig'];
export type LoggerRotatingFilePluginConfigSchema = components['schemas']['LoggerRotatingFilePluginDataConfig'];

// Devices Home Assistant Plugin Schemas
export type DevicesHomeAssistantPluginCreateDeviceSchema = components['schemas']['DevicesHomeAssistantPluginCreateDevice'];
export type DevicesHomeAssistantPluginUpdateDeviceSchema = components['schemas']['DevicesHomeAssistantPluginUpdateDevice'];
export type DevicesHomeAssistantPluginDeviceSchema = components['schemas']['DevicesHomeAssistantPluginDataDevice'];
export type DevicesHomeAssistantPluginCreateChannelSchema = components['schemas']['DevicesHomeAssistantPluginCreateChannel'];
export type DevicesHomeAssistantPluginUpdateChannelSchema = components['schemas']['DevicesHomeAssistantPluginUpdateChannel'];
export type DevicesHomeAssistantPluginChannelSchema = components['schemas']['DevicesHomeAssistantPluginDataChannel'];
export type DevicesHomeAssistantPluginCreateChannelPropertySchema = components['schemas']['DevicesHomeAssistantPluginCreateChannelProperty'];
export type DevicesHomeAssistantPluginUpdateChannelPropertySchema = components['schemas']['DevicesHomeAssistantPluginUpdateChannelProperty'];
export type DevicesHomeAssistantPluginChannelPropertySchema = components['schemas']['DevicesHomeAssistantPluginDataChannelProperty'];
export type DevicesHomeAssistantPluginDiscoveredDeviceSchema = components['schemas']['DevicesHomeAssistantPluginDataDiscoveredDevice'];
export type DevicesHomeAssistantPluginStateSchema = components['schemas']['DevicesHomeAssistantPluginDataState'];
export type DevicesHomeAssistantPluginUpdateConfigSchema = components['schemas']['DevicesHomeAssistantPluginUpdateConfig'];
export type DevicesHomeAssistantPluginConfigSchema = components['schemas']['DevicesHomeAssistantPluginDataConfig'];

// Data Sources Device Channel Plugin Schemas
export type DataSourcesDeviceChannelPluginCreateDeviceChannelDataSourceSchema = components['schemas']['DataSourcesDeviceChannelPluginCreateDeviceChannelDataSource'];
export type DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceSchema = components['schemas']['DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource'];
export type DataSourcesDeviceChannelPluginDeviceChannelDataSourceSchema = components['schemas']['DataSourcesDeviceChannelPluginDataDeviceChannelDataSource'];

// Devices Shelly NG Plugin Schemas
export type DevicesShellyNgPluginUpdateConfigSchema = components['schemas']['DevicesShellyNgPluginUpdateConfig'];
export type DevicesShellyNgPluginConfigSchema = components['schemas']['DevicesShellyNgPluginDataShellyNgConfig'];
export type DevicesShellyNgPluginCreateDeviceSchema = components['schemas']['DevicesShellyNgPluginCreateDevice'];
export type DevicesShellyNgPluginUpdateDeviceSchema = components['schemas']['DevicesShellyNgPluginUpdateDevice'];
export type DevicesShellyNgPluginDeviceSchema = components['schemas']['DevicesShellyNgPluginDataDevice'];
export type DevicesShellyNgPluginCreateChannelSchema = components['schemas']['DevicesShellyNgPluginCreateChannel'];
export type DevicesShellyNgPluginUpdateChannelSchema = components['schemas']['DevicesShellyNgPluginUpdateChannel'];
export type DevicesShellyNgPluginChannelSchema = components['schemas']['DevicesShellyNgPluginDataChannel'];
export type DevicesShellyNgPluginCreateChannelPropertySchema = components['schemas']['DevicesShellyNgPluginCreateChannelProperty'];
export type DevicesShellyNgPluginUpdateChannelPropertySchema = components['schemas']['DevicesShellyNgPluginUpdateChannelProperty'];
export type DevicesShellyNgPluginChannelPropertySchema = components['schemas']['DevicesShellyNgPluginDataChannelProperty'];

// Devices Third Party Plugin Schemas
export type DevicesThirdPartyPluginCreateDeviceSchema = components['schemas']['DevicesThirdPartyPluginCreateDevice'];
export type DevicesThirdPartyPluginUpdateDeviceSchema = components['schemas']['DevicesThirdPartyPluginUpdateDevice'];
export type DevicesThirdPartyPluginDeviceSchema = components['schemas']['DevicesThirdPartyPluginDataDevice'];
export type DevicesThirdPartyPluginCreateChannelSchema = components['schemas']['DevicesThirdPartyPluginCreateChannel'];
export type DevicesThirdPartyPluginUpdateChannelSchema = components['schemas']['DevicesThirdPartyPluginUpdateChannel'];
export type DevicesThirdPartyPluginChannelSchema = components['schemas']['DevicesThirdPartyPluginDataChannel'];
export type DevicesThirdPartyPluginCreateChannelPropertySchema = components['schemas']['DevicesThirdPartyPluginCreateChannelProperty'];
export type DevicesThirdPartyPluginUpdateChannelPropertySchema = components['schemas']['DevicesThirdPartyPluginUpdateChannelProperty'];
export type DevicesThirdPartyPluginChannelPropertySchema = components['schemas']['DevicesThirdPartyPluginDataChannelProperty'];

// Pages Cards Plugin Schemas
export type PagesCardsPluginCreateCardsPageSchema = components['schemas']['PagesCardsPluginCreateCardsPage'];
export type PagesCardsPluginUpdateCardsPageSchema = components['schemas']['PagesCardsPluginUpdateCardsPage'];
export type PagesCardsPluginCardsPageSchema = components['schemas']['PagesCardsPluginDataCardsPage'];
export type PagesCardsPluginCreateCardSchema = components['schemas']['PagesCardsPluginCreateCard'];
export type PagesCardsPluginUpdateCardSchema = components['schemas']['PagesCardsPluginUpdateCard'];
export type PagesCardsPluginCardSchema = components['schemas']['PagesCardsPluginDataCard'];

// Operation Type Aliases
// ======================

// Auth Module Operations
export type AuthModuleGetProfileOperation = operations['get-auth-module-profile'];
export type AuthModuleRegisterOperation = operations['create-auth-module-register'];

// Users Module Operations
export type UsersModuleGetUserOperation = operations['get-users-module-user'];
export type UsersModuleGetUsersOperation = operations['get-users-module-users'];
export type UsersModuleCreateUserOperation = operations['create-users-module-user'];
export type UsersModuleUpdateUserOperation = operations['update-users-module-user'];
export type UsersModuleDeleteUserOperation = operations['delete-users-module-user'];

// Devices Module Operations
export type DevicesModuleGetDeviceOperation = operations['get-devices-module-device'];
export type DevicesModuleGetDevicesOperation = operations['get-devices-module-devices'];
export type DevicesModuleCreateDeviceOperation = operations['create-devices-module-device'];
export type DevicesModuleUpdateDeviceOperation = operations['update-devices-module-device'];
export type DevicesModuleDeleteDeviceOperation = operations['delete-devices-module-device'];
export type DevicesModuleGetChannelOperation = operations['get-devices-module-channel'];
export type DevicesModuleGetDeviceChannelOperation = operations['get-devices-module-device-channel'];
export type DevicesModuleGetChannelsOperation = operations['get-devices-module-channels'];
export type DevicesModuleGetDeviceChannelsOperation = operations['get-devices-module-device-channels'];
export type DevicesModuleCreateDeviceChannelOperation = operations['create-devices-module-device-channel'];
export type DevicesModuleUpdateChannelOperation = operations['update-devices-module-channel'];
export type DevicesModuleUpdateDeviceChannelOperation = operations['update-devices-module-device-channel'];
export type DevicesModuleDeleteChannelOperation = operations['delete-devices-module-channel'];
export type DevicesModuleDeleteDeviceChannelOperation = operations['delete-devices-module-device-channel'];
export type DevicesModuleGetChannelPropertyOperation = operations['get-devices-module-channel-property'];
export type DevicesModuleGetChannelPropertiesOperation = operations['get-devices-module-channel-properties'];
export type DevicesModuleCreateChannelPropertyOperation = operations['create-devices-module-channel-property'];
export type DevicesModuleUpdateChannelPropertyOperation = operations['update-devices-module-channel-property'];
export type DevicesModuleDeleteChannelPropertyOperation = operations['delete-devices-module-channel-property'];
export type DevicesModuleGetChannelControlOperation = operations['get-devices-module-channel-control'];
export type DevicesModuleGetChannelControlsOperation = operations['get-devices-module-channel-controls'];
export type DevicesModuleCreateChannelControlOperation = operations['create-devices-module-channel-control'];
export type DevicesModuleDeleteChannelControlOperation = operations['delete-devices-module-channel-control'];
export type DevicesModuleGetDeviceControlOperation = operations['get-devices-module-device-control'];
export type DevicesModuleGetDeviceControlsOperation = operations['get-devices-module-device-controls'];
export type DevicesModuleCreateDeviceControlOperation = operations['create-devices-module-device-control'];
export type DevicesModuleDeleteDeviceControlOperation = operations['delete-devices-module-device-control'];

// Dashboard Module Operations
export type DashboardModuleGetPageOperation = operations['get-dashboard-module-page'];
export type DashboardModuleGetPagesOperation = operations['get-dashboard-module-pages'];
export type DashboardModuleCreatePageOperation = operations['create-dashboard-module-page'];
export type DashboardModuleUpdatePageOperation = operations['update-dashboard-module-page'];
export type DashboardModuleDeletePageOperation = operations['delete-dashboard-module-page'];
export type DashboardModuleGetTileOperation = operations['get-dashboard-module-tile'];
export type DashboardModuleGetTilesOperation = operations['get-dashboard-module-tiles'];
export type DashboardModuleCreateTileOperation = operations['create-dashboard-module-tile'];
export type DashboardModuleUpdateTileOperation = operations['update-dashboard-module-tile'];
export type DashboardModuleDeleteTileOperation = operations['delete-dashboard-module-tile'];
export type DashboardModuleGetDataSourceOperation = operations['get-dashboard-module-data-source'];
export type DashboardModuleGetDataSourcesOperation = operations['get-dashboard-module-data-sources'];
export type DashboardModuleCreateDataSourceOperation = operations['create-dashboard-module-data-source'];
export type DashboardModuleUpdateDataSourceOperation = operations['update-dashboard-module-data-source'];
export type DashboardModuleDeleteDataSourceOperation = operations['delete-dashboard-module-data-source'];

// Config Module Operations
// Language, Weather, and System section operations removed - these configs are now accessed via modules
export type ConfigModuleGetConfigSectionOperation = operations['get-config-module-config-section']; // Deprecated but kept for backward compatibility
export type ConfigModuleGetConfigPluginOperation = operations['get-config-module-config-plugin'];
export type ConfigModuleUpdateConfigPluginOperation = operations['update-config-module-config-plugin'];
export type ConfigModuleGetConfigModuleOperation = operations['get-config-module-config-module'];
export type ConfigModuleUpdateConfigModuleOperation = operations['update-config-module-config-module'];
export type ConfigModuleGetConfigOperation = operations['get-config-module-config'];

// System Module Operations
export type SystemModuleGetExtensionOperation = operations['get-system-module-extension'];
export type SystemModuleGetExtensionsOperation = operations['get-system-module-extensions'];
export type SystemModuleGetLogsOperation = operations['get-system-module-logs'];
export type SystemModuleCreateLogsOperation = operations['create-system-module-logs'];
export type SystemModuleGetSystemInfoOperation = operations['get-system-module-system-info'];
export type SystemModuleGetSystemThrottleOperation = operations['get-system-module-system-throttle'];

// Weather Module Operations
export type WeatherModuleGetCurrentOperation = operations['get-weather-module-current'];

// Stats Module Operations
export type StatsModuleGetStatsOperation = operations['get-stats-module-stats'];

// Plugin Operations
// =================

// Devices Shelly NG Plugin Operations
export type DevicesShellyNgPluginGetSupportedOperation = operations['get-devices-shelly-ng-plugin-supported'];
export type DevicesShellyNgPluginCreateDeviceInfoOperation = operations['create-devices-shelly-ng-plugin-device-info'];

// Pages Cards Plugin Operations
export type PagesCardsPluginGetPageCardOperation = operations['get-pages-cards-plugin-page-card'];
export type PagesCardsPluginGetPageCardsOperation = operations['get-pages-cards-plugin-page-cards'];
export type PagesCardsPluginCreatePageCardOperation = operations['create-pages-cards-plugin-page-card'];
export type PagesCardsPluginUpdatePageCardOperation = operations['update-pages-cards-plugin-page-card'];
export type PagesCardsPluginDeletePageCardOperation = operations['delete-pages-cards-plugin-page-card'];

// Devices Home Assistant Plugin Operations
export type DevicesHomeAssistantPluginGetDeviceOperation = operations['get-devices-home-assistant-plugin-device'];
export type DevicesHomeAssistantPluginGetDevicesOperation = operations['get-devices-home-assistant-plugin-devices'];
export type DevicesHomeAssistantPluginGetStateOperation = operations['get-devices-home-assistant-plugin-state'];
export type DevicesHomeAssistantPluginGetStatesOperation = operations['get-devices-home-assistant-plugin-states'];

// Auth & User Enums
// =================
export { AuthModuleRegisterRole as UsersModuleUserRole } from './openapi';

// Device Category Enums
// =====================
export { DevicesModuleCreateDeviceCategory as DevicesModuleDeviceCategory } from './openapi';

export { DevicesModuleCreateDeviceChannelCategory as DevicesModuleChannelCategory } from './openapi';

export { DevicesModuleCreateDeviceChannelPropertyCategory as DevicesModuleChannelPropertyCategory } from './openapi';

export { DevicesModuleCreateDeviceChannelPropertyData_type as DevicesModuleChannelPropertyDataType } from './openapi';

export { DevicesModuleCreateDeviceChannelPropertyPermissions as DevicesModuleChannelPropertyPermissions } from './openapi';

// Device Status Enums
// ===================
export { DevicesModuleDataDeviceConnectionStatusStatus as DevicesModuleDeviceConnectionStatus } from './openapi';

// Config Module Enums
// ===================
// Language, Weather, and System section enums removed - these configs are now accessed via modules

// ConfigModuleSection removed - section-based endpoints are deprecated

// System Module Enums
// ===================
export { SystemModuleDataExtensionBaseSource as SystemModuleExtensionSource } from './openapi';

export { SystemModuleDataExtensionBaseSurface as SystemModuleExtensionSurface } from './openapi';

export { SystemModuleDataExtensionBaseKind as SystemModuleExtensionKind } from './openapi';

export { SystemModuleCreateLogEntrySource as SystemModuleLogEntrySource } from './openapi';

export { SystemModuleCreateLogEntryType as SystemModuleLogEntryType } from './openapi';

export { PathsModulesSystemExtensionsGetParametersQuerySurface as SystemModuleQuerySurface } from './openapi';

export { SystemModuleDataExtensionAdminType } from './openapi';

export { SystemModuleDataExtensionBackendType } from './openapi';

// Weather Config Location Types
// Weather location type enums removed - weather config is now accessed via weather-module
// ==============================
