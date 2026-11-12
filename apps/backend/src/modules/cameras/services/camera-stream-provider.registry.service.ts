import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { CAMERAS_MODULE_NAME } from '../cameras.constants';
import { ICameraStreamProvider } from '../platforms/camera-stream.provider';

@Injectable()
export class CameraStreamProviderRegistryService implements OnModuleDestroy {
	private readonly logger = createExtensionLogger(CAMERAS_MODULE_NAME, 'CameraStreamProviderRegistryService');

	private readonly providers: Record<string, { provider: ICameraStreamProvider }> = {};
	private destroyed = false;

	/** Returns null when the registry is closed or the type is already taken; the first registration is kept. */
	register(provider: ICameraStreamProvider): Readonly<{ dispose: () => void }> | null {
		if (this.destroyed) return null;

		const type = provider.getType();

		if (type in this.providers) {
			this.logger.warn(`Camera stream provider already registered type=${type}`);

			return null;
		}

		const record = { provider };

		this.providers[type] = record;

		this.logger.log(`Registered camera stream provider type=${type}`);

		return Object.freeze({
			dispose: () => {
				if (this.providers[type] === record) delete this.providers[type];
			},
		});
	}

	get(device: Pick<DeviceEntity, 'type'>): ICameraStreamProvider | null {
		return this.providers[device.type]?.provider ?? null;
	}

	has(device: Pick<DeviceEntity, 'type'>): boolean {
		return this.get(device) !== null;
	}

	list(): string[] {
		return Object.keys(this.providers);
	}

	onModuleDestroy(): void {
		this.destroyed = true;

		for (const type of Object.keys(this.providers)) {
			delete this.providers[type];
		}
	}
}
