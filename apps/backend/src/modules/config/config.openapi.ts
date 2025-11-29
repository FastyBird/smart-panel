/**
 * OpenAPI extra models for Config module
 */
import { Type } from '@nestjs/common';

import {
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
} from './models/config-response.model';
import {
	AppConfigModel,
	AudioConfigModel,
	DisplayConfigModel,
	LanguageConfigModel,
	SystemConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from './models/config.model';

export const CONFIG_SWAGGER_EXTRA_MODELS: Type<any>[] = [
	// Response models
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
	// Data models
	AudioConfigModel,
	DisplayConfigModel,
	LanguageConfigModel,
	WeatherLatLonConfigModel,
	WeatherCityNameConfigModel,
	WeatherCityIdConfigModel,
	WeatherZipCodeConfigModel,
	SystemConfigModel,
	AppConfigModel,
];
