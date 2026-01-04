import si from 'systeminformation';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { PLATFORM_MODULE_NAME } from '../platform.constants';
import { Platform } from '../platforms/abstract.platform';
import { GenericPlatform } from '../platforms/generic.platform';
import { RaspberryPlatform } from '../platforms/raspberry.platform';

@Injectable()
export class PlatformService {
	private platform: Platform;
	private readonly logger = createExtensionLogger(PLATFORM_MODULE_NAME, 'PlatformService');

	constructor() {
		this.detectPlatform()
			.then((platform) => {
				this.platform = platform;

				this.logger.log(`Platform detected: ${platform.constructor.name}`);
			})
			.catch((error) => {
				const err = error as Error;

				this.logger.error(`Failed to detect platform, falling back to GenericPlatform error=${err.message}`, {
					stack: err.stack,
				});

				this.platform = new GenericPlatform();
			});
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

	private async detectPlatform(): Promise<Platform> {
		const systemInfo = await si.system();
		const osInfo = await si.osInfo();

		this.logger.log(`System Info: Model: ${systemInfo.model}, Manufacturer: ${systemInfo.manufacturer}`);
		this.logger.log(`OS Info: Platform: ${osInfo.platform}, Architecture: ${osInfo.arch}`);

		if (
			systemInfo.model?.toLowerCase().includes('raspberry') ||
			systemInfo.manufacturer?.toLowerCase().includes('raspberry')
		) {
			this.logger.log('Raspberry Pi platform detected');

			return new RaspberryPlatform();
		}

		this.logger.log('Generic platform detected');

		return new GenericPlatform();
	}
}
