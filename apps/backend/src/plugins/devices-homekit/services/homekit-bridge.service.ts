import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

import {
	Accessory,
	Bridge,
	Categories,
	Characteristic,
	HAPStorage,
	MDNSAdvertiser,
	Service,
	uuid,
} from '@homebridge/hap-nodejs';
import { Injectable, Logger, Optional } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ConfigChangeResult,
	IManagedExtensionService,
	ManagedServiceOwner,
	ServiceState,
} from '../../../modules/extensions/services/managed-extension-service.interface';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import {
	DEFAULT_HOMEKIT_BRIDGE_NAME,
	DEFAULT_HOMEKIT_PORT,
	DEVICES_HOMEKIT_PLUGIN_NAME,
	HOMEKIT_PAIRING_STORAGE_DIR,
	generateRandomHomeKitPin,
	generateRandomMacAddress,
	generateRandomSetupId,
} from '../devices-homekit.constants';
import { HomeKitUpdatePluginConfigDto } from '../dto/update-config.dto';
import { HomeKitBridgeStatusModel } from '../models/bridge-status.model';
import { HomeKitConfigModel } from '../models/config.model';

import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService, StagedAccessory } from './homekit-mapper-registry.service';

@Injectable()
export class HomeKitBridgeService implements IManagedExtensionService {
	private readonly logger = new Logger(HomeKitBridgeService.name);

	readonly owner: ManagedServiceOwner = {
		kind: 'plugin',
		type: DEVICES_HOMEKIT_PLUGIN_NAME,
	};
	readonly serviceId = 'homekit-gateway';

	private state: ServiceState = 'stopped';
	private bridge: Bridge | null = null;
	private activeConfig: HomeKitConfigModel | null = null;
	private storageInitialized = false;
	private lifecycleQueue: Promise<unknown> = Promise.resolve();

	constructor(
		private readonly configService: ConfigService,
		private readonly devicesService: DevicesService,
		private readonly mapperRegistry: HomeKitMapperRegistryService,
		private readonly commandDispatcher: HomeKitCommandDispatcher,
		@Optional() private readonly managedServiceManager?: ManagedServiceManagerService,
	) {}

	private enqueueLifecycleOperation<T>(operation: () => Promise<T>): Promise<T> {
		const next = this.lifecycleQueue.then(operation, operation);
		this.lifecycleQueue = next;
		return next;
	}

