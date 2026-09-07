import { existsSync, readFileSync } from 'fs';
import { execFile } from 'node:child_process';
import si from 'systeminformation';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PLATFORM_MODULE_NAME, PLATFORM_TYPE_ENV, PlatformType } from '../platform.constants';
import { Platform } from '../platforms/abstract.platform';
import { DevelopmentPlatform } from '../platforms/development.platform';
import { DockerPlatform } from '../platforms/docker.platform';
import { GenericPlatform } from '../platforms/generic.platform';
import { HomeAssistantPlatform } from '../platforms/home-assistant.platform';
import { RaspberryPlatform } from '../platforms/raspberry.platform';

// Platforms that never own the host's systemd/sudoers configuration — privileged
// workers (OS update, Tailscale setup, ...) are never available there, so there is
// nothing to probe.
const PRIVILEGED_WORKERS_UNSUPPORTED_PLATFORMS: ReadonlySet<PlatformType> = new Set([
	PlatformType.DOCKER,
	PlatformType.HOME_ASSISTANT,
	PlatformType.DEVELOPMENT,
]);

// A negative probe result (sudo/systemd-run currently refuses) is cached only this long, so a
// sudoers grant added after boot — the exact failure mode hardware acceptance testing hit on
// 2026-09-07 — is picked up without a full backend restart. A positive result never expires for
// the life of the process — see getPrivilegedWorkerSupport().
const PRIVILEGED_WORKER_SUPPORT_NEGATIVE_CACHE_TTL_MS = 60_000;

// systemd-run --scope spins up a real transient unit rather than merely asking sudo to list its
// policy, so this allows a little more headroom than the previous, cheaper `sudo -n -l` probe.
const PRIVILEGED_WORKER_PROBE_TIMEOUT_MS = 5_000;

/** Result of probing whether this platform can run a privileged job right now. */
export interface PrivilegedWorkerSupport {
	/** Whether `PrivilegedWorkerService.run()` can spawn a privileged job right now. */
	supported: boolean;
	/**
	 * Why not, when `supported` is false — a technical detail (e.g. sudo's own stderr), not
	 * user-facing copy on its own. `null` when `supported` is true.
	 */
	reason: string | null;
	/** ISO 8601 timestamp of when this result was produced — freshly probed, or served from cache. */
	checkedAt: string;
}

@Injectable()
export class PlatformService {
	private platform: Platform;
	private platformType: PlatformType;
	private readonly logger = createExtensionLogger(PLATFORM_MODULE_NAME, 'PlatformService');

	// The constructor's own detection chain, stored so callers that run before it settles
	// (supportsPrivilegedWorkers in particular) can await it instead of reading platformType
	// while it is still undefined.
	private readonly platformDetection: Promise<void>;

	// Caches the resolved probe result. `cacheExpiresAt === null` means "cached for the process
	// lifetime" (a positive result, or an architecturally-unsupported platform that can never
	// change without a redeploy); otherwise the cache is only valid until that timestamp (a
	// negative, potentially-transient probe result on an otherwise-capable platform).
	private privilegedWorkerSupportCache: PrivilegedWorkerSupport | null = null;
	private privilegedWorkerSupportCacheExpiresAt: number | null = null;

	// Caches the in-flight probe promise itself (not just its resolved value) so concurrent
	// callers before the first result share one probe instead of each starting their own
	// sudo/systemd-run invocation.
	private privilegedWorkerSupportPromise: Promise<PrivilegedWorkerSupport> | null = null;

	constructor() {
		this.platformDetection = this.detectPlatform()
			.then(({ platform, type }) => {
				this.platform = platform;
				this.platformType = type;

				this.logger.log(`Platform detected: ${type} (${platform.constructor.name})`);
			})
			.catch((error) => {
				const err = error as Error;

				this.logger.error(`Failed to detect platform, falling back to GenericPlatform error=${err.message}`, {
					stack: err.stack,
				});

				this.platform = new GenericPlatform();
				this.platformType = PlatformType.GENERIC;
			});
	}

	getPlatformType(): PlatformType {
		return this.platformType;
	}

	/**
	 * Resolves once platform detection has finished, then returns the
	 * detected type. Prefer this over the synchronous `getPlatformType()` in
	 * any code path that might run before detection settles (e.g.
	 * immediately after boot) — reading `platformType` that early returns
	 * `undefined`, which is never a valid `PlatformType`.
	 */
	async getPlatformTypeAsync(): Promise<PlatformType> {
		await this.platformDetection;

		return this.platformType;
	}

	/**
	 * True when this platform can run privileged operations (OS update, Tailscale setup, ...)
	 * through PrivilegedWorkerService right now. A boolean-only wrapper over
	 * `getPrivilegedWorkerSupport()` for callers that only need the yes/no answer, not the reason
	 * (`PrivilegedWorkerService.run()`'s own pre-check, in particular).
	 */
	async supportsPrivilegedWorkers(): Promise<boolean> {
		const { supported } = await this.getPrivilegedWorkerSupport();

		return supported;
	}

