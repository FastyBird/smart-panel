import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { INTENT_CLEANUP_INTERVAL } from '../../intents/intents.constants';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';

export interface DevicePlatformCommandBudget {
	readonly device: Pick<DeviceEntity, 'id' | 'type'>;
	readonly commandCount: number;
}

@Injectable()
export class PlatformRegistryService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PlatformRegistryService');

	private readonly platforms: Record<string, { platform: IDevicePlatform; identity: object; active: boolean }> = {};
	private destroyed = false;

	register(platform: IDevicePlatform): boolean {
		return this.registerOwned(platform) !== null;
	}

	/** Admission creates the lifetime; capture can only observe this original record. */
	registerOwned(platform: IDevicePlatform): Readonly<{ dispose: () => void }> | null {
		if (this.destroyed) return null;
		const type = platform.getType();
		if (type in this.platforms) {
			this.logger.warn(`Platform already registered type=${type}`);
			return null;
		}
		const record = { platform, identity: Object.freeze({}), active: true };
		this.platforms[type] = record;
		try {
			this.logger.log(`Registered new platform type=${type}`);
		} catch (cause: unknown) {
			record.active = false;
			if (this.platforms[type] === record) delete this.platforms[type];
			throw cause;
		}
		return Object.freeze({
			dispose: () => {
				record.active = false;
				if (this.platforms[type] === record) delete this.platforms[type];
			},
		});
	}

	captureRegistration(type: string): Readonly<{ identity: object; isCurrent: () => boolean }> | null {
		const record = this.platforms[type];
		if (this.destroyed || !record?.active) return null;
		return Object.freeze({
			identity: record.identity,
			isCurrent: () => !this.destroyed && record.active && this.platforms[type] === record,
		});
	}

	onModuleDestroy(): void {
		this.destroyed = true;
		for (const type of Object.keys(this.platforms)) {
			this.platforms[type].active = false;
			delete this.platforms[type];
		}
	}

	get(device: Pick<DeviceEntity, 'type'>): IDevicePlatform | null {
		const platform = this.platforms[device.type]?.platform;

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
