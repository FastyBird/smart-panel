import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';

@Injectable()
export class PlatformRegistryService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PlatformRegistryService');

	private readonly platforms: Record<string, IDevicePlatform> = {};

	register(platform: IDevicePlatform): boolean {
		const type = platform.getType();

		if (type in this.platforms) {
			this.logger.warn(`Platform already registered type=${type}`);

			return false;
		}

		this.platforms[type] = platform;

		this.logger.log(`Registered new platform type=${type}`);

		return true;
	}

	get(device: DeviceEntity): IDevicePlatform | null {
		const platform = this.platforms[device.type];

		if (!platform) {
			this.logger.warn(`No platform found for device type=${device.type}`);

			return null;
		}

		return platform;
	}

	list(): string[] {
		return Object.keys(this.platforms);
	}
}
