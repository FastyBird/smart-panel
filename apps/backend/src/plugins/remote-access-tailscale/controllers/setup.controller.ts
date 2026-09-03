import { FastifyReply as Response } from 'fastify';

import {
	Body,
	ConflictException,
	Controller,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Post,
	Res,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
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
import { RemoteAccessTailscalePluginLoginDto } from '../dto/login.dto';
import {
	RemoteAccessTailscalePluginInstallModel,
	RemoteAccessTailscalePluginInstallResponseModel,
	RemoteAccessTailscalePluginLoginModel,
	RemoteAccessTailscalePluginLoginResponseModel,
} from '../models/login.model';
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
import { TailscaleSetupService, TailscaleSetupUnavailableException } from '../services/tailscale-setup.service';

/**
 * The four Tailscale actions that mutate the node: privileged setup and the
 * three unprivileged sign-in/preference actions. Kept separate from
 * `StatusController` (a plain `GET`) so neither file grows past what it
 * needs to hold.
 */
@ApiTags(REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME)
@Controller()
export class SetupController {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'SetupController');

	constructor(
		private readonly setupService: TailscaleSetupService,
		private readonly loginService: TailscaleLoginService,
		private readonly providerService: TailscaleProviderService,
		private readonly nodeManagedService: TailscaleNodeManagedService,
	) {}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Install and prepare Tailscale',
		description:
			'Starts the privileged setup job: installs the tailscale package if missing, enables tailscaled, and grants the service user as operator. Progress is streamed as RemoteAccessModule.Setup.Progress events.',
		operationId: 'create-remote-access-tailscale-plugin-install',
	})
	@ApiAcceptedSuccessResponse(RemoteAccessTailscalePluginInstallModel, 'Tailscale setup job started')
	@Roles(UserRole.OWNER)
	@Post('install')
	@HttpCode(HttpStatus.ACCEPTED)
	async install(): Promise<RemoteAccessTailscalePluginInstallResponseModel> {
		this.logger.debug('Tailscale install requested');

		try {
			const { id } = await this.setupService.install();

			const data = new RemoteAccessTailscalePluginInstallModel();
			data.job = id;

			const response = new RemoteAccessTailscalePluginInstallResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			if (
				error instanceof TailscaleSetupUnavailableException ||
				error instanceof PrivilegedWorkerUnavailableException
			) {
				throw new ConflictException(error.message);
			}

			const err = error as Error;

			this.logger.error(`Failed to start Tailscale setup: ${err.message}`);

			throw new InternalServerErrorException('Failed to start Tailscale setup');
		}
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Sign in to Tailscale',
		description:
			'Signs the node in. With an auth key, signs in headlessly and returns the resulting status. Without one, starts an interactive sign-in and returns an auth URL and QR code to approve on another device.',
		operationId: 'create-remote-access-tailscale-plugin-login',
	})
	@ApiBody({ type: RemoteAccessTailscalePluginLoginDto, description: 'Optional pre-authorised auth key' })
	@ApiSuccessResponse(RemoteAccessTailscalePluginLoginModel, 'Tailscale sign-in result')
	@Roles(UserRole.ADMIN, UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(
		@Body() body: RemoteAccessTailscalePluginLoginDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<RemoteAccessTailscalePluginLoginResponseModel> {
		this.logger.debug('Tailscale login requested');

		try {
			const result = await this.loginService.login(body.authKey);

			const data = new RemoteAccessTailscalePluginLoginModel();
			data.state = result.state;
			data.authUrl = result.authUrl;
			data.qr = result.qr;

			// Every login response can carry a capability URL — no-store
			// unconditionally, not only when authUrl happens to be set, so a
			// caching layer never learns the difference between the two cases.
			res.header('Cache-Control', 'no-store');

			const response = new RemoteAccessTailscalePluginLoginResponseModel();
			response.data = data;

			return response;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Tailscale login failed: ${err.message}`);

			throw new InternalServerErrorException('Failed to sign in to Tailscale');
		}
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Sign out of Tailscale',
		description: 'Expires the node key and cancels any pending interactive sign-in.',
		operationId: 'create-remote-access-tailscale-plugin-logout',
	})
	@ApiSuccessResponse(RemoteAccessTailscalePluginStatusModel, 'Tailscale node status after sign-out')
	@Roles(UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('logout')
	async logout(@Res({ passthrough: true }) res: Response): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		this.logger.debug('Tailscale logout requested');

		try {
			await this.loginService.logout();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Tailscale logout failed: ${err.message}`);

			throw new InternalServerErrorException('Failed to sign out of Tailscale');
		}

		return this.buildStatusResponse(res);
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Reset Tailscale preferences',
		description:
			'Runs `tailscale up --reset` with the full managed flag set, clearing any preference the administrator changed outside Smart Panel.',
		operationId: 'create-remote-access-tailscale-plugin-reset-preferences',
	})
	@ApiSuccessResponse(RemoteAccessTailscalePluginStatusModel, 'Tailscale node status after resetting preferences')
	@Roles(UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('reset-preferences')
	async resetPreferences(
		@Res({ passthrough: true }) res: Response,
	): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		this.logger.debug('Tailscale reset-preferences requested');

		try {
			await this.loginService.resetPreferences();
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Tailscale reset-preferences failed: ${err.message}`);

			throw new InternalServerErrorException('Failed to reset Tailscale preferences');
		}

		return this.buildStatusResponse(res);
	}

	/** Shared by `logout`/`resetPreferences` — the same composition `StatusController.getStatus()` uses, including the no-store guard for a state that happens to come back pending-auth. */
	private async buildStatusResponse(res: Response): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
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
