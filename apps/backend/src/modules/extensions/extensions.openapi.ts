import { ExecuteActionDataDto, ReqExecuteActionDto } from './dto/execute-action.dto';
import { ReqUpdateExtensionDto, UpdateExtensionDataDto } from './dto/update-extension.dto';
import {
	ActionParameterModel,
	ActionParameterOptionModel,
	ActionParameterValidationModel,
	ActionResultModel,
	ExtensionActionModel,
} from './models/action.model';
import { ActionResultResponseModel, ExtensionActionsResponseModel } from './models/actions-response.model';
import {
	DiscoveredExtensionAdminModel,
	DiscoveredExtensionBackendModel,
	DiscoveredExtensionBaseModel,
} from './models/discovered-extension.model';
import { DiscoveredExtensionsResponseModel } from './models/discovered-extensions-response.model';
import { ExtensionLinksModel, ExtensionModel } from './models/extension.model';
import { ExtensionResponseModel, ExtensionsResponseModel } from './models/extensions-response.model';
import {
	ServiceStatusModel,
	ServiceStatusResponseModel,
	ServicesStatusResponseModel,
} from './models/service-status.model';

export const EXTENSIONS_SWAGGER_EXTRA_MODELS = [
	ExtensionModel,
	ExtensionLinksModel,
	ExtensionResponseModel,
	ExtensionsResponseModel,
	ReqUpdateExtensionDto,
	UpdateExtensionDataDto,
	// Action models
	ExtensionActionModel,
	ActionParameterModel,
	ActionParameterOptionModel,
	ActionParameterValidationModel,
	ActionResultModel,
	ExtensionActionsResponseModel,
	ActionResultResponseModel,
	ReqExecuteActionDto,
	ExecuteActionDataDto,
	// Discovered extensions models
	DiscoveredExtensionBaseModel,
	DiscoveredExtensionAdminModel,
	DiscoveredExtensionBackendModel,
	DiscoveredExtensionsResponseModel,
	// Service status models
	ServiceStatusModel,
	ServiceStatusResponseModel,
	ServicesStatusResponseModel,
];
