/**
 * OpenAPI extra models for Config module
 */
import {
	ReqUpdateModuleDto,
	ReqUpdateSectionDto,
	UpdateAudioConfigDto,
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
	ConfigModuleResAudio,
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
	AudioConfigModel,
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
	UpdateAudioConfigDto,
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
	ConfigModuleResAudio,
	ConfigModuleResLanguage,
	ConfigModuleResWeather,
	ConfigModuleResSystem,
	// Data models
	AudioConfigModel,
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
