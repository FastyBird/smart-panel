import { existsSync, mkdirSync } from 'fs';
import os from 'os';
import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { getEnvValue } from '../../../common/utils/config.utils';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import {
	PrivilegedJobStatus,
	PrivilegedWorkerService,
} from '../../../modules/system/services/privileged-worker.service';
import {
	REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV,
	REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME,
	TAILSCALE_DATA_SUBDIR,
	TAILSCALE_SETUP_STATUS_FILENAME,
	TAILSCALE_SETUP_WORKER_UNIT,
} from '../remote-access-tailscale.constants';

import { TailscaleNodeManagedService } from './tailscale-node-managed.service';

/** Payload of the `RemoteAccessModule.Setup.Progress` event this service emits for every status tick. */
export interface TailscaleSetupProgressEvent {
	type: string;
	job: string;
	step?: string;
	state: PrivilegedJobStatus['state'];
	message?: string;
}

/**
 * Raised by `install()` before any privileged worker is spawned, for a
 * *permanent* reason that will not resolve itself by retrying: the platform
 * has no privileged-worker support, or the `FB_REMOTE_ACCESS_ALLOW_DEV`
 * override is set. The controller maps this to `422 Unprocessable Entity`.
 * A job already running is a *transient* condition instead — see
 * `PrivilegedWorkerUnavailableException`, which `PrivilegedWorkerService.run()`
 * itself throws for that case and which the controller maps to `409 Conflict`.
 */
export class TailscaleSetupUnavailableException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TailscaleSetupUnavailableException';
	}
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

	constructor(
		private readonly privilegedWorker: PrivilegedWorkerService,
		private readonly nestConfigService: NestConfigService,
		private readonly nodeManagedService: TailscaleNodeManagedService,
		private readonly eventEmitter: EventEmitter2,
		private readonly platformService: PlatformService,
	) {}

	/**
	 * Starts the setup job and returns immediately with its id — progress is
	 * streamed separately via `RemoteAccessModule.Setup.Progress`. Throws
	 * `TailscaleSetupUnavailableException` — a permanent refusal, mapped to
	 * `422` — when the dev override is set or the platform has no
	 * privileged-worker support; neither case ever reaches
	 * `PrivilegedWorkerService.run()`, so a busy unit (`PrivilegedWorkerUnavailableException`,
	 * mapped to `409`) is the only thing `run()` can still throw from here.
	 */
	async install(): Promise<{ id: string }> {
		const allowDev = getEnvValue<boolean>(this.nestConfigService, REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV, false);

		if (allowDev) {
			throw new TailscaleSetupUnavailableException(
				`Tailscale setup is unavailable while ${REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV} is set. Prepare tailscale manually on the development platform: install it, run tailscaled, and grant the current user as operator.`,
			);
		}

		const supportsPrivilegedWorkers = await this.platformService.supportsPrivilegedWorkers();

		if (!supportsPrivilegedWorkers) {
			throw new TailscaleSetupUnavailableException(
				`Tailscale setup requires a platform with privileged-worker support; the '${this.platformService.getPlatformType()}' platform does not have it.`,
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

		this.watchJob(id);

		return { id };
	}

	private watchJob(id: string): void {
		const unsubscribe = this.privilegedWorker.onStatus(id, (status: PrivilegedJobStatus) => {
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

				void this.refreshRequirementsAfterSetup();
			} else {
				this.logger.error(`Tailscale setup job did not complete (job: ${id}, state: ${status.state})`, {
					step: status.step,
					message: status.message,
				});
			}

			unsubscribe();
		});
	}

	/** Best-effort: a stale requirements read after setup completes must never surface as a job failure. */
	private async refreshRequirementsAfterSetup(): Promise<void> {
		try {
			await this.nodeManagedService.evaluateRequirements();
		} catch (error) {
			this.logger.warn('Failed to refresh Tailscale requirements after setup', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private ensureDir(dir: string): void {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
	}
}
