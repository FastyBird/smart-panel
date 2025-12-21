import { validate } from 'class-validator';

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