	getConfig(): HomeKitConfigModel {
		const config = this.configService.getPluginConfig<HomeKitConfigModel>(DEVICES_HOMEKIT_PLUGIN_NAME);
		if (!config) {
			const fallback = new HomeKitConfigModel();
			fallback.type = DEVICES_HOMEKIT_PLUGIN_NAME;
			fallback.enabled = false;
			fallback.bridgeName = DEFAULT_HOMEKIT_BRIDGE_NAME;
			fallback.port = DEFAULT_HOMEKIT_PORT;
			fallback.pincode = generateRandomHomeKitPin();
			fallback.username = generateRandomMacAddress();
			fallback.setupId = generateRandomSetupId();
			fallback.mappedDeviceIds = [];

			try {
				this.configService.setPluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, fallback);
			} catch (err) {
				this.logger.warn(`Could not persist initial HomeKit configuration: ${(err as Error).message}`);
			}

			return fallback;
		}
		return config;
	}

	getState(): ServiceState {
		return this.state;
	}

	private getStoragePath(): string {
		const baseDir = process.env.FB_CONFIG_PATH || path.resolve(process.cwd(), 'var/data');
		const storageDir = path.join(baseDir, HOMEKIT_PAIRING_STORAGE_DIR);
		if (!fs.existsSync(storageDir)) {
			fs.mkdirSync(storageDir, { recursive: true });
		}
		return storageDir;
	}

	private initHapStorage(): void {
		if (this.storageInitialized) {
			return;
		}
		const storagePath = this.getStoragePath();
		this.logger.log(`Initializing HomeKit pairing storage at: ${storagePath}`);
		HAPStorage.setCustomStoragePath(storagePath);
		this.storageInitialized = true;
	}

	async start(): Promise<void> {
		return this.enqueueLifecycleOperation(() => this.startUnlocked());
	}

	async stop(): Promise<void> {
		return this.enqueueLifecycleOperation(() => this.stopUnlocked());
	}

	async reconcileLatestMapping(): Promise<void> {
		return this.enqueueLifecycleOperation(() => this.reconcileLatestMappingUnlocked());
	}

	async onConfigChanged(): Promise<ConfigChangeResult | void> {
		return this.enqueueLifecycleOperation(async () => {
			const newConfig = this.getConfig();

			if (!this.activeConfig || this.state !== 'started') {
				return { restartRequired: false };
			}

			const coreChanged =
				this.activeConfig.bridgeName !== newConfig.bridgeName ||
				this.activeConfig.port !== newConfig.port ||
				this.activeConfig.pincode !== newConfig.pincode ||
				this.activeConfig.username !== newConfig.username ||
				this.activeConfig.setupId !== newConfig.setupId ||
				this.activeConfig.enabled !== newConfig.enabled;

			if (coreChanged) {
				return { restartRequired: true };
			}

			// Core settings unchanged: reconcile device mappings dynamically without restarting
			await this.reconcileLatestMappingUnlocked();
			return { restartRequired: false };
		});
	}

	private async startUnlocked(): Promise<void> {
		const config = this.getConfig();

		if (!config.enabled) {
			this.logger.log('HomeKit Gateway is disabled in plugin configuration.');
			this.state = 'stopped';
			return;
		}

		// Idempotent startup guard
		if (this.bridge !== null && this.state === 'started') {
			this.logger.debug('HomeKit Gateway is already running with current configuration.');
			return;
		}

		this.state = 'starting';
		this.logger.log(`Starting HomeKit Gateway bridge '${config.bridgeName}' on port ${config.port}...`);

		try {
			if (this.bridge) {
				await this.stopUnlocked();
				if (this.bridge) {
					throw new Error('Could not stop the previous HomeKit Gateway bridge.');
				}
			}

			this.initHapStorage();

			const bridgeUuid = uuid.generate(`fastybird.smart-panel.homekit.bridge.${config.username}`);
			this.bridge = new Bridge(config.bridgeName, bridgeUuid);

			const infoService =
				this.bridge.getService(Service.AccessoryInformation) ?? this.bridge.addService(Service.AccessoryInformation);

			infoService
				.setCharacteristic(Characteristic.Name, config.bridgeName)
				.setCharacteristic(Characteristic.Manufacturer, 'FastyBird')
				.setCharacteristic(Characteristic.Model, 'Smart Panel HomeKit Gateway')
				.setCharacteristic(Characteristic.SerialNumber, config.username)
				.setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');

			// Populate bridged accessories from mapped devices
			await this.populateBridgedAccessories(config.mappedDeviceIds);

			// Publish bridge over local network with mDNS
			await this.bridge.publish({
				username: config.username,
				pincode: config.pincode,
				port: config.port,
				category: Categories.BRIDGE,
				setupID: config.setupId,
				advertiser: MDNSAdvertiser.CIAO,
			});

			this.activeConfig = {
				...config,
				mappedDeviceIds: [...config.mappedDeviceIds],
			};
			this.state = 'started';
			this.logger.log(`HomeKit Gateway published successfully. Port: ${config.port}, Username: ${config.username}`);
		} catch (error) {
			this.state = 'error';
			const err = error as Error;
			this.logger.error(`Failed to start HomeKit Gateway: ${err.message}`, err.stack);
			throw error;
		}
	}

	private async stopUnlocked(): Promise<void> {
		this.state = 'stopping';
		this.logger.log('Stopping HomeKit Gateway...');

		try {
			if (this.bridge) {
				await this.bridge.unpublish();
				// Do NOT call this.bridge.destroy() here to preserve pairing keys!
				this.bridge = null;
			}
			this.mapperRegistry.clearAllBindings();
			this.activeConfig = null;
			this.state = 'stopped';
			this.logger.log('HomeKit Gateway stopped cleanly.');
		} catch (error) {
			this.state = 'error';
			const err = error as Error;
			this.logger.error(`Error stopping HomeKit Gateway: ${err.message}`, err.stack);
		}
	}

	private async reconcileLatestMappingUnlocked(): Promise<void> {
		if (!this.bridge || this.state !== 'started') {
			return;
		}

		const config = this.getConfig();
		const targetDeviceIds = config.mappedDeviceIds ?? [];
		const targetSet = new Set(targetDeviceIds);

		const currentBridgedMap = new Map<string, Accessory>();
		for (const acc of this.bridge.bridgedAccessories) {
			const serial = acc
				.getService(Service.AccessoryInformation)
				?.getCharacteristic(Characteristic.SerialNumber)?.value;
			const serialStr = typeof serial === 'string' ? serial : '';
			if (serialStr) {
				currentBridgedMap.set(serialStr, acc);
			}
		}

		const currentDeviceIds = new Set(currentBridgedMap.keys());
		const toAddIds = targetDeviceIds.filter((id) => !currentDeviceIds.has(id));
		const toRemoveSerials = Array.from(currentDeviceIds).filter((id) => !targetSet.has(id));

		if (toAddIds.length === 0 && toRemoveSerials.length === 0) {
			return;
		}

		this.logger.log(
			`Reconciling HomeKit bridged accessories: adding ${toAddIds.length}, removing ${toRemoveSerials.length}...`,
		);

		// 1. Pre-build accessories to stage additions. Any failure must abort before mutating bridge.
		const stagedAccessories: StagedAccessory[] = [];
		for (const deviceId of toAddIds) {
			const device = await this.devicesService.findOne(deviceId);
			if (!device) {
				const msg = `Device ${deviceId} not found in database during reconciliation.`;
				this.logger.error(msg);
				throw new Error(msg);
			}
			let staged: StagedAccessory | null;
			try {
				staged = this.mapperRegistry.buildAccessory(device, this.commandDispatcher);
			} catch (err) {
				const msg = `Failed to build accessory for device ${deviceId}: ${(err as Error).message}`;
				this.logger.error(msg);
				throw new Error(msg, { cause: err });
			}
			if (!staged) {
				const msg = `Device ${deviceId} could not be mapped to any supported HomeKit accessory.`;
				this.logger.error(msg);
				throw new Error(msg);
			}
			stagedAccessories.push(staged);
		}

		// 2. Snapshot state for transactional rollback
		const snapshot = this.mapperRegistry.getSnapshot();
		const originalAccessories = [...this.bridge.bridgedAccessories];
		const originalAccessoriesMap = new Map(originalAccessories.map((a) => [a.UUID, a]));

		try {
			// 3. Remove accessories no longer mapped
			for (const serial of toRemoveSerials) {
				const acc = currentBridgedMap.get(serial);
				if (acc) {
					this.bridge.removeBridgedAccessory(acc);
					this.mapperRegistry.clearDeviceBindings(serial);
				}
			}

			// 4. Add newly built accessories
			for (const staged of stagedAccessories) {
				this.bridge.addBridgedAccessory(staged.accessory);
			}

			// 5. Commit staged registry data only after bridge mutations succeed
			for (const staged of stagedAccessories) {
				this.mapperRegistry.commitStaged(staged);
			}

			if (this.activeConfig) {
				this.activeConfig.mappedDeviceIds = [...targetDeviceIds];
			}

			this.logger.log(`Successfully reconciled accessories. Active count: ${this.bridge.bridgedAccessories.length}`);
		} catch (mutationError) {
			this.logger.error(`Failed to mutate bridged accessories, rolling back: ${(mutationError as Error).message}`);
			let rollbackSuccess = true;

			try {
				// Remove any accessory currently on the bridge that was not in the original snapshot
				const currentOnBridge = [...this.bridge.bridgedAccessories];
				for (const acc of currentOnBridge) {
					if (!originalAccessoriesMap.has(acc.UUID)) {
						try {
							this.bridge.removeBridgedAccessory(acc);
						} catch (e) {
							rollbackSuccess = false;
							this.logger.warn(`Failed to remove accessory during rollback: ${(e as Error).message}`);
						}
					}
				}

				// Re-add any original accessory missing from the bridge
				const remainingOnBridgeMap = new Map(this.bridge.bridgedAccessories.map((a) => [a.UUID, a]));
				for (const acc of originalAccessories) {
					if (!remainingOnBridgeMap.has(acc.UUID)) {
						try {
							this.bridge.addBridgedAccessory(acc);
						} catch (e) {
							rollbackSuccess = false;
							this.logger.warn(`Failed to restore original accessory during rollback: ${(e as Error).message}`);
						}
					}
				}

				if (this.bridge.bridgedAccessories.length !== originalAccessories.length) {
					rollbackSuccess = false;
				}
			} catch (rollbackError) {
				rollbackSuccess = false;
				this.logger.error(`Critical error during bridge rollback: ${(rollbackError as Error).message}`);
			} finally {
				this.mapperRegistry.restoreSnapshot(snapshot);
			}

			if (!rollbackSuccess) {
				this.state = 'error';
				this.logger.error('HomeKit Gateway entered error state because bridge rollback could not be fully completed.');
			}

			throw mutationError;
		}
	}

	private async populateBridgedAccessories(mappedDeviceIds: string[]): Promise<void> {
		if (!this.bridge) {
			return;
		}

		let addedCount = 0;
		for (const deviceId of mappedDeviceIds) {
			try {
				const device = await this.devicesService.findOne(deviceId);
				if (!device) {
					this.logger.warn(`Mapped device ID not found in database: ${deviceId}`);
					continue;
				}

				const staged = this.mapperRegistry.buildAccessory(device, this.commandDispatcher);
				if (staged) {
					this.bridge.addBridgedAccessory(staged.accessory);
					this.mapperRegistry.commitStaged(staged);
					addedCount++;
				}
			} catch (error) {
				const err = error as Error;
				this.logger.warn(`Failed to bridge device ${deviceId}: ${err.message}`);
			}
		}

		this.logger.log(`Bridged ${addedCount} accessories into HomeKit Bridge.`);
	}

	async getStatus(): Promise<HomeKitBridgeStatusModel> {
		const config = this.getConfig();
		const isRunning = this.state === 'started' && this.bridge !== null;

		let isPaired = false;
		let pairedClientsCount = 0;
		let setupUri = '';
		let qrCodeDataUri = '';

		if (isRunning && this.bridge) {
			try {
				setupUri = this.bridge.setupURI();
				if (setupUri) {
					qrCodeDataUri = await QRCode.toDataURL(setupUri, {
						margin: 1,
						width: 256,
						errorCorrectionLevel: 'M',
					});
				}

				const server = (
					this.bridge as unknown as {
						_server?: {
							accessoryInfo?: {
								paired: () => boolean;
								listPairings: () => unknown[];
							};
						};
					}
				)._server;
				if (server?.accessoryInfo) {
					isPaired = Boolean(server.accessoryInfo.paired());
					const pairings = server.accessoryInfo.listPairings();
					pairedClientsCount = Array.isArray(pairings) ? pairings.length : 0;
				}
			} catch (err) {
				this.logger.warn(`Could not extract pairing metadata: ${(err as Error).message}`);
			}
		}

		const status = new HomeKitBridgeStatusModel();
		status.running = isRunning;
		status.paired = isPaired;
		status.pairedClientsCount = pairedClientsCount;
		status.bridgeName = config.bridgeName;
		status.port = config.port;
		status.pincode = config.pincode;
		status.username = config.username;
		status.setupUri = setupUri;
		status.qrCodeDataUri = qrCodeDataUri;
		status.exposedDevicesCount = this.bridge?.bridgedAccessories.length ?? config.mappedDeviceIds.length;

		return status;
	}

	async resetPairing(): Promise<void> {
		// Phase 1: Queued destructive teardown
		await this.enqueueLifecycleOperation(async () => {
			this.logger.log('Resetting HomeKit pairing credentials (Phase 1: destructive teardown)...');
			const bridge = this.bridge;
			await this.stopUnlocked();
			if (bridge) {
				await bridge.destroy();
			}

			const storagePath = this.getStoragePath();
			try {
				if (fs.existsSync(storagePath)) {
					const files = fs.readdirSync(storagePath);
					for (const file of files) {
						const fullPath = path.join(storagePath, file);
						fs.rmSync(fullPath, { recursive: true, force: true });
					}
					this.logger.log(`Cleared pairing storage files in: ${storagePath}`);
				}
			} catch (error) {
				this.logger.warn(`Failed to delete pairing storage files: ${(error as Error).message}`);
			}

			this.mapperRegistry.clearAllBindings();
		});

		// Phase 2: Outside queue - rotate credentials without mapped_device_ids
		this.logger.log('Resetting HomeKit pairing credentials (Phase 2: rotating credentials)...');
		const pincode = generateRandomHomeKitPin();
		const username = generateRandomMacAddress();
		const setup_id = generateRandomSetupId();

		const updateDto = toInstance(HomeKitUpdatePluginConfigDto, {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			pincode,
			username,
			setup_id,
		});

		await this.configService.updatePluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, updateDto);

		// Phase 3: Queued restart
		await this.enqueueLifecycleOperation(async () => {
			this.logger.log('Resetting HomeKit pairing credentials (Phase 3: starting bridge)...');
			await this.startUnlocked();
		});
	}

	async updateMappedDevices(deviceIds: string[]): Promise<void> {
		const updateDto = toInstance(HomeKitUpdatePluginConfigDto, {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			mapped_device_ids: deviceIds,
		});
		await this.configService.updatePluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, updateDto);
		await this.reconcileLatestMapping();
	}
}
