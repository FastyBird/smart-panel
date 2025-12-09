/**
 * OpenAPI extra models for Config module
 */
import {
	ReqUpdateModuleDto,
	ReqUpdateSectionDto,
	UpdateLanguageConfigDto,
	UpdateModuleConfigDto,
	UpdateSystemConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherZipCodeConfigDto,
} from './dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResLanguage,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
	ConfigModuleResSystem,
	ConfigModuleResWeather,
} from './models/config-response.model';
import {
	AppConfigModel,
	LanguageConfigModel,
	ModuleConfigModel,
	SystemConfigModel,
	WeatherCityIdConfigModel,
	WeatherCityNameConfigModel,
	WeatherConfigModel,
	WeatherLatLonConfigModel,
	WeatherZipCodeConfigModel,
} from './models/config.model';

export const CONFIG_SWAGGER_EXTRA_MODELS = [
	// DTOs
	UpdateLanguageConfigDto,
	UpdateWeatherConfigDto,
	UpdateWeatherLatLonConfigDto,
	UpdateWeatherCityNameConfigDto,
	UpdateWeatherCityIdConfigDto,
	UpdateWeatherZipCodeConfigDto,
	UpdateSystemConfigDto,
	UpdateModuleConfigDto,
	ReqUpdateSectionDto,
	ReqUpdateModuleDto,
	// Response models
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	ConfigModuleResSection,
	ConfigModuleResLanguage,
	ConfigModuleResWeather,
	ConfigModuleResSystem,
	// Data models
	LanguageConfigModel,
	WeatherConfigModel,
	WeatherLatLonConfigModel,
	WeatherCityNameConfigModel,
	WeatherCityIdConfigModel,
	WeatherZipCodeConfigModel,
	SystemConfigModel,
	ModuleConfigModel,
	AppConfigModel,
];