	/**
	 * Whether this platform can run a privileged job right now, and why not when it can't.
	 * Always false for docker, home-assistant and development — see
	 * `isPlatformCapableOfPrivilegedWorkers()` to distinguish that permanent case from a probe
	 * that merely fails right now.
	 *
	 * A positive result is cached for the life of the process — once a privileged job has run
	 * successfully there is no operational reason it would stop working. A negative result on an
	 * otherwise-capable platform is cached for only `PRIVILEGED_WORKER_SUPPORT_NEGATIVE_CACHE_TTL_MS`
	 * (60s): unlike a positive result, "no" can become "yes" purely from an administrator adding a
	 * sudoers grant, and without this short TTL that fix would silently require a full backend
	 * restart to take effect (the exact gap hardware acceptance testing hit on 2026-09-07). An
	 * architecturally unsupported platform is cached forever too — no sudoers change can ever make
	 * privileged workers available there.
	 *
	 * Waits for platform detection to finish before deciding. Concurrent callers before the first
	 * result share one in-flight probe.
	 */
	async getPrivilegedWorkerSupport(): Promise<PrivilegedWorkerSupport> {
		await this.platformDetection;

		const cached = this.getFreshPrivilegedWorkerSupportCache();

		if (cached) {
			return cached;
		}

		if (this.privilegedWorkerSupportPromise === null) {
			this.privilegedWorkerSupportPromise = this.probePrivilegedWorkerSupport().finally(() => {
				this.privilegedWorkerSupportPromise = null;
			});
		}

		const result = await this.privilegedWorkerSupportPromise;

		this.privilegedWorkerSupportCache = result;
		this.privilegedWorkerSupportCacheExpiresAt =
			result.supported || PRIVILEGED_WORKERS_UNSUPPORTED_PLATFORMS.has(this.platformType)
				? null
				: Date.now() + PRIVILEGED_WORKER_SUPPORT_NEGATIVE_CACHE_TTL_MS;

		return result;
	}

	/**
	 * True unless this platform (docker, home-assistant, development) has no privileged-worker
	 * support built in at all. Distinguishes an architectural "no" — nothing short of changing
	 * platform/deployment fixes it — from a probed "no" from `getPrivilegedWorkerSupport()` (e.g.
	 * a missing sudoers grant), which can resolve itself without a redeploy.
	 *
	 * Reads `platformType` synchronously, so callers must have already awaited platform detection
	 * at least once (e.g. by calling `getPrivilegedWorkerSupport()` or `getPlatformTypeAsync()`
	 * first) — this method does not itself await `platformDetection`.
	 */
	isPlatformCapableOfPrivilegedWorkers(): boolean {
		return !PRIVILEGED_WORKERS_UNSUPPORTED_PLATFORMS.has(this.platformType);
	}

	private getFreshPrivilegedWorkerSupportCache(): PrivilegedWorkerSupport | null {
		if (!this.privilegedWorkerSupportCache) {
			return null;
		}

		const fresh =
			this.privilegedWorkerSupportCacheExpiresAt === null || Date.now() < this.privilegedWorkerSupportCacheExpiresAt;

		return fresh ? this.privilegedWorkerSupportCache : null;
	}

	private async probePrivilegedWorkerSupport(): Promise<PrivilegedWorkerSupport> {
		const checkedAt = new Date().toISOString();

		if (PRIVILEGED_WORKERS_UNSUPPORTED_PLATFORMS.has(this.platformType)) {
			return {
				supported: false,
				reason: `The '${this.platformType}' platform does not support privileged workers.`,
				checkedAt,
			};
		}

		const probe = await this.probeSystemdRunScope();

		return { supported: probe.success, reason: probe.success ? null : probe.reason, checkedAt };
	}

	getSystemInfo() {
		this.logger.debug('Fetching system information');

		return this.platform.getSystemInfo();
	}

	getThrottleStatus() {
		this.logger.debug('Fetching system throttle status');

		return this.platform.getThrottleStatus();
	}

	getTemperature() {
		this.logger.debug('Fetching system temperature');

		return this.platform.getTemperature();
	}

	getNetworkStats() {
		this.logger.debug('Fetching network statistics');

		return this.platform.getNetworkStats();
	}

	getWifiNetworks() {
		return this.platform.getWifiNetworks();
	}

	setSpeakerVolume(volume: number) {
		this.logger.log(`Setting speaker volume to ${volume}%`);

		return this.platform.setSpeakerVolume(volume);
	}

	muteSpeaker(mute: boolean) {
		this.logger.log(`${mute ? 'Muting' : 'Unmuting'} speaker`);

		return this.platform.muteSpeaker(mute);
	}

	setMicrophoneVolume(volume: number) {
		this.logger.log(`Setting microphone volume to ${volume}%`);

		return this.platform.setMicrophoneVolume(volume);
	}

	muteMicrophone(mute: boolean) {
		this.logger.log(`${mute ? 'Muting' : 'Unmuting'} microphone`);

		return this.platform.muteMicrophone(mute);
	}

	reboot() {
		this.logger.log('Restarting device');

		return this.platform.rebootDevice();
	}

