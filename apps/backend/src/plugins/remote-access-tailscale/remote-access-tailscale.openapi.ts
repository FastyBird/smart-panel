/**
 * OpenAPI extra models for the Tailscale remote-access provider plugin.
 *
 * `RemoteAccessEndpointModel` / `RemoteAccessAdvisoryModel` (used by
 * `RemoteAccessTailscalePluginStatusModel`) are registered by the
 * `remote-access` module itself; `SwaggerModelsRegistryService` dedupes by
 * class reference, so re-registering them here is unnecessary.
 */
import { RemoteAccessTailscalePluginLoginDto } from './dto/login.dto';
import { UpdateRemoteAccessTailscalePluginConfigDto } from './dto/update-config.dto';
import { RemoteAccessTailscalePluginConfigModel } from './models/config.model';
import {
	RemoteAccessTailscalePluginInstallModel,
	RemoteAccessTailscalePluginInstallResponseModel,
	RemoteAccessTailscalePluginLoginModel,
	RemoteAccessTailscalePluginLoginResponseModel,
} from './models/login.model';
import {
	RemoteAccessTailscalePluginRequirementModel,
	RemoteAccessTailscalePluginStatusModel,
	RemoteAccessTailscalePluginStatusResponseModel,
} from './models/status.model';

export const REMOTE_ACCESS_TAILSCALE_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Plugin configuration
	RemoteAccessTailscalePluginConfigModel,
	UpdateRemoteAccessTailscalePluginConfigDto,
	// Request models
	RemoteAccessTailscalePluginLoginDto,
	// Response models
	RemoteAccessTailscalePluginStatusResponseModel,
	RemoteAccessTailscalePluginInstallResponseModel,
	RemoteAccessTailscalePluginLoginResponseModel,
	// Data models
	RemoteAccessTailscalePluginStatusModel,
	RemoteAccessTailscalePluginRequirementModel,
	RemoteAccessTailscalePluginInstallModel,
	RemoteAccessTailscalePluginLoginModel,
];
