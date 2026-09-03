/**
 * OpenAPI extra models for the Tailscale remote-access provider plugin.
 *
 * `RemoteAccessEndpointModel` / `RemoteAccessAdvisoryModel` (used by
 * `RemoteAccessTailscalePluginStatusModel`) are registered by the
 * `remote-access` module itself; `SwaggerModelsRegistryService` dedupes by
 * class reference, so re-registering them here is unnecessary.
 */
import { UpdateRemoteAccessTailscalePluginConfigDto } from './dto/update-config.dto';
import { RemoteAccessTailscalePluginConfigModel } from './models/config.model';
import {
	RemoteAccessTailscalePluginRequirementModel,
	RemoteAccessTailscalePluginStatusModel,
	RemoteAccessTailscalePluginStatusResponseModel,
} from './models/status.model';

export const REMOTE_ACCESS_TAILSCALE_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Plugin configuration
	RemoteAccessTailscalePluginConfigModel,
	UpdateRemoteAccessTailscalePluginConfigDto,
	// Response models
	RemoteAccessTailscalePluginStatusResponseModel,
	// Data models
	RemoteAccessTailscalePluginStatusModel,
	RemoteAccessTailscalePluginRequirementModel,
];
