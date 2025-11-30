/**
 * OpenAPI Constants - Backward Compatible Re-exports
 *
 * This file provides backward-compatible re-exports of enums and types
 * from openapi.ts using their old names. This allows existing code to
 * continue working without requiring widespread changes.
 *
 * @module openapi.constants
 */

// Auth & User Enums
// =================
export {
	AuthModuleRegisterRole as UsersModuleUserRole,
} from './openapi';

// Device Category Enums
// =====================
export {
	DevicesModuleCreateDeviceCategory as DevicesModuleDeviceCategory,
} from './openapi';

export {
	DevicesModuleCreateDeviceChannelCategory as DevicesModuleChannelCategory,
} from './openapi';

export {
	DevicesModuleCreateDeviceChannelPropertyCategory as DevicesModuleChannelPropertyCategory,
} from './openapi';

export {
	DevicesModuleCreateDeviceChannelPropertyData_type as DevicesModuleChannelPropertyDataType,
} from './openapi';

export {
	DevicesModuleCreateDeviceChannelPropertyPermissions as DevicesModuleChannelPropertyPermissions,
} from './openapi';

// Device Status Enums
// ===================
export {
	DevicesModuleDataDeviceConnectionStatusStatus as DevicesModuleDeviceConnectionStatus,
} from './openapi';

// Config Module Enums
// ===================
export {
	ConfigModuleUpdateLanguageLanguage as ConfigModuleLanguageLanguage,
} from './openapi';

export {
	ConfigModuleUpdateLanguageTime_format as ConfigModuleLanguageTimeFormat,
} from './openapi';

export {
	ConfigModuleUpdateWeatherUnit as ConfigModuleWeatherUnit,
} from './openapi';

export {
	ConfigModuleUpdateAudioType as ConfigModuleAudioType,
} from './openapi';

export {
	ConfigModuleUpdateDisplayType as ConfigModuleDisplayType,
} from './openapi';

export {
	ConfigModuleUpdateLanguageType as ConfigModuleLanguageType,
} from './openapi';

export {
	ConfigModuleUpdateWeatherType as ConfigModuleWeatherType,
} from './openapi';

export {
	ConfigModuleUpdateSystemType as ConfigModuleSystemType,
} from './openapi';

export {
	PathsConfigModuleConfigSectionGetParametersPathSection as ConfigModuleSection,
} from './openapi';

// System Module Enums
// ===================
export {
	SystemModuleDataExtensionBaseSource as SystemModuleExtensionSource,
} from './openapi';

export {
	SystemModuleDataExtensionBaseSurface as SystemModuleExtensionSurface,
} from './openapi';

export {
	SystemModuleDataExtensionBaseKind as SystemModuleExtensionKind,
} from './openapi';

export {
	SystemModuleCreateLogEntrySource as SystemModuleLogEntrySource,
} from './openapi';

export {
	SystemModuleCreateLogEntryType as SystemModuleLogEntryType,
} from './openapi';

// Weather Config Location Types
// ==============================
export {
	ConfigModuleUpdateWeatherLatLonLocation_type as ConfigModuleWeatherLatLonLocationType,
	ConfigModuleUpdateWeatherCityNameLocation_type as ConfigModuleWeatherCityNameLocationType,
	ConfigModuleUpdateWeatherCityIdLocation_type as ConfigModuleWeatherCityIdLocationType,
	ConfigModuleUpdateWeatherZipCodeLocation_type as ConfigModuleWeatherZipCodeLocationType,
} from './openapi';
