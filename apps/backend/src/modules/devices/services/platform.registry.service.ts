import { Injectable, Logger } from '@nestjs/common';

import { DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';

@Injectable()
export class PlatformRegistryService {
	private readonly logger = new Logger(PlatformRegistryService.name);

	private readonly platforms: Record<string, IDevicePlatform> = {};

	register(platform: IDevicePlatform): boolean {
		const type = platform.getType();

		if (type in this.platforms) {
			this.logger.warn(`[PLATFORM REGISTRY] Platform already registered type=${type}`);

			return false;
		}

		this.platforms[type] = platform;

		this.logger.log(`[PLATFORM REGISTRY] Registered new platform type=${type}`);

		return true;
	}

	get(device: DeviceEntity): IDevicePlatform | null {
		const platform = this.platforms[device.type];

		if (!platform) {
			this.logger.warn(`[PLATFORM REGISTRY] No platform found for device type=${device.type}`);

			return null;
		}

		return platform;
	}

	list(): string[] {
		return Object.keys(this.platforms);
	}
}
