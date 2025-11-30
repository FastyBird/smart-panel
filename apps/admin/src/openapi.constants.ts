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
	UsersModuleUserRole,
} from './openapi';

// Device Category Enums
// =====================
export {
	DevicesModuleDeviceCategory,
} from './openapi';

export {
	DevicesModuleChannelCategory,
} from './openapi';

export {
	DevicesModuleChannelPropertyCategory,
} from './openapi';

export {
	DevicesModuleChannelPropertyData_type,
} from './openapi';

export {
	DevicesModuleChannelPropertyPermissions,
} from './openapi';

// Device Status Enums
// ===================
export {
	DevicesModuleDeviceStatusStatus,
} from './openapi';

// Config Module Enums
// ===================
export {
	ConfigModuleLanguageLanguage,
} from './openapi';

export {
	ConfigModuleLanguageTime_format,
} from './openapi';

export {
	ConfigModuleSystemLog_levels,
} from './openapi';

// System Module Enums
// ===================
export {
	SystemModuleLogEntrySource,
} from './openapi';

export {
	SystemModuleExtensionSurface,
} from './openapi';

export {
	SystemModuleDataExtensionBaseKind as SystemModuleDataExtensionKind,
} from './openapi';

export {
	SystemModuleDataExtensionBaseSource as SystemModuleDataExtensionSource,
} from './openapi';

// Weather Config Location Types
// ==============================
export {
	ConfigModuleDataWeatherLatLonLocation_type as ConfigModuleDataWeatherLatLonLocationType,
	ConfigModuleDataWeatherCityNameLocation_type as ConfigModuleDataWeatherCityNameLocationType,
	ConfigModuleDataWeatherCityIdLocation_type as ConfigModuleDataWeatherCityIdLocationType,
	ConfigModuleDataWeatherZipCodeLocation_type as ConfigModuleDataWeatherZipCodeLocationType,
} from './openapi';

// Weather Config Enums (if they exist in the future)
// ===================================================
// Note: ConfigModuleWeatherType and ConfigModuleWeatherUnit don't exist in the new schema
// These may need to be handled differently or removed

// Plugin Type Enums
// =================
// Note: Plugin-specific type enums (e.g., DevicesShellyNgPluginShellyNgDeviceType)
// don't exist in the new schema. These may need to be removed or replaced with
// schema types instead of enums.
