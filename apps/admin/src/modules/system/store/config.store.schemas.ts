import { type ZodType, z } from 'zod';

import type { ConfigModuleSystemSchema, ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import {
	SystemModuleDistanceUnit,
	SystemModuleHouseMode,
	SystemModuleLanguage,
	SystemModuleLogEntryType,
	SystemModuleNumberFormat,
	SystemModulePrecipitationUnit,
	SystemModulePressureUnit,
	SystemModuleTimeFormat,
	SystemModuleUpdateChannel,
	SystemModuleWindSpeedUnit,
	TemperatureUnit,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { SYSTEM_MODULE_NAME } from '../system.constants';

type ApiConfigModule = ConfigModuleSystemSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const SystemConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(SYSTEM_MODULE_NAME),
	language: z.nativeEnum(SystemModuleLanguage),
	timezone: z.string(),
	timeFormat: z.nativeEnum(SystemModuleTimeFormat),
	numberFormat: z.nativeEnum(SystemModuleNumberFormat),
	temperatureUnit: z.nativeEnum(TemperatureUnit),
	windSpeedUnit: z.nativeEnum(SystemModuleWindSpeedUnit),
	pressureUnit: z.nativeEnum(SystemModulePressureUnit),
	precipitationUnit: z.nativeEnum(SystemModulePrecipitationUnit),
	distanceUnit: z.nativeEnum(SystemModuleDistanceUnit),
	logLevels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
	houseMode: z.nativeEnum(SystemModuleHouseMode),
	onboardingCompleted: z.boolean().default(false),
	// Defaulted rather than required so a backend that predates the setting still parses.
	updateChannel: z.nativeEnum(SystemModuleUpdateChannel).default(SystemModuleUpdateChannel.auto),
});

// BACKEND API
// ===========

// onboarding_completed is deliberately absent - the backend accepts it, but the config
// form never offers it and the onboarding module flips the flag through its own endpoint.
export const SystemConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(SYSTEM_MODULE_NAME),
		language: z.nativeEnum(SystemModuleLanguage).optional(),
		timezone: z.string().optional(),
		time_format: z.nativeEnum(SystemModuleTimeFormat).optional(),
		number_format: z.nativeEnum(SystemModuleNumberFormat).optional(),
		temperature_unit: z.nativeEnum(TemperatureUnit).optional(),
		wind_speed_unit: z.nativeEnum(SystemModuleWindSpeedUnit).optional(),
		pressure_unit: z.nativeEnum(SystemModulePressureUnit).optional(),
		precipitation_unit: z.nativeEnum(SystemModulePrecipitationUnit).optional(),
		distance_unit: z.nativeEnum(SystemModuleDistanceUnit).optional(),
		log_levels: z.array(z.nativeEnum(SystemModuleLogEntryType)).optional(),
		house_mode: z.nativeEnum(SystemModuleHouseMode).optional(),
		update_channel: z.nativeEnum(SystemModuleUpdateChannel).optional(),
	})
);

export const SystemConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(SYSTEM_MODULE_NAME),
		language: z.nativeEnum(SystemModuleLanguage),
		timezone: z.string(),
		time_format: z.nativeEnum(SystemModuleTimeFormat),
		number_format: z.nativeEnum(SystemModuleNumberFormat),
		temperature_unit: z.nativeEnum(TemperatureUnit),
		wind_speed_unit: z.nativeEnum(SystemModuleWindSpeedUnit),
		pressure_unit: z.nativeEnum(SystemModulePressureUnit),
		precipitation_unit: z.nativeEnum(SystemModulePrecipitationUnit),
		distance_unit: z.nativeEnum(SystemModuleDistanceUnit),
		log_levels: z.array(z.nativeEnum(SystemModuleLogEntryType)),
		house_mode: z.nativeEnum(SystemModuleHouseMode),
		onboarding_completed: z.boolean(),
		update_channel: z.nativeEnum(SystemModuleUpdateChannel),
	})
);
