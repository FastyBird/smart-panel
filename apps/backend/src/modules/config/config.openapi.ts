/**
 * OpenAPI extra models for Config module
 */
import { ReqUpdateModuleDto, UpdateModuleConfigDto } from './dto/config.dto';
import {
	ConfigModuleResAppConfig,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
} from './models/config-response.model';
import {
	ConfigModuleResPluginConfigValidation,
	ConfigValidationErrorModel,
	ConfigValidationResultModel,
} from './models/config-validation-response.model';
import { AppConfigModel, ModuleConfigModel } from './models/config.model';

export const CONFIG_SWAGGER_EXTRA_MODELS = [
	// DTOs
	UpdateModuleConfigDto,
	ReqUpdateModuleDto,
	// Response models
	ConfigModuleResAppConfig,
	ConfigModuleResPluginConfig,
	ConfigModuleResPlugins,
	ConfigModuleResModuleConfig,
	ConfigModuleResModules,
	// Data models
	ModuleConfigModel,
	AppConfigModel,
	// Validation models
	ConfigModuleResPluginConfigValidation,
	ConfigValidationResultModel,
	ConfigValidationErrorModel,
];
