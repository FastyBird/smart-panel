import { existsSync, mkdirSync } from 'fs';
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
import { RemoteAccessCloudflareTunnelPluginConfigModel } from '../models/config.model';
import {
	CLOUDFLARE_TUNNEL_DATA_SUBDIR,
	CLOUDFLARE_TUNNEL_SETUP_STATUS_FILENAME,
	CLOUDFLARE_TUNNEL_SETUP_WORKER_UNIT,
	REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
} from '../remote-access-cloudflare-tunnel.constants';
import { CloudflareTunnelSetupUnavailableException } from '../remote-access-cloudflare-tunnel.exceptions';

import { CloudflareTunnelManagedService } from './cloudflare-tunnel-managed.service';

export { CloudflareTunnelSetupUnavailableException };

/** Payload of the `RemoteAccessModule.Setup.Progress` event this service emits for every status tick. */
export interface CloudflareTunnelSetupProgressEvent {
	type: string;
	job: string;
	step?: string;
	state: PrivilegedJobStatus['state'];
	message?: string;
}

/**
 * Starts the privileged, one-time `cloudflared` package install through `PrivilegedWorkerService`
 * (D9/D11 — only the binary install is privileged; the tunnel connector itself runs as an
 * unprivileged child process, owned by `CloudflareTunnelManagedService`) and forwards its
 * progress as `RemoteAccessModule.Setup.Progress` events. Mirrors `TailscaleSetupService`.
 */
@Injectable()
export class CloudflareTunnelSetupService {
	private readonly logger = createExtensionLogger(
		REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
		'CloudflareTunnelSetupService',
	);

	// The last known setup job, so `StatusController` can expose it on `GET /status` for the
	// admin wizard to poll as a fallback to the `RemoteAccessModule.Setup.Progress` websocket
	// event. Never persisted — a restart forgets any job that ran before it.
	private lastJob: { id: string; status: PrivilegedJobStatus } | null = null;

	constructor(
		private readonly privilegedWorker: PrivilegedWorkerService,
		private readonly nestConfigService: NestConfigService,
		private readonly tunnelManagedService: CloudflareTunnelManagedService,
		private readonly eventEmitter: EventEmitter2,
		private readonly platformService: PlatformService,
		private readonly configService: ConfigService,
		private readonly managedServiceManager: ManagedServiceManagerService,
	) {}

	/**
	 * Starts the setup job and returns immediately with its id. Throws
	 * `CloudflareTunnelSetupUnavailableException` — a permanent refusal, mapped to `422` — when
	 * the platform has no privileged-worker support at all (`code: 'platform-unsupported'`), or
	 * the platform IS capable but the privileged-worker probe currently fails
	 * (`code: 'privileged-worker-unavailable'`, e.g. a missing sudoers grant — this can resolve
	 * itself without a restart, see `PlatformService.getPrivilegedWorkerSupport()`'s
	 * negative-cache TTL). A busy unit (`PrivilegedWorkerUnavailableException`, mapped to `409`)
	 * is the only thing `PrivilegedWorkerService.run()` can still throw from here.
	 */
	async install(): Promise<{ id: string }> {
		const privilegedWorkerSupport = await this.platformService.getPrivilegedWorkerSupport();

		if (!privilegedWorkerSupport.supported) {
			if (!this.platformService.isPlatformCapableOfPrivilegedWorkers()) {
				throw new CloudflareTunnelSetupUnavailableException(
					`Cloudflare Tunnel setup requires a platform with privileged-worker support; the '${this.platformService.getPlatformType()}' platform does not have it.`,
					'platform-unsupported',
				);
			}

			const reason =
				privilegedWorkerSupport.reason ?? 'Privileged jobs are currently unavailable on this installation.';

			throw new CloudflareTunnelSetupUnavailableException(
				`${reason} Re-run \`sudo smart-panel-service install\`, or add the sudoers grant from the installation guide.`,
				'privileged-worker-unavailable',
			);
		}

		const dataDir = getEnvValue<string>(this.nestConfigService, 'FB_DATA_DIR', '/var/lib/smart-panel');
		const remoteAccessDir = join(dataDir, CLOUDFLARE_TUNNEL_DATA_SUBDIR);

		this.ensureDir(remoteAccessDir);

		const statusFile = join(remoteAccessDir, CLOUDFLARE_TUNNEL_SETUP_STATUS_FILENAME);
		const script = join(__dirname, '..', 'scripts', 'cloudflared-setup.sh');

		if (!existsSync(script)) {
			throw new Error(`Cloudflare Tunnel setup script not found at ${script}`);
		}

		const { id } = await this.privilegedWorker.run({
			unit: CLOUDFLARE_TUNNEL_SETUP_WORKER_UNIT,
			script,
			args: [],
			env: {
				STATUS_FILE: statusFile,
				HOME: process.env.HOME ?? '/root',
				PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
			},
			statusFile,
		});

		this.logger.log(`Cloudflare Tunnel setup job spawned (job: ${id})`);

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
	 * websocket event. `null` when no job has run since this process started.
	 */
	getLastJob(): { id: string; status: PrivilegedJobStatus } | null {
		return this.lastJob;
	}

	private watchJob(id: string): void {
		const unsubscribe = this.privilegedWorker.onStatus(id, (status: PrivilegedJobStatus) => {
			this.lastJob = { id, status };

			const event: CloudflareTunnelSetupProgressEvent = {
				type: REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
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
				this.logger.log(`Cloudflare Tunnel setup job completed (job: ${id})`);

				void this.onSetupComplete();
			} else {
				this.logger.error(`Cloudflare Tunnel setup job did not complete (job: ${id}, state: ${status.state})`, {
					step: status.step,
					message: status.message,
				});
			}

			unsubscribe();
		});
	}

	/**
	 * Best-effort: nothing here must ever surface a completed setup job as a failure. Refreshes
	 * the tunnel's requirements, then — when the plugin is enabled — restarts the `tunnel`
	 * managed service so it picks up the freshly-installed binary immediately, instead of
	 * waiting for the poller's own self-healing respawn.
	 */
	private async onSetupComplete(): Promise<void> {
		try {
			await this.tunnelManagedService.refreshRequirements();
		} catch (error) {
			this.logger.warn('Failed to refresh Cloudflare Tunnel requirements after setup', {
				message: error instanceof Error ? error.message : String(error),
			});
		}

		try {
			const pluginConfig = this.configService.getPluginConfig<RemoteAccessCloudflareTunnelPluginConfigModel>(
				REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
			);

			if (pluginConfig.enabled) {
				await this.managedServiceManager.restartService(
					'plugin',
					REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME,
					'tunnel',
				);
			}
		} catch (error) {
			this.logger.warn('Failed to restart the Cloudflare Tunnel service after setup', {
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
