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

/** Internal read-only continuity evidence; conveys neither disposal nor command authority. */
export interface CapturedDevicePlatformRegistration {
	readonly platform: IDevicePlatform;
	isCurrent(): boolean;
}

/** Returned only to the successful registration owner, never by lookup/capture. */
export interface OwnedDevicePlatformRegistration {
	dispose(): void;
}

interface DevicePlatformRegistration {
	readonly type: string;
	readonly platform: IDevicePlatform;
}

@Injectable()
export class PlatformRegistryService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PlatformRegistryService');

	private readonly platforms: Record<string, IDevicePlatform> = {};
	private readonly registrations = new Map<string, DevicePlatformRegistration>();
	private destroyed = false;

	register(platform: IDevicePlatform): boolean {
		return this.addRegistration(platform) !== null;
	}

	registerOwned(platform: IDevicePlatform): OwnedDevicePlatformRegistration | null {
		const registration = this.addRegistration(platform);
		if (!registration) return null;
		return Object.freeze({
			dispose: () => {
				// The original owner alone can retire this exact incarnation. A stale disposer
				// cannot remove a replacement, including re-registration of the very same object.
				if (this.registrations.get(registration.type) !== registration) return;
				this.registrations.delete(registration.type);
				delete this.platforms[registration.type];
			},
		});
	}

	captureRegistration(device: Pick<DeviceEntity, 'type'>): CapturedDevicePlatformRegistration | null {
		const registration = this.registrations.get(device.type);
		if (this.destroyed || !registration) return null;
		return Object.freeze({
			platform: registration.platform,
			isCurrent: () => !this.destroyed && this.registrations.get(registration.type) === registration,
		});
	}

	onModuleDestroy(): void {
		// Terminal synchronous invalidation. Neither lookup nor later registration can revive
		// a capture belonging to this registry instance after its teardown has begun.
		this.destroyed = true;
		this.registrations.clear();
		for (const type of Object.keys(this.platforms)) delete this.platforms[type];
	}

	private addRegistration(platform: IDevicePlatform): DevicePlatformRegistration | null {
		if (this.destroyed) return null;
		const type = platform.getType();

		if (type in this.platforms) {
			this.logger.warn(`Platform already registered type=${type}`);

			return null;
		}

		const registration = Object.freeze({ type, platform });
		this.platforms[type] = platform;
		this.registrations.set(type, registration);

		this.logger.log(`Registered new platform type=${type}`);

		return registration;
	}

	get(device: Pick<DeviceEntity, 'type'>): IDevicePlatform | null {
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
