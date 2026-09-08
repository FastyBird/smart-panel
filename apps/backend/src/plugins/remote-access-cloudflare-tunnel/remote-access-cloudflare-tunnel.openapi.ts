/**
 * OpenAPI extra models for the Cloudflare Tunnel remote-access provider plugin.
 *
 * `RemoteAccessEndpointModel` / `RemoteAccessAdvisoryModel` (used by
 * `RemoteAccessCloudflareTunnelPluginStatusModel`) are registered by the `remote-access` module
 * itself; `SwaggerModelsRegistryService` dedupes by class reference, so re-registering them here
 * is unnecessary.
 */
import { UpdateRemoteAccessCloudflareTunnelPluginConfigDto } from './dto/update-config.dto';
import { RemoteAccessCloudflareTunnelPluginConfigModel } from './models/config.model';
import {
	RemoteAccessCloudflareTunnelPluginInstallModel,
	RemoteAccessCloudflareTunnelPluginInstallResponseModel,
} from './models/install.model';
import {
	RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel,
	RemoteAccessCloudflareTunnelPluginRequirementModel,
	RemoteAccessCloudflareTunnelPluginRequirementRemedyModel,
	RemoteAccessCloudflareTunnelPluginSetupJobModel,
	RemoteAccessCloudflareTunnelPluginStatusModel,
	RemoteAccessCloudflareTunnelPluginStatusResponseModel,
} from './models/status.model';

export const REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_SWAGGER_EXTRA_MODELS = [
	// Plugin configuration
	RemoteAccessCloudflareTunnelPluginConfigModel,
	UpdateRemoteAccessCloudflareTunnelPluginConfigDto,
	// Response models
	RemoteAccessCloudflareTunnelPluginStatusResponseModel,
	RemoteAccessCloudflareTunnelPluginInstallResponseModel,
	// Data models
	RemoteAccessCloudflareTunnelPluginStatusModel,
	RemoteAccessCloudflareTunnelPluginRequirementModel,
	RemoteAccessCloudflareTunnelPluginRequirementRemedyModel,
	RemoteAccessCloudflareTunnelPluginSetupJobModel,
	RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel,
	RemoteAccessCloudflareTunnelPluginInstallModel,
];
