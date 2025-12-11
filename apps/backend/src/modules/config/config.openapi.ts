/**
 * OpenAPI extra models for Config module
 */
import {
	ReqUpdateModuleDto,
	ReqUpdateSectionDto,
	UpdateLanguageConfigDto,
	UpdateModuleConfigDto,
	UpdateSystemConfigDto,
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
} from './models/config-response.model';
import { AppConfigModel, LanguageConfigModel, ModuleConfigModel, SystemConfigModel } from './models/config.model';

export const CONFIG_SWAGGER_EXTRA_MODELS = [
	// DTOs
	UpdateLanguageConfigDto,
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
	ConfigModuleResSystem,
	// Data models
	LanguageConfigModel,
	SystemConfigModel,
	ModuleConfigModel,
	AppConfigModel,
];
