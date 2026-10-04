import { FastifyReply as Response } from 'fastify';

import {
	Body,
	ConflictException,
	Controller,
	HttpCode,
	HttpStatus,
	InternalServerErrorException,
	Post,
	Req,
	Res,
	UnprocessableEntityException,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { AuthenticatedRequest } from '../../../modules/auth/guards/auth.guard';
import { PlatformService } from '../../../modules/platform/services/platform.service';
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
	RemoteAccessTailscalePluginPrivilegedSetupModel,
	RemoteAccessTailscalePluginRequirementModel,
	RemoteAccessTailscalePluginSetupJobModel,
	RemoteAccessTailscalePluginStatusModel,
	RemoteAccessTailscalePluginStatusResponseModel,
} from '../models/status.model';
import {
	REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
} from '../remote-access-tailscale.constants';
import {
	TailscaleChildTerminationException,
	TailscaleNodeStopFailedException,
	TailscaleOperationCancelledException,
	TailscaleOperationInProgressException,
	TailscalePluginDisabledException,
	TailscaleRequirementUnsatisfiedException,
} from '../remote-access-tailscale.exceptions';
import { TailscaleCliError } from '../services/tailscale-cli.service';
import { TailscaleLoginInProgressException, TailscaleLoginService } from '../services/tailscale-login.service';
import { TailscaleNodeManagedService } from '../services/tailscale-node-managed.service';
import { TailscaleProviderService } from '../services/tailscale-provider.service';
import { TailscaleSetupService, TailscaleSetupUnavailableException } from '../services/tailscale-setup.service';
import { buildTailscaleControlModel } from '../utils/tailscale-control.utils';

