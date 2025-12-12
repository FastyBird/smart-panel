/**
 * OpenAPI extra models for Config module
 */
import { ReqUpdateModuleDto, ReqUpdateSectionDto, UpdateModuleConfigDto } from './dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResSection,
} from './models/config-response.model';
import { AppConfigModel, ModuleConfigModel } from './models/config.model';

export const CONFIG_SWAGGER_EXTRA_MODELS = [
	// DTOs
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
	// Data models
	ModuleConfigModel,
	AppConfigModel,
];
