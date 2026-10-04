import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
} from '../../../modules/remote-access/models/provider.model';
import { RemoteAccessStatusService } from '../../../modules/remote-access/services/remote-access-status.service';
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
import { CloudflareTunnelObservationMetadata } from '../services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelSetupService } from '../services/cloudflare-tunnel-setup.service';

@ApiTags(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME)
@Controller()
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class StatusController {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'StatusController');

	constructor(
		private readonly statusService: RemoteAccessStatusService,
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

		const [observed, privilegedWorkerSupport] = await Promise.all([
			this.statusService.getProviderSnapshot<CloudflareTunnelObservationMetadata>(
				REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
				{ fresh: true },
			),
			this.platformService.getPrivilegedWorkerSupport(),
		]);
		// A provider event can arrive while the platform probe is pending.
		const snapshot =
			this.statusService.getCachedProviderSnapshot<CloudflareTunnelObservationMetadata>(
				REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			) ?? observed;
		const { status, metadata } = snapshot;
		const requirements = metadata?.requirements ?? [];

		const data = new RemoteAccessCloudflareTunnelPluginStatusModel();
		data.epoch = status.epoch;
		data.revision = status.revision;
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
