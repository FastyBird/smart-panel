import { ReqUpdateExtensionDto, UpdateExtensionDataDto } from './dto/update-extension.dto';
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