/**
 * Tailscale connection, privileged setup and sign-in/preference actions. Kept separate from
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
		private readonly platformService: PlatformService,
	) {}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Connect the Tailscale node',
		description:
			'Connect an enabled plugin using its existing authentication. Starts a stopped service or reconciles an already-started disconnected node; repeated requests are harmless.',
		operationId: 'create-remote-access-tailscale-plugin-connect',
	})
	@ApiSuccessResponse(RemoteAccessTailscalePluginStatusResponseModel, 'Tailscale status after connecting')
	@Roles(UserRole.ADMIN, UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('connect')
	async connect(
		@Res({ passthrough: true }) res: Response,
		@Req() request?: AuthenticatedRequest,
	): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		try {
			await this.nodeManagedService.connect();
		} catch (error) {
			this.mapActionError(error, 'Tailscale connect failed', 'Failed to connect to Tailscale');
		}

		return this.buildStatusResponse(res, request);
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Disconnect the Tailscale node',
		description:
			'Cancel pending node operations and disconnect the current session without logging out. Repeated requests are harmless. Disable the plugin to keep it off across application restarts.',
		operationId: 'create-remote-access-tailscale-plugin-disconnect',
	})
	@ApiSuccessResponse(RemoteAccessTailscalePluginStatusResponseModel, 'Tailscale status after disconnecting')
	@Roles(UserRole.ADMIN, UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('disconnect')
	async disconnect(
		@Res({ passthrough: true }) res: Response,
		@Req() request?: AuthenticatedRequest,
	): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		try {
			await this.nodeManagedService.stop();
		} catch (error) {
			this.mapActionError(error, 'Tailscale disconnect failed', 'Failed to disconnect from Tailscale');
		}

		return this.buildStatusResponse(res, request);
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Install and prepare Tailscale',
		description:
			'Starts the privileged setup job: installs the tailscale package if missing, enables tailscaled, and grants the service user as operator. Progress is streamed as RemoteAccessModule.Setup.Progress events.',
		operationId: 'create-remote-access-tailscale-plugin-install',
	})
	@ApiAcceptedSuccessResponse(RemoteAccessTailscalePluginInstallResponseModel, 'Tailscale setup job started')
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
			// A busy unit is transient (retry once the running job finishes) —
			// 409 Conflict. A permanent refusal — the platform architecturally
			// cannot run privileged workers, or the privileged-worker probe
			// currently fails — is 422 Unprocessable Entity, with a `code` the
			// admin UI can branch on (`platform-unsupported` vs
			// `privileged-worker-unavailable`) and a `message` that already
			// carries the actionable "here's the fix" text from the service.
			if (error instanceof PrivilegedWorkerUnavailableException) {
				throw new ConflictException(error.message);
			}

			if (error instanceof TailscaleSetupUnavailableException) {
				throw new UnprocessableEntityException({ code: error.code, message: error.message });
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
	@ApiSuccessResponse(RemoteAccessTailscalePluginLoginResponseModel, 'Tailscale sign-in result')
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
			// A login already in flight (keyed or interactive) is a transient,
			// caller-fixable condition — 409 Conflict, matching how a busy setup
			// job is reported.
			if (error instanceof TailscaleLoginInProgressException) {
				throw new ConflictException(error.message);
			}

			this.mapActionError(error, 'Tailscale login failed', 'Failed to sign in to Tailscale');
		}
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Sign out of Tailscale',
		description: 'Expires the node key and cancels any pending interactive sign-in.',
		operationId: 'create-remote-access-tailscale-plugin-logout',
	})
	@ApiSuccessResponse(RemoteAccessTailscalePluginStatusResponseModel, 'Tailscale node status after sign-out')
	@Roles(UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('logout')
	async logout(
		@Res({ passthrough: true }) res: Response,
		@Req() request?: AuthenticatedRequest,
	): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		this.logger.debug('Tailscale logout requested');

		try {
			await this.loginService.logout();
		} catch (error) {
			this.mapActionError(error, 'Tailscale logout failed', 'Failed to sign out of Tailscale');
		}

		return this.buildStatusResponse(res, request);
	}

	@ApiOperation({
		tags: [REMOTE_ACCESS_TAILSCALE_PLUGIN_API_TAG_NAME],
		summary: 'Reset Tailscale preferences',
		description:
			'Runs `tailscale up --reset` with the full managed flag set, clearing any preference the administrator changed outside Smart Panel.',
		operationId: 'create-remote-access-tailscale-plugin-reset-preferences',
	})
	@ApiSuccessResponse(
		RemoteAccessTailscalePluginStatusResponseModel,
		'Tailscale node status after resetting preferences',
	)
	@Roles(UserRole.OWNER)
	@HttpCode(HttpStatus.OK)
	@Post('reset-preferences')
	async resetPreferences(
		@Res({ passthrough: true }) res: Response,
		@Req() request?: AuthenticatedRequest,
	): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		this.logger.debug('Tailscale reset-preferences requested');

		try {
			await this.loginService.resetPreferences();
		} catch (error) {
			this.mapActionError(error, 'Tailscale reset-preferences failed', 'Failed to reset Tailscale preferences');
		}

		return this.buildStatusResponse(res, request);
	}

	/**
	 * Shared by `login`/`logout`/`resetPreferences`: a prerequisite refused by
	 * `TailscaleLoginService`'s own pre-check (`TailscaleRequirementUnsatisfiedException`)
	 * or a CLI call that still failed for real after passing it
	 * (`TailscaleCliError`) both map to `409 Conflict` with a body carrying a
	 * stable machine-readable `code` alongside the human `message` — 'kind' is
	 * remapped to a distinct, action-oriented code rather than reusing the
	 * requirement code verbatim, since "the daemon isn't running" reads
	 * differently discovered from a live call than from the pre-check.
	 * Everything else (timeout, unknown, a plain Error, ...) stays a 500,
	 * exactly as it always has.
	 *
	 * In production the envelope carries this as `error.details.code` /
	 * `error.details.reason` (see D13, RA-27, #996).
	 */
	private mapActionError(error: unknown, logPrefix: string, fallbackMessage: string): never {
		if (
			error instanceof TailscaleOperationCancelledException ||
			error instanceof TailscaleOperationInProgressException ||
			error instanceof TailscalePluginDisabledException ||
			error instanceof TailscaleChildTerminationException
		) {
			throw new ConflictException({ code: error.code, message: error.message });
		}

		if (error instanceof TailscaleNodeStopFailedException) {
			throw new ConflictException({ code: 'disconnect-failed', message: error.message });
		}

		if (error instanceof TailscaleRequirementUnsatisfiedException) {
			throw new ConflictException({ code: error.requirement.code, message: error.message });
		}

		if (error instanceof TailscaleCliError) {
			switch (error.kind) {
				case 'permission-denied':
					throw new ConflictException({ code: 'operator-not-granted', message: error.message });
				case 'daemon-down':
					throw new ConflictException({ code: 'daemon-not-active', message: error.message });
				case 'needs-login':
					throw new ConflictException({ code: 'not-signed-in', message: error.message });
				default:
					break;
			}
		}

		const err = error as Error;

		this.logger.error(`${logPrefix}: ${err.message}`);

		throw new InternalServerErrorException(fallbackMessage);
	}

	/** Shared by `logout`/`resetPreferences` — the same composition `StatusController.getStatus()` uses, including the no-store guard for a state that happens to come back pending-auth. */
	private async buildStatusResponse(
		res: Response,
		request?: AuthenticatedRequest,
	): Promise<RemoteAccessTailscalePluginStatusResponseModel> {
		const [status, requirements, privilegedWorkerSupport] = await Promise.all([
			this.providerService.getStatus(),
			this.nodeManagedService.evaluateRequirements(),
			this.platformService.getPrivilegedWorkerSupport(),
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
		data.control = buildTailscaleControlModel(
			this.nodeManagedService.getControlState(),
			status.state,
			requirements,
			request?.auth?.role,
		);

		const lastJob = this.setupService.getLastJob();
		data.setup = lastJob
			? toInstance(RemoteAccessTailscalePluginSetupJobModel, {
					job_id: lastJob.id,
					state: lastJob.status.state,
					step: lastJob.status.step ?? null,
					message: lastJob.status.message ?? null,
					updated_at: lastJob.status.updatedAt,
				})
			: null;
		const privilegedSetup = new RemoteAccessTailscalePluginPrivilegedSetupModel();
		privilegedSetup.available = privilegedWorkerSupport.supported;
		privilegedSetup.reason = privilegedWorkerSupport.reason;
		data.privilegedSetup = privilegedSetup;

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
