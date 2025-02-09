import si from 'systeminformation';

import { Injectable, Logger } from '@nestjs/common';

import { Platform } from '../platforms/abstract.platform';
import { GenericPlatform } from '../platforms/generic.platform';
import { RaspberryPlatform } from '../platforms/raspberry.platform';

@Injectable()
export class PlatformService {
	private platform: Platform;
	private readonly logger = new Logger(PlatformService.name);

	constructor() {
		this.detectPlatform()
			.then((platform) => {
				this.platform = platform;

				this.logger.log(`[INIT] Platform detected: ${platform.constructor.name}`);
			})
			.catch((error) => {
				const err = error as Error;

				this.logger.error(
					`[ERROR] Failed to detect platform, falling back to GenericPlatform error=${err.message}`,
					err.stack,
				);

				this.platform = new GenericPlatform();
			});
	}

	getSystemInfo() {
		this.logger.debug('[LOOKUP] Fetching system information');

		return this.platform.getSystemInfo();
	}

	getThrottleStatus() {
		this.logger.debug('[LOOKUP] Fetching system throttle status');

		return this.platform.getThrottleStatus();
	}

	getTemperature() {
		this.logger.debug('[LOOKUP] Fetching system temperature');

		return this.platform.getTemperature();
	}

	getNetworkStats() {
		this.logger.debug('[LOOKUP] Fetching network statistics');

		return this.platform.getNetworkStats();
	}

	getWifiNetworks() {
		this.logger.debug('[LOOKUP] Scanning available WiFi networks');

		return this.platform.getWifiNetworks();
	}

	setSpeakerVolume(volume: number) {
		this.logger.log(`[AUDIO] Setting speaker volume to ${volume}%`);

		return this.platform.setSpeakerVolume(volume);
	}

	muteSpeaker(mute: boolean) {
		this.logger.log(`[AUDIO] ${mute ? 'Muting' : 'Unmuting'} speaker`);

		return this.platform.muteSpeaker(mute);
	}

	setMicrophoneVolume(volume: number) {
		this.logger.log(`[AUDIO] Setting microphone volume to ${volume}%`);

		return this.platform.setMicrophoneVolume(volume);
	}

	muteMicrophone(mute: boolean) {
		this.logger.log(`[AUDIO] ${mute ? 'Muting' : 'Unmuting'} microphone`);

		return this.platform.muteMicrophone(mute);
	}

	private async detectPlatform(): Promise<Platform> {
		const systemInfo = await si.system();
		const osInfo = await si.osInfo();

		this.logger.log(`[DETECT] System Info: Model: ${systemInfo.model}, Manufacturer: ${systemInfo.manufacturer}`);
		this.logger.log(`[DETECT] OS Info: Platform: ${osInfo.platform}, Architecture: ${osInfo.arch}`);

		if (
			systemInfo.model?.toLowerCase().includes('raspberry') ||
			systemInfo.manufacturer?.toLowerCase().includes('raspberry')
		) {
			this.logger.log('[DETECT] Raspberry Pi platform detected');

			return new RaspberryPlatform();
		}

		this.logger.log('[DETECT] Generic platform detected');

		return new GenericPlatform();
	}
}
