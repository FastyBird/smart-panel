/**
 * OpenAPI extra models for Remote access module
 */
import { UpdateRemoteAccessConfigDto } from './dto/update-config.dto';
import { RemoteAccessConfigModel } from './models/config.model';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
	RemoteAccessProviderCapabilitiesModel,
	RemoteAccessProviderModel,
	RemoteAccessProviderResponseModel,
	RemoteAccessProvidersResponseModel,
} from './models/provider.model';
import { RemoteAccessStatusModel, RemoteAccessStatusResponseModel } from './models/status.model';
import { RemoteAccessUrlsModel, RemoteAccessUrlsResponseModel } from './models/urls.model';

export const REMOTE_ACCESS_SWAGGER_EXTRA_MODELS = [
	// Module configuration
	RemoteAccessConfigModel,
	UpdateRemoteAccessConfigDto,
	// Response models
	RemoteAccessStatusResponseModel,
	RemoteAccessProviderResponseModel,
	RemoteAccessProvidersResponseModel,
	RemoteAccessUrlsResponseModel,
	// Data models
	RemoteAccessStatusModel,
	RemoteAccessProviderModel,
	RemoteAccessProviderCapabilitiesModel,
	RemoteAccessEndpointModel,
	RemoteAccessAdvisoryModel,
	RemoteAccessUrlsModel,
];
