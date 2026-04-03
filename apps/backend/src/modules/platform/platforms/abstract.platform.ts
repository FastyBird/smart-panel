import { validate } from 'class-validator';
import fs from 'fs/promises';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { NetworkStatsDto } from '../dto/network-stats.dto';
import { StorageDto, SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PLATFORM_MODULE_NAME } from '../platform.constants';
import { PlatformException } from '../platform.exceptions';

export abstract class Platform {
	protected logger = createExtensionLogger(PLATFORM_MODULE_NAME, 'Platform');

	abstract getSystemInfo(): Promise<SystemInfoDto>;
	abstract getThrottleStatus(): Promise<ThrottleStatusDto>;
	abstract getTemperature(): Promise<TemperatureDto>;
	abstract getNetworkStats(): Promise<NetworkStatsDto[]>;
	abstract getWifiNetworks(): Promise<WifiNetworksDto[]>;
	abstract setSpeakerVolume(volume: number): Promise<void>;
	abstract muteSpeaker(mute: boolean): Promise<void>;
	abstract setMicrophoneVolume(volume: number): Promise<void>;
	abstract muteMicrophone(mute: boolean): Promise<void>;
	abstract rebootDevice(): Promise<void>;
	abstract powerOffDevice(): Promise<void>;
	abstract getProcessUptimeSec(): Promise<number>;
	abstract getProcessStartTimeIso(): Promise<Date>;
	abstract getNodeVersion(): Promise<string>;
	abstract getNpmVersion(): Promise<string | null>;
	abstract getPrimaryDisk(): Promise<StorageDto>;

	protected static readonly THROTTLE_SYSFS_PATH = '/sys/devices/platform/soc/soc:firmware/get_throttled';

	/**
	 * Parse a raw hex throttle value into the four standard flags.
	 */
	protected parseThrottleFlags(status: number) {
		return {
			undervoltage: !!(status & 0x1),
			frequencyCapping: !!(status & 0x2),
			throttling: !!(status & 0x4),
			softTempLimit: !!(status & 0x8),
		};
	}

	/**
	 * Read throttle status from the Raspberry Pi firmware sysfs path.
	 * Returns null when the path is not available.
	 */
	protected async readThrottleFromSysfs(): Promise<ThrottleStatusDto | null> {
		try {
			const data = await fs.readFile(Platform.THROTTLE_SYSFS_PATH, 'utf-8');
			const status = parseInt(data.trim(), 16);

			if (!isNaN(status)) {
				return this.validateDto(ThrottleStatusDto, this.parseThrottleFlags(status));
			}
		} catch {
			// sysfs not available
		}

		return null;
	}

	protected async validateDto<T extends object>(dtoClass: new () => T, rawData: unknown): Promise<T> {
		const instance = toInstance(dtoClass, rawData);

		const errors = await validate(instance, { whitelist: true });

		if (errors.length > 0) {
			this.logger.error(`Validation failed for DTO: ${dtoClass.name}`, {
				errors: errors.map((error) => error.toString()),
			});

			throw new PlatformException('Validation of platform DTO failed. Error was logged.');
		}

		this.logger.debug(`DTO validation passed: ${dtoClass.name}`);

		return instance;
	}
}
