import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { INTENT_CLEANUP_INTERVAL } from '../../intents/intents.constants';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';

export interface DevicePlatformCommandBudget {
	readonly device: DeviceEntity;
	readonly commandCount: number;
}

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

	getCommandTtlMs(executions: readonly DevicePlatformCommandBudget[], defaultTtlMs: number): number {
		let completionWindowMs = 0;
		let hasCustomTimeout = false;

		for (const execution of executions) {
			const timeoutMs = this.get(execution.device)?.getCommandTimeoutMs?.(execution.commandCount);

			if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
				completionWindowMs += timeoutMs;
				hasCustomTimeout = true;
			} else {
				completionWindowMs += defaultTtlMs;
			}
		}

		return hasCustomTimeout ? completionWindowMs + defaultTtlMs + INTENT_CLEANUP_INTERVAL : defaultTtlMs;
	}

	usesAuthoritativePropertyReadback(device: DeviceEntity, property: ChannelPropertyEntity): boolean {
		return this.get(device)?.usesAuthoritativePropertyReadback?.(property) ?? false;
	}

	list(): string[] {
		return Object.keys(this.platforms);
	}
}
