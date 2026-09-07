import { existsSync, mkdirSync } from 'fs';
import os from 'os';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import {
	PrivilegedJobStatus,
	PrivilegedWorkerService,
} from '../../../modules/system/services/privileged-worker.service';
import { RemoteAccessTailscalePluginConfigModel } from '../models/config.model';
import {
	REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_DATA_SUBDIR,
	TAILSCALE_SETUP_STATUS_FILENAME,
	TAILSCALE_SETUP_WORKER_UNIT,
} from '../remote-access-tailscale.constants';
import { TailscaleSetupUnavailableException } from '../remote-access-tailscale.exceptions';

import { TailscaleNodeManagedService } from './tailscale-node-managed.service';

// Re-exported so existing importers (SetupController, this plugin's e2e spec, ...) keep working —
// the class itself now lives in remote-access-tailscale.exceptions.ts alongside its sibling
// TailscaleSetupUnavailableCode.
export { TailscaleSetupUnavailableException };

/** Payload of the `RemoteAccessModule.Setup.Progress` event this service emits for every status tick. */
export interface TailscaleSetupProgressEvent {
	type: string;
	job: string;
	step?: string;
	state: PrivilegedJobStatus['state'];
	message?: string;
}

/**
 * Starts the privileged, one-time Tailscale preparation job (install the
 * package if missing, enable `tailscaled`, grant the service user as
 * operator) through `PrivilegedWorkerService`, and forwards its progress as
 * `RemoteAccessModule.Setup.Progress` events. Everything else about the node
 * — sign-in, sign-out, preferences — is unprivileged and lives in
 * `TailscaleLoginService` / `TailscaleNodeManagedService`.
 */
@Injectable()
export class TailscaleSetupService {
	private readonly logger = createExtensionLogger(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'TailscaleSetupService');

	// The last known setup job, so `StatusController` can expose it on `GET /status` for the
	// admin wizard to poll as a fallback to the `RemoteAccessModule.Setup.Progress` websocket
	// event (see getLastJob()). Never persisted — a restart forgets any job that ran before it.
	private lastJob: { id: string; status: PrivilegedJobStatus } | null = null;

	constructor(
		private readonly privilegedWorker: PrivilegedWorkerService,
		private readonly nestConfigService: NestConfigService,
		private readonly nodeManagedService: TailscaleNodeManagedService,
		private readonly eventEmitter: EventEmitter2,
		private readonly platformService: PlatformService,
		private readonly configService: ConfigService,
		private readonly managedServiceManager: ManagedServiceManagerService,
	) {}

	/**
	 * Starts the setup job and returns immediately with its id — progress is
	 * streamed separately via `RemoteAccessModule.Setup.Progress`. Throws
	 * `TailscaleSetupUnavailableException` — a permanent refusal, mapped to
	 * `422` — when the dev override is set, the platform has no
	 * privileged-worker support (`code: 'platform-unsupported'`), or the
	 * platform IS capable but the privileged-worker probe currently fails
	 * (`code: 'privileged-worker-unavailable'`, e.g. a missing sudoers grant —
	 * this can resolve itself without a restart, see
	 * `PlatformService.getPrivilegedWorkerSupport()`'s negative-cache TTL).
	 * None of these ever reach `PrivilegedWorkerService.run()`, so a busy unit
	 * (`PrivilegedWorkerUnavailableException`, mapped to `409`) is the only
	 * thing `run()` can still throw from here.
	 */
	async install(): Promise<{ id: string }> {
		const allowDev = getEnvValue<boolean>(this.nestConfigService, REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV, false);

		if (allowDev) {
			throw new TailscaleSetupUnavailableException(
				`Tailscale setup is unavailable while ${REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV} is set. Prepare tailscale manually on the development platform: install it, run tailscaled, and grant the current user as operator.`,
				'platform-unsupported',
			);
		}

		const privilegedWorkerSupport = await this.platformService.getPrivilegedWorkerSupport();

		if (!privilegedWorkerSupport.supported) {
			if (!this.platformService.isPlatformCapableOfPrivilegedWorkers()) {
				throw new TailscaleSetupUnavailableException(
					`Tailscale setup requires a platform with privileged-worker support; the '${this.platformService.getPlatformType()}' platform does not have it.`,
					'platform-unsupported',
				);
			}

			const reason =
				privilegedWorkerSupport.reason ?? 'Privileged jobs are currently unavailable on this installation.';

			throw new TailscaleSetupUnavailableException(
				`${reason} Re-run \`sudo smart-panel-service install\`, or add the sudoers grant from the installation guide.`,
				'privileged-worker-unavailable',
			);
		}

		const dataDir = getEnvValue<string>(this.nestConfigService, 'FB_DATA_DIR', '/var/lib/smart-panel');
		const remoteAccessDir = join(dataDir, TAILSCALE_DATA_SUBDIR);

		this.ensureDir(remoteAccessDir);

		const statusFile = join(remoteAccessDir, TAILSCALE_SETUP_STATUS_FILENAME);
		const script = join(__dirname, '..', 'scripts', 'tailscale-setup.sh');

		if (!existsSync(script)) {
			throw new Error(`Tailscale setup script not found at ${script}`);
		}

		const serviceUser = os.userInfo().username;

		const { id } = await this.privilegedWorker.run({
			unit: TAILSCALE_SETUP_WORKER_UNIT,
			script,
			args: [],
			env: {
				STATUS_FILE: statusFile,
				SMART_PANEL_USER: serviceUser,
				HOME: process.env.HOME ?? '/root',
				PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
			},
			statusFile,
			// The script's own steps (a small apt install) are well inside the
			// default 10-minute PrivilegedWorkerService timeout — see the
			// spec's Performance Targets.
		});

		this.logger.log(`Tailscale setup job spawned (job: ${id})`);

		const initialStatus: PrivilegedJobStatus = this.privilegedWorker.getStatus(id) ?? {
			id,
			state: 'running',
			updatedAt: new Date().toISOString(),
		};

		this.lastJob = { id, status: initialStatus };

		this.watchJob(id);

		return { id };
	}