	powerOff() {
		this.logger.log('Power off device');

		return this.platform.powerOffDevice();
	}

	private async detectPlatform(): Promise<{ platform: Platform; type: PlatformType }> {
		// Check for explicit platform type via environment variable
		const envPlatformType = process.env[PLATFORM_TYPE_ENV]?.toLowerCase();

		if (envPlatformType) {
			const platformType = Object.values(PlatformType).find((t: string) => t === envPlatformType);

			if (platformType) {
				this.logger.log(`Platform type set via ${PLATFORM_TYPE_ENV} env var: ${platformType}`);

				return { platform: this.createPlatform(platformType), type: platformType };
			}

			this.logger.warn(
				`Unknown ${PLATFORM_TYPE_ENV} value: "${envPlatformType}". Valid values: ${Object.values(PlatformType).join(', ')}. Falling back to auto-detection.`,
			);
		}

		// Auto-detect platform
		return this.autoDetectPlatform();
	}

	private async autoDetectPlatform(): Promise<{ platform: Platform; type: PlatformType }> {
		// SUPERVISOR_TOKEN is always set inside HA addons by the Supervisor
		if (process.env.SUPERVISOR_TOKEN) {
			this.logger.log('Home Assistant Supervisor environment detected (SUPERVISOR_TOKEN present)');

			return { platform: this.createPlatform(PlatformType.HOME_ASSISTANT), type: PlatformType.HOME_ASSISTANT };
		}

		const systemInfo = await si.system();
		const osInfo = await si.osInfo();

		this.logger.log(`System Info: Model: ${systemInfo.model}, Manufacturer: ${systemInfo.manufacturer}`);
		this.logger.log(`OS Info: Platform: ${osInfo.platform}, Architecture: ${osInfo.arch}`);

		if (
			systemInfo.model?.toLowerCase().includes('raspberry') ||
			systemInfo.manufacturer?.toLowerCase().includes('raspberry') ||
			this.isRaspberryPiHardware()
		) {
			this.logger.log('Raspberry Pi platform detected');

			return { platform: this.createPlatform(PlatformType.RASPBERRY), type: PlatformType.RASPBERRY };
		}

		this.logger.log('Generic platform detected');

		return { platform: this.createPlatform(PlatformType.GENERIC), type: PlatformType.GENERIC };
	}

	/**
	 * Check the device-tree model file for Raspberry Pi hardware.
	 * This detects CM4-based boards (e.g. reTerminal) where the board
	 * manufacturer differs but the SoC is still Raspberry Pi.
	 */
	private isRaspberryPiHardware(): boolean {
		const deviceTreePath = '/proc/device-tree/model';

		try {
			if (existsSync(deviceTreePath)) {
				const model = readFileSync(deviceTreePath, 'utf-8').toLowerCase();

				this.logger.log(`Device-tree model: ${model.trim()}`);

				return model.includes('raspberry');
			}
		} catch {
			// Ignore read errors — file may not exist on non-Linux platforms
		}

		return false;
	}

	/**
	 * Runs a real, harmless `systemd-run --scope` through the exact sudoers grant every
	 * privileged job actually uses (`/usr/bin/systemd-run *` — see
	 * `build/src/installers/linux.ts`'s `createSudoersRule()`), rather than only asking sudo to
	 * list its policy (`sudo -n -l`): a sudoers rule can permit `-l` while the real invocation
	 * still fails for an unrelated reason (a wrong NOPASSWD tag, `systemd-run` missing from the
	 * elevated PATH, dbus unavailable, ...) — only actually running the command tells the whole
	 * story. `--unit` is namespaced with this process's pid so concurrent probes (e.g. across a
	 * restart window) can never collide on the same transient unit name. stderr is captured so a
	 * real refusal reason (e.g. "sudo: a password is required") reaches the admin instead of a
	 * generic failure.
	 */
	private async probeSystemdRunScope(): Promise<{ success: boolean; reason: string | null }> {
		const unit = `smart-panel-privileged-probe-${process.pid}`;

		return new Promise((resolve) => {
			execFile(
				'sudo',
				['-n', 'systemd-run', '--scope', '--quiet', `--unit=${unit}`, '/bin/true'],
				{ timeout: PRIVILEGED_WORKER_PROBE_TIMEOUT_MS },
				(error, _stdout, stderr) => {
					if (!error) {
						resolve({ success: true, reason: null });

						return;
					}

					const detail = (stderr ?? '').toString().trim() || error.message;

					this.logger.debug(`Privileged-worker probe (systemd-run scope) failed: ${detail}`);

					resolve({ success: false, reason: detail });
				},
			);
		});
	}

	private createPlatform(type: PlatformType): Platform {
		switch (type) {
			case PlatformType.RASPBERRY:
				return new RaspberryPlatform();
			case PlatformType.DOCKER:
				return new DockerPlatform();
			case PlatformType.DEVELOPMENT:
				return new DevelopmentPlatform();
			case PlatformType.HOME_ASSISTANT:
				return new HomeAssistantPlatform();
			case PlatformType.GENERIC:
			default:
				return new GenericPlatform();
		}
	}
}
