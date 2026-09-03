import { existsSync, readFileSync } from 'fs';
import { execFile } from 'node:child_process';
import si from 'systeminformation';
import { promisify } from 'util';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PLATFORM_MODULE_NAME, PLATFORM_TYPE_ENV, PlatformType } from '../platform.constants';
import { Platform } from '../platforms/abstract.platform';
import { DevelopmentPlatform } from '../platforms/development.platform';
import { DockerPlatform } from '../platforms/docker.platform';
import { GenericPlatform } from '../platforms/generic.platform';
import { HomeAssistantPlatform } from '../platforms/home-assistant.platform';
import { RaspberryPlatform } from '../platforms/raspberry.platform';

const execFileAsync = promisify(execFile);

// Platforms that never own the host's systemd/sudoers configuration — privileged
// workers (OS update, Tailscale setup, ...) are never available there, so there is
// nothing to probe.
const PRIVILEGED_WORKERS_UNSUPPORTED_PLATFORMS: ReadonlySet<PlatformType> = new Set([
	PlatformType.DOCKER,
	PlatformType.HOME_ASSISTANT,
	PlatformType.DEVELOPMENT,
]);

@Injectable()
export class PlatformService {
	private platform: Platform;
	private platformType: PlatformType;
	private readonly logger = createExtensionLogger(PLATFORM_MODULE_NAME, 'PlatformService');
	private privilegedWorkersSupportedCache: boolean | null = null;

	constructor() {
		this.detectPlatform()
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
	 * True when this platform can run privileged operations (OS update, Tailscale setup, ...)
	 * through PrivilegedWorkerService — i.e. passwordless sudo and systemd-run are both
	 * available. Always false for docker, home-assistant and development. Probed at most once
	 * and cached for the life of the process.
	 */
	async supportsPrivilegedWorkers(): Promise<boolean> {
		if (this.privilegedWorkersSupportedCache !== null) {
			return this.privilegedWorkersSupportedCache;
		}

		if (PRIVILEGED_WORKERS_UNSUPPORTED_PLATFORMS.has(this.platformType)) {
			this.privilegedWorkersSupportedCache = false;

			return false;
		}

		const [sudoAvailable, systemdRunAvailable] = await Promise.all([
			this.probeSudoNonInteractive(),
			this.probeSystemdRunAvailable(),
		]);

		this.privilegedWorkersSupportedCache = sudoAvailable && systemdRunAvailable;

		return this.privilegedWorkersSupportedCache;
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

	/** Passwordless sudo probe — mirrors the check update-worker.sh itself runs before it relies on sudo -n. */
	private async probeSudoNonInteractive(): Promise<boolean> {
		try {
			await execFileAsync('sudo', ['-n', '/usr/bin/true'], { timeout: 2000 });

			return true;
		} catch {
			return false;
		}
	}

	/** systemd-run presence probe — privileged jobs run inside a systemd-run --scope. */
	private async probeSystemdRunAvailable(): Promise<boolean> {
		try {
			await execFileAsync('which', ['systemd-run'], { timeout: 2000 });

			return true;
		} catch {
			return false;
		}
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
