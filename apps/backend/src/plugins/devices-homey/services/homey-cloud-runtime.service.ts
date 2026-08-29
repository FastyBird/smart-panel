import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import {
	DEVICES_HOMEY_PLUGIN_NAME,
	HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS,
	HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_MAX_MS,
	HomeyConnectionMode,
} from '../devices-homey.constants';
import { HomeyConnectorErrorCategory } from '../errors/homey-connector.error';
import { HomeyConfigModel } from '../models/config.model';

import {
	HomeyCloudRuntimeRegistryService,
	HomeyCloudRuntimeTeardownGuard,
} from './homey-cloud-runtime-registry.service';
import { HomeyService } from './homey.service';

@Injectable()
export class HomeyCloudRuntimeService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(HomeyCloudRuntimeService.name);
	private lifecycleTail: Promise<void> = Promise.resolve();
	private activationRetryTimer: NodeJS.Timeout | null = null;
	private activationRetryAttempt = 0;
	private activationGeneration = 0;

	constructor(
		private readonly configService: ConfigService,
		private readonly homeyService: HomeyService,
		private readonly runtimeRegistry: HomeyCloudRuntimeRegistryService,
	) {}

	onModuleInit(): void {
		this.runtimeRegistry.register((shouldDisconnect) => this.disconnectGrant(shouldDisconnect));
	}

	onModuleDestroy(): void {
		this.activationGeneration += 1;
		this.clearActivationRetry();
	}

	activateGrant(shouldActivate: HomeyCloudRuntimeTeardownGuard = () => Promise.resolve(true)): void {
		const generation = ++this.activationGeneration;
		this.clearActivationRetry();
		this.activateGrantWithRetry(generation, shouldActivate);
	}

	private activateGrantWithRetry(generation: number, shouldActivate: HomeyCloudRuntimeTeardownGuard): void {
		let failurePhase: 'guard' | 'start' | 'stop' = 'guard';

		void this.enqueue(async () => {
			if (generation !== this.activationGeneration || !(await shouldActivate())) return;

			const config = this.getCloudConfig();

			if (config === null || !config.enabled) return;

			failurePhase = 'stop';
			if (this.homeyService.getState() !== 'stopped') await this.homeyService.stop();
			failurePhase = 'start';
			await this.homeyService.start();
		})
			.then(() => {
				if (generation === this.activationGeneration) this.clearActivationRetry();
			})
			.catch(() => {
				if (generation !== this.activationGeneration) return;
				if (failurePhase === 'start' && !this.isRetryableStartupFailure()) {
					this.clearActivationRetry();
					this.logger.warn('Homey Cloud grant activated but runtime restart requires operator action');
					return;
				}
				this.scheduleActivationRetry(generation, shouldActivate);
				this.logger.warn('Homey Cloud grant activated but runtime restart did not complete; retry scheduled');
			});
	}

	private isRetryableStartupFailure(): boolean {
		const category = this.homeyService.getStatus().lastErrorCategory;

		return category === HomeyConnectorErrorCategory.TIMEOUT || category === HomeyConnectorErrorCategory.UNAVAILABLE;
	}

	disconnectGrant(shouldDisconnect: HomeyCloudRuntimeTeardownGuard = () => Promise.resolve(true)): Promise<void> {
		const activationGeneration = this.activationGeneration;

		return this.enqueue(async () => {
			if (!(await shouldDisconnect())) return;
			if (activationGeneration === this.activationGeneration) {
				this.activationGeneration += 1;
				this.clearActivationRetry();
			}
			if (this.getCloudConfig() === null || this.homeyService.getState() === 'stopped') return;

			await this.homeyService.stop();
		});
	}

	private scheduleActivationRetry(generation: number, shouldActivate: HomeyCloudRuntimeTeardownGuard): void {
		if (this.activationRetryTimer !== null) return;

		const delay = Math.min(
			HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_INITIAL_MS * 2 ** this.activationRetryAttempt,
			HOMEY_CLOUD_RUNTIME_ACTIVATION_RETRY_MAX_MS,
		);
		this.activationRetryAttempt += 1;
		this.activationRetryTimer = setTimeout(() => {
			this.activationRetryTimer = null;
			this.activateGrantWithRetry(generation, shouldActivate);
		}, delay);
		this.activationRetryTimer.unref();
	}

	private clearActivationRetry(): void {
		if (this.activationRetryTimer !== null) clearTimeout(this.activationRetryTimer);
		this.activationRetryTimer = null;
		this.activationRetryAttempt = 0;
	}

	private getCloudConfig(): HomeyConfigModel | null {
		try {
			const config = this.configService.getPluginConfig<HomeyConfigModel>(DEVICES_HOMEY_PLUGIN_NAME);

			return config.mode === HomeyConnectionMode.CLOUD ? config : null;
		} catch {
			return null;
		}
	}

	private enqueue(operation: () => Promise<void>): Promise<void> {
		const result: Promise<void> = this.lifecycleTail.then(async (): Promise<void> => await operation());
		this.lifecycleTail = result.catch((): void => undefined);

		return result;
	}
}
