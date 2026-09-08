import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
} from '../../../modules/remote-access/models/provider.model';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import {
	RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel,
	RemoteAccessCloudflareTunnelPluginRequirementModel,
	RemoteAccessCloudflareTunnelPluginSetupJobModel,
	RemoteAccessCloudflareTunnelPluginStatusModel,
	RemoteAccessCloudflareTunnelPluginStatusResponseModel,
} from '../models/status.model';
import {
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';
import { CloudflareTunnelManagedService } from '../services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from '../services/cloudflare-tunnel-provider.service';
import { CloudflareTunnelSetupService } from '../services/cloudflare-tunnel-setup.service';

@ApiTags(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME)
@Controller()
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class StatusController {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'StatusController');

	constructor(
		private readonly providerService: CloudflareTunnelProviderService,
		private readonly tunnelManagedService: CloudflareTunnelManagedService,
		private readonly setupService: CloudflareTunnelSetupService,
		private readonly platformService: PlatformService,
	) {}

	@ApiOperation({
		tags: [REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME],
		summary: 'Get Cloudflare Tunnel status',
		description:
			'Retrieve the full Cloudflare Tunnel status: connection state, published endpoints, provider-specific details and the setup requirements checklist.',
		operationId: 'get-remote-access-cloudflare-tunnel-plugin-status',
	})
	@ApiSuccessResponse(
		RemoteAccessCloudflareTunnelPluginStatusResponseModel,
		'Cloudflare Tunnel status retrieved successfully',
	)
	@Get('status')
	async getStatus(): Promise<RemoteAccessCloudflareTunnelPluginStatusResponseModel> {
		this.logger.debug('Fetching Cloudflare Tunnel status');

		const [status, requirements, privilegedWorkerSupport] = await Promise.all([
			this.providerService.getStatus(),
			this.tunnelManagedService.refreshRequirements(),
			this.platformService.getPrivilegedWorkerSupport(),
		]);

		const data = new RemoteAccessCloudflareTunnelPluginStatusModel();
		data.type = status.type;
		data.state = status.state;
		data.endpoints = toInstance(RemoteAccessEndpointModel, status.endpoints);
		data.message = status.message ?? null;
		data.details = status.details;
		data.proxyAddresses = status.proxyAddresses;
		data.advisories = toInstance(RemoteAccessAdvisoryModel, status.advisories);
		data.updatedAt = status.updatedAt;
		data.requirements = toInstance(RemoteAccessCloudflareTunnelPluginRequirementModel, requirements);
		data.setup = this.buildSetupJobModel();

		const privilegedSetup = new RemoteAccessCloudflareTunnelPluginPrivilegedSetupModel();
		privilegedSetup.available = privilegedWorkerSupport.supported;
		privilegedSetup.reason = privilegedWorkerSupport.reason;
		data.privilegedSetup = privilegedSetup;

		const response = new RemoteAccessCloudflareTunnelPluginStatusResponseModel();
		response.data = data;

		return response;
	}

	/** The last known privileged setup job, or null when none has run since this process started. */
	private buildSetupJobModel(): RemoteAccessCloudflareTunnelPluginSetupJobModel | null {
		const lastJob = this.setupService.getLastJob();

		if (!lastJob) {
			return null;
		}

		const model = new RemoteAccessCloudflareTunnelPluginSetupJobModel();
		model.jobId = lastJob.id;
		model.state = lastJob.status.state;
		model.step = lastJob.status.step ?? null;
		model.message = lastJob.status.message ?? null;
		model.updatedAt = lastJob.status.updatedAt;

		return model;
	}
}
