import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { Logger } from '@nestjs/common';

import { NetworkStatsDto } from '../dto/network-stats.dto';
import { SystemInfoDto } from '../dto/system-info.dto';
import { TemperatureDto } from '../dto/temperature.dto';
import { ThrottleStatusDto } from '../dto/throttle-status.dto';
import { WifiNetworksDto } from '../dto/wifi-networks.dto';
import { PlatformException } from '../platform.exceptions';

export abstract class Platform {
	protected logger = new Logger(Platform.name);

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

	protected validateDto<T extends object>(dtoClass: new () => T, rawData: unknown): T {
		const instance = plainToInstance(dtoClass, rawData);
		const errors = validateSync(instance, { whitelist: true });

		if (errors.length > 0) {
			this.logger.error(
				`[VALIDATE] Validation failed for DTO: ${dtoClass.name}`,
				errors.map((error) => error.toString()),
			);

			throw new PlatformException('Validation of platform DTO failed. Error was logged.');
		}

		this.logger.debug(`[VALIDATE] DTO validation passed: ${dtoClass.name}`);

		return instance;
	}
}
