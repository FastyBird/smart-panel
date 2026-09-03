import { FastifyReply as Response } from 'fastify';

import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
} from '../../../modules/remote-access/models/provider.model';
import { ApiSuccessResponse } from '../../../modules/swagger/decorators/api-documentation.decorator';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import {
	RemoteAccessTailscalePluginRequirementModel,
	RemoteAccessTailscalePluginStatusModel,
	RemoteAccessTailscalePluginStatusResponseModel,
} from '../models/status.model';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
} from '../remote-access-tailscale.constants';
import { TailscaleLoginService } from '../services/tailscale-login.service';
import { TailscaleNodeManagedService } from '../services/tailscale-node-managed.service';
import { TailscaleProviderService } from '../services/tailscale-provider.service';

@ApiTags(REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME)
@Controller()
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class StatusController {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'StatusController');

	constructor(
		private readonly providerService: TailscaleProviderService,
		private readonly nodeManagedService: TailscaleNodeManagedService,
		private readonly loginService: TailscaleLoginService,
	) {}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Get Tailscale node status',
		description:
			'Retrieve the full Tailscale node status: connection state, published endpoints, provider-specific details and the setup requirements checklist.',
		operationId: 'get-remote-access-tailscale-plugin-status',
	})
	@ApiSuccessResponse(RemoteAccessTailscalePluginStatusResponseModel, 'Tailscale node status retrieved successfully')
	@Get('status')
	async getStatus(@Res({ passthrough: true }) res: Response): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		this.logger.debug('Fetching Tailscale node status');

		const [status, requirements] = await Promise.all([
			this.providerService.getStatus(),
			this.nodeManagedService.evaluateRequirements(),
		]);

		const data = new RemoteAccessTailscalePluginStatusModel();
		data.type = status.type;
		data.state = status.state;
		data.endpoints = toInstance(RemoteAccessEndpointModel, status.endpoints);
		data.message = status.message ?? null;
		data.details = status.details;
		data.proxyAddresses = status.proxyAddresses;
		data.advisories = toInstance(RemoteAccessAdvisoryModel, status.advisories);
		data.updatedAt = status.updatedAt;
		data.requirements = toInstance(RemoteAccessTailscalePluginRequirementModel, requirements);

		if (data.state === 'pending-auth') {
			// authUrl/qr reflect this service's own tracked interactive sign-in,
			// not `status --json`'s own AuthURL field: that field never carries a
			// QR code, and login() is the source of truth for a URL it spawned.
			// A pending-auth state with nothing tracked here (e.g. after a
			// restart) still gets the no-store header below, just without those
			// two fields.
			const pending = this.loginService.getPendingInteractiveAuth();

			if (pending) {
				data.authUrl = pending.authUrl;
				data.qr = pending.qr;
			}

			res.header('Cache-Control', 'no-store');
		}

		const response = new RemoteAccessTailscalePluginStatusResponseModel();
		response.data = data;

		return response;
	}
}