	/**
	 * The last known setup job — `StatusController` exposes this on `GET /status` (`setup`
	 * field) so the admin wizard can poll as a fallback to the `RemoteAccessModule.Setup.Progress`
	 * websocket event, in case that event is lost or the page reloads mid-job. `null` when no job
	 * has run since this process started.
	 */
	getLastJob(): { id: string; status: PrivilegedJobStatus } | null {
		return this.lastJob;
	}

	private watchJob(id: string): void {
		const unsubscribe = this.privilegedWorker.onStatus(id, (status: PrivilegedJobStatus) => {
			this.lastJob = { id, status };

			const event: TailscaleSetupProgressEvent = {
				type: REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
				job: id,
				step: status.step,
				state: status.state,
				message: status.message,
			};

			this.eventEmitter.emit(RemoteAccessEventType.SETUP_PROGRESS, event);

			if (status.state === 'running') {
				return;
			}

			if (status.state === 'complete') {
				this.logger.log(`Tailscale setup job completed (job: ${id})`);

				void this.onSetupComplete();
			} else {
				this.logger.error(`Tailscale setup job did not complete (job: ${id}, state: ${status.state})`, {
					step: status.step,
					message: status.message,
				});
			}

			unsubscribe();
		});
	}

	/**
	 * Best-effort: nothing here must ever surface a completed setup job as a failure.
	 * Refreshes the node's requirements, then — when the plugin is enabled — restarts the
	 * `node` managed service so it picks up the freshly-prepared tailscaled/operator grant
	 * immediately, instead of waiting for its own poller to notice on its own schedule.
	 */
	private async onSetupComplete(): Promise<void> {
		try {
			await this.refreshNodeRequirements();

			const pluginConfig = this.configService.getPluginConfig<RemoteAccessTailscalePluginConfigModel>(
				REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
			);

			if (pluginConfig.enabled) {
				await this.managedServiceManager.restartService('plugin', REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME, 'node');
			}
		} catch (error) {
			this.logger.warn('Failed to refresh Tailscale requirements after setup', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Calls `TailscaleNodeManagedService.refreshRequirements()` when it exists. That method is
	 * introduced by RA-17 (#985); until it has merged, this falls back to the pre-existing
	 * `evaluateRequirements()` read, which forces the same fresh requirements read without RA-17's
	 * additional side effects (raising/resolving a notification on requirement change). Remove
	 * this shim — and call `refreshRequirements('setup-complete')` unconditionally — once RA-17
	 * has landed.
	 */
	private async refreshNodeRequirements(): Promise<void> {
		const nodeManagedService = this.nodeManagedService as TailscaleNodeManagedService & {
			refreshRequirements?: (reason: string) => Promise<unknown>;
		};

		if (typeof nodeManagedService.refreshRequirements === 'function') {
			await nodeManagedService.refreshRequirements('setup-complete');

			return;
		}

		await this.nodeManagedService.evaluateRequirements();
	}

	private ensureDir(dir: string): void {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
	}
}
