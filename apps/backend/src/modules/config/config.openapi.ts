/**
 * OpenAPI extra models for Config module
 */
import {
	ReqUpdateSectionDto,
	UpdateAudioConfigDto,
	UpdateLanguageConfigDto,
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
	ReqUpdateSectionDto,
	// Response models
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
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
	AppConfigModel,
];
