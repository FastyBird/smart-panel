import {
	ConflictException,
	Controller,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Post,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	RemoteAccessAdvisoryModel,
	RemoteAccessEndpointModel,
} from '../../../modules/remote-access/models/provider.model';
import {
	ApiAcceptedSuccessResponse,
	ApiSuccessResponse,
} from '../../../modules/swagger/decorators/api-documentation.decorator';
import { PrivilegedWorkerUnavailableException } from '../../../modules/system/system.exceptions';
import { Roles } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import { UpdateRemoteAccessCloudflareTunnelPluginConfigDto } from '../dto/update-config.dto';
import {
	RemoteAccessCloudflareTunnelPluginInstallModel,
	RemoteAccessCloudflareTunnelPluginInstallResponseModel,
} from '../models/install.model';
import {
	RemoteAccessCloudflareTunnelPluginRequirementModel,
	RemoteAccessCloudflareTunnelPluginStatusModel,
	RemoteAccessCloudflareTunnelPluginStatusResponseModel,
} from '../models/status.model';
import {
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';
import { CloudflareTunnelManagedService } from '../services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from '../services/cloudflare-tunnel-provider.service';
import {
	CloudflareTunnelSetupService,
	CloudflareTunnelSetupUnavailableException,
} from '../services/cloudflare-tunnel-setup.service';

/**
 * The two owner-only actions that mutate the tunnel: privileged install and reset. Kept
 * separate from `StatusController` (a plain `GET`, admin+owner) mirroring `SetupController` in
 * the Tailscale plugin. Connect/disconnect/reconnect are the generic Extensions service actions
 * (`POST /services/plugin/remote-access-cloudflare-tunnel-plugin/tunnel/start|stop|restart`) —
 * this plugin does not add its own connect/disconnect endpoints.
 */
@ApiTags(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME)
@Controller()
@Roles(UserRole.OWNER)
export class SetupController {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, 'SetupController');

	constructor(
		private readonly setupService: CloudflareTunnelSetupService,
		private readonly providerService: CloudflareTunnelProviderService,
		private readonly tunnelManagedService: CloudflareTunnelManagedService,
		private readonly configService: ConfigService,
	) {}

	@ApiOperation({
		tags: [REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME],
		summary: 'Install cloudflared',
		description:
			'Starts the privileged setup job: installs the cloudflared package if missing. Progress is streamed as RemoteAccessModule.Setup.Progress events.',
		operationId: 'create-remote-access-cloudflare-tunnel-plugin-install',
	})
	@ApiAcceptedSuccessResponse(
		RemoteAccessCloudflareTunnelPluginInstallResponseModel,
		'Cloudflare Tunnel setup job started',
	)
	@Post('install')
	@HttpCode(HttpStatus.ACCEPTED)
	async install(): Promise<RemoteAccessCloudflareTunnelPluginInstallResponseModel> {
		this.logger.debug('Cloudflare Tunnel install requested');

		try {
			const { id } = await this.setupService.install();

			const data = new RemoteAccessCloudflareTunnelPluginInstallModel();
			data.job = id;

			const response = new RemoteAccessCloudflareTunnelPluginInstallResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			// A busy unit is transient (retry once the running job finishes) — 409 Conflict. A
			// permanent refusal — the platform architecturally cannot run privileged workers, or
			// the privileged-worker probe currently fails — is 422 Unprocessable Entity, with a
			// `code` the admin UI can branch on and a `message` that already carries the
			// actionable "here's the fix" text from the service (D13).
			if (error instanceof PrivilegedWorkerUnavailableException) {
				throw new ConflictException(error.message);
			}

			if (error instanceof CloudflareTunnelSetupUnavailableException) {
				throw new UnprocessableEntityException({ code: error.code, message: error.message });
			}

			const err = error as Error;

			this.logger.error(`Failed to start Cloudflare Tunnel setup: ${err.message}`);

			throw new InternalServerErrorException('Failed to start Cloudflare Tunnel setup');
		}
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_API_TAG_NAME],
		summary: 'Reset the Cloudflare Tunnel',
		description:
			'Stops the tunnel service and clears the stored tunnel token and public hostname, returning the resulting status.',
		operationId: 'create-remote-access-cloudflare-tunnel-plugin-reset',
	})
	@ApiSuccessResponse(RemoteAccessCloudflareTunnelPluginStatusResponseModel, 'Cloudflare Tunnel status after reset')
	@HttpCode(HttpStatus.OK)
	@Post('reset')
	async reset(): Promise<RemoteAccessCloudflareTunnelPluginStatusResponseModel> {
		this.logger.debug('Cloudflare Tunnel reset requested');

		try {
			await this.tunnelManagedService.stop();
		} catch (error) {
			this.logger.warn('Failed to stop the Cloudflare Tunnel process while resetting', {
				message: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			const plain: Record<string, unknown> = {
				type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
				tunnel_token: null,
				public_hostname: null,
			};

			const dto = toInstance(UpdateRemoteAccessCloudflareTunnelPluginConfigDto, plain, {
				excludeExtraneousValues: false,
			});

			await this.configService.updatePluginConfig(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME, dto, plain);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to clear the Cloudflare Tunnel configuration during reset: ${err.message}`);

			throw new InternalServerErrorException('Failed to reset the Cloudflare Tunnel configuration');
		}

		return this.buildStatusResponse();
	}

	/** Shared by `reset()` — the same composition `StatusController.getStatus()` uses, minus the setup/privileged-setup fields. */
	private async buildStatusResponse(): Promise<RemoteAccessCloudflareTunnelPluginStatusResponseModel> {
		const [status, requirements] = await Promise.all([
			this.providerService.getStatus(),
			this.tunnelManagedService.refreshRequirements(),
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
		data.setup = null;

		const response = new RemoteAccessCloudflareTunnelPluginStatusResponseModel();
		response.data = data;

		return response;
	}
}
