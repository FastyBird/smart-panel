import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

import { Bridge, Categories, Characteristic, HAPStorage, MDNSAdvertiser, Service, uuid } from '@homebridge/hap-nodejs';
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
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

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
	private storageInitialized = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly devicesService: DevicesService,
		private readonly mapperRegistry: HomeKitMapperRegistryService,
		private readonly commandDispatcher: HomeKitCommandDispatcher,
		@Optional() private readonly managedServiceManager?: ManagedServiceManagerService,
	) {}

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
		const config = this.getConfig();

		if (!config.enabled) {
			this.logger.log('HomeKit Gateway is disabled in plugin configuration.');
			this.state = 'stopped';
			return;
		}

		this.state = 'starting';
		this.logger.log(`Starting HomeKit Gateway bridge '${config.bridgeName}' on port ${config.port}...`);

		try {
			if (this.bridge) {
				this.logger.warn('HomeKit Gateway is already running. Stopping the previous bridge first.');
				await this.stop();
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

			this.state = 'started';
			this.logger.log(`HomeKit Gateway published successfully. Port: ${config.port}, Username: ${config.username}`);
		} catch (error) {
			this.state = 'error';
			const err = error as Error;
			this.logger.error(`Failed to start HomeKit Gateway: ${err.message}`, err.stack);
			throw error;
		}
	}

	async stop(): Promise<void> {
		this.state = 'stopping';
		this.logger.log('Stopping HomeKit Gateway...');

		try {
			if (this.bridge) {
				await this.bridge.unpublish();
				await this.bridge.destroy();
				this.bridge = null;
			}
			this.mapperRegistry.clearAllBindings();
			this.state = 'stopped';
			this.logger.log('HomeKit Gateway stopped cleanly.');
		} catch (error) {
			this.state = 'error';
			const err = error as Error;
			this.logger.error(`Error stopping HomeKit Gateway: ${err.message}`, err.stack);
		}
	}

	onConfigChanged(): Promise<ConfigChangeResult | void> {
		return Promise.resolve({ restartRequired: true });
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

				const accessory = this.mapperRegistry.buildAccessory(device, this.commandDispatcher);
				if (accessory) {
					this.bridge.addBridgedAccessory(accessory);
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
		this.logger.log('Resetting HomeKit pairing credentials...');

		const config = this.getConfig();

		// If running, unpublish first
		if (this.bridge) {
			await this.bridge.unpublish();
			await this.bridge.destroy();
			this.bridge = null;
		}
		this.mapperRegistry.clearAllBindings();
		this.state = 'stopped';

		// Remove all stored pairing records from disk
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

		// Generate fresh credentials
		const newConfig = new HomeKitConfigModel();
		newConfig.type = DEVICES_HOMEKIT_PLUGIN_NAME;
		newConfig.enabled = config.enabled;
		newConfig.bridgeName = config.bridgeName;
		newConfig.port = config.port;
		newConfig.pincode = generateRandomHomeKitPin();
		newConfig.username = generateRandomMacAddress();
		newConfig.setupId = generateRandomSetupId();
		newConfig.mappedDeviceIds = config.mappedDeviceIds;

		this.configService.setPluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, newConfig);

		// If plugin was enabled, restart through managed service manager to ensure serialized lifecycle
		if (config.enabled) {
			if (this.managedServiceManager) {
				await this.managedServiceManager.startServiceManually(this.owner.kind, this.owner.type, this.serviceId);
			} else {
				await this.start();
			}
		}
	}

	async updateMappedDevices(deviceIds: string[]): Promise<void> {
		const config = this.getConfig();
		const currentSet = new Set(config.mappedDeviceIds);
		const targetSet = new Set(deviceIds);

		// Save updated mapping in config
		const updateDto = toInstance(HomeKitUpdatePluginConfigDto, {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			mapped_device_ids: deviceIds,
		});
		this.configService.setPluginConfig(DEVICES_HOMEKIT_PLUGIN_NAME, updateDto);

		// If bridge is running, dynamically add/remove bridged accessories
		if (this.bridge && this.state === 'started') {
			// 1. Remove accessories that are no longer mapped
			const toRemove = this.bridge.bridgedAccessories.filter((acc) => {
				const serial = acc
					.getService(Service.AccessoryInformation)
					?.getCharacteristic(Characteristic.SerialNumber)?.value;
				const serialStr = typeof serial === 'string' ? serial : '';
				return serialStr && !targetSet.has(serialStr);
			});

			for (const acc of toRemove) {
				const serial = acc
					.getService(Service.AccessoryInformation)
					?.getCharacteristic(Characteristic.SerialNumber)?.value;
				const serialStr = typeof serial === 'string' ? serial : '';
				if (serialStr) {
					this.mapperRegistry.clearDeviceBindings(serialStr);
				}
				this.bridge.removeBridgedAccessory(acc);
			}

			// 2. Add accessories that are newly mapped
			for (const deviceId of deviceIds) {
				if (!currentSet.has(deviceId)) {
					try {
						const device = await this.devicesService.findOne(deviceId);
						if (device) {
							const acc = this.mapperRegistry.buildAccessory(device, this.commandDispatcher);
							if (acc) {
								this.bridge.addBridgedAccessory(acc);
							}
						}
					} catch (err) {
						this.logger.warn(`Failed to dynamically bridge device ${deviceId}: ${(err as Error).message}`);
					}
				}
			}

			this.logger.log(`Dynamically updated bridged accessories. Total now: ${this.bridge.bridgedAccessories.length}`);
		}
	}
}
