/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	ConfigChangeResult,
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import {
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
} from '../devices-zigbee-herdsman.constants';
import { UpdateZigbeeHerdsmanChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ZigbeeHerdsmanChannelPropertyEntity } from '../entities/devices-zigbee-herdsman.entity';
import { ZhDiscoveredDevice } from '../interfaces/zigbee-herdsman.interface';
import { ZigbeeHerdsmanConfigModel } from '../models/config.model';

import { ZhDeviceConnectivityService } from './device-connectivity.service';
import { ZigbeeHerdsmanAdapterService } from './zigbee-herdsman-adapter.service';
import { ZigbeeHerdsmanConfigValidatorService } from './zigbee-herdsman-config-validator.service';

@Injectable()
export class ZigbeeHerdsmanService implements IManagedPluginService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'Service',
	);

	readonly pluginName = DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME;
	readonly serviceId = 'connector';

	private state: ServiceState = 'stopped';
	private startStopLock = false;

	constructor(
		private readonly adapterService: ZigbeeHerdsmanAdapterService,
		private readonly configService: ConfigService,
		private readonly configValidator: ZigbeeHerdsmanConfigValidatorService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly zhConnectivityService: ZhDeviceConnectivityService,
	) {}

	async start(): Promise<void> {
		if (this.startStopLock) {
			this.logger.warn('Start/stop already in progress');
			return;
		}

		this.startStopLock = true;
		this.state = 'starting';

		try {
			const config = this.getConfig();
			if (!config) {
				throw new Error('Plugin configuration not found');
			}

			// Validate config before starting (catches bad serial port, invalid channel, etc.)
			const validation = this.configValidator.validate(config);
			if (!validation.valid) {
				throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
			}

			// Set up event callbacks
			this.adapterService.setCallbacks({
				onDeviceJoined: (event) => {
					this.logger.debug(`Device joined network: ${event.ieeeAddress}`);
				},
				onDeviceInterview: (event) => {
					this.logger.debug(`Device interview ${event.status}: ${event.ieeeAddress}`);

					if (event.status === 'successful') {
						this.logger.debug(`Device interview completed: ${event.ieeeAddress}`);
					}
				},
				onDeviceLeave: async (event) => {
					this.logger.debug(`Device left network: ${event.ieeeAddress}`);
					await this.markDeviceOffline(event.ieeeAddress);
				},
				onMessage: async (event) => {
					await this.processIncomingMessage(event.ieeeAddress, event.cluster, event.data, event.linkquality);
				},
				onAdapterDisconnected: async () => {
					this.logger.warn('Coordinator disconnected');
					this.state = 'error';
					await this.markAllDevicesOffline();
				},
			});

			await this.adapterService.start(config.serial, config.network, config.databasePath);

			// Sync existing device states on startup
			if (config.discovery.syncOnStartup) {
				this.logger.debug('Syncing all device states on startup');
			}

			// Start device connectivity monitoring
			this.zhConnectivityService.startMonitoring();

			this.state = 'started';
			this.logger.debug('Zigbee Herdsman service started');
		} catch (error) {
			const err = error as Error;
			this.state = 'error';
			this.logger.error(`Failed to start service: ${err.message}`, { stack: err.stack });
			throw error;
		} finally {
			this.startStopLock = false;
		}
	}

	async stop(): Promise<void> {
		if (this.startStopLock) {
			this.logger.warn('Start/stop already in progress');
			return;
		}

		this.startStopLock = true;
		this.state = 'stopping';

		try {
			this.zhConnectivityService.stopMonitoring();
			await this.adapterService.stop();
			this.state = 'stopped';
			this.logger.debug('Zigbee Herdsman service stopped');
		} catch (error) {
			const err = error as Error;
			this.state = 'error';
			this.logger.error(`Failed to stop service: ${err.message}`, { stack: err.stack });
			throw error;
		} finally {
			this.startStopLock = false;
		}
	}

	getState(): ServiceState {
		return this.state;
	}

	onConfigChanged(): Promise<ConfigChangeResult> {
		return Promise.resolve({ restartRequired: true });
	}

	isCoordinatorOnline(): boolean {
		return this.adapterService.isStarted();
	}

	isPermitJoinEnabled(): boolean {
		return this.adapterService.isPermitJoinEnabled();
	}

	getDiscoveredDevices(): ZhDiscoveredDevice[] {
		return this.adapterService.getDiscoveredDevices();
	}

	getDiscoveredDevice(ieeeAddress: string): ZhDiscoveredDevice | undefined {
		return this.adapterService.getDiscoveredDevice(ieeeAddress);
	}

	async permitJoin(enabled: boolean, timeout?: number): Promise<void> {
		await this.adapterService.permitJoin(enabled, timeout);
	}

	async removeDevice(ieeeAddress: string): Promise<void> {
		await this.adapterService.removeDevice(ieeeAddress);
	}

	async getCoordinatorInfo() {
		return this.adapterService.getCoordinatorInfo();
	}

	// =========================================================================
	// Private helpers
	// =========================================================================

	private getConfig(): ZigbeeHerdsmanConfigModel | null {
		try {
			return this.configService.getPluginConfig<ZigbeeHerdsmanConfigModel>(DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME);
		} catch {
			return null;
		}
	}

	private async processIncomingMessage(
		ieeeAddress: string,
		cluster: string,
		data: Record<string, unknown>,
		linkquality?: number,
	): Promise<void> {
		try {
			// Find adopted device by IEEE address
			const devices = await this.devicesService.findAll(DEVICES_ZIGBEE_HERDSMAN_TYPE);
			const device = devices.find((d) => (d as any).ieeeAddress === ieeeAddress);

			if (!device) {
				return; // Device not adopted yet
			}

			const discovered = this.adapterService.getDiscoveredDevice(ieeeAddress);
			if (!discovered?.definition) {
				return;
			}

			// Run fromZigbee converters to translate raw ZCL data into a state object
			// (e.g. { temperature: 22.5, humidity: 65.3 })
			let convertedState: Record<string, unknown> = {};

			const herdsmanDevice = this.adapterService.getHerdsmanDevice(ieeeAddress);

			// Build the message object that fromZigbee converters expect:
			// convert(model, msg, publish, options, meta)
			const msg = {
				data,
				cluster,
				type: 'attributeReport',
				device: herdsmanDevice,
				endpoint: herdsmanDevice?.getEndpoint?.(1) ?? null,
				linkquality: linkquality ?? 0,
			};

			const publish = () => {};

			for (const converter of discovered.definition.fromZigbee as any[]) {
				try {
					if (!converter.cluster || (converter.cluster !== cluster && converter.cluster !== '*')) {
						continue;
					}
					if (typeof converter.convert !== 'function') {
						continue;
					}

					const meta = {
						state: convertedState,
						logger: this.logger,
						device: herdsmanDevice,
						options: {},
					};

					// fromZigbee converters may be sync or async
					const result = await converter.convert(discovered.definition, msg, publish, {}, meta);

					if (result && typeof result === 'object' && !(result instanceof Promise)) {
						convertedState = { ...convertedState, ...(result as Record<string, unknown>) };
					}
				} catch {
					// Individual converter failure is not critical
				}
			}

			// Add linkquality to the state if present
			if (linkquality !== undefined) {
				convertedState['linkquality'] = linkquality;
			}

			if (Object.keys(convertedState).length === 0) {
				return;
			}

			// Write converted values to matching channel properties.
			// Property identifiers are set to zigbee expose names during adoption.
			// Use channelsPropertiesService.update() (exported from DevicesModule)
			// to persist values — this also triggers WebSocket events.
			const deviceChannelIds = device.channels?.map((c) => c.id) ?? [];
			if (deviceChannelIds.length === 0) {
				return;
			}

			const deviceProperties = await this.channelsPropertiesService.findAll<ZigbeeHerdsmanChannelPropertyEntity>(
				deviceChannelIds,
				DEVICES_ZIGBEE_HERDSMAN_TYPE,
			);

			for (const property of deviceProperties) {
				const stateKey = property.identifier;
				if (!stateKey || !(stateKey in convertedState)) {
					continue;
				}

				const value = convertedState[stateKey];
				if (value === undefined || value === null) {
					continue;
				}

				try {
					const writeValue = typeof value === 'object' ? JSON.stringify(value) : value;
					await this.channelsPropertiesService.update<
						ZigbeeHerdsmanChannelPropertyEntity,
						UpdateZigbeeHerdsmanChannelPropertyDto
					>(
						property.id,
						toInstance(UpdateZigbeeHerdsmanChannelPropertyDto, {
							type: DEVICES_ZIGBEE_HERDSMAN_TYPE,
							value: writeValue,
						}),
					);
				} catch {
					// Non-critical — individual property write failures
				}
			}
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Error processing message from ${ieeeAddress}: ${err.message}`);
		}
	}

	private async markDeviceOffline(ieeeAddress: string): Promise<void> {
		try {
			const devices = await this.devicesService.findAll(DEVICES_ZIGBEE_HERDSMAN_TYPE);
			const device = devices.find((d) => (d as any).ieeeAddress === ieeeAddress);

			if (device) {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.DISCONNECTED,
				});
			}
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to mark device ${ieeeAddress} offline: ${err.message}`);
		}
	}

	private async markAllDevicesOffline(): Promise<void> {
		try {
			const devices = await this.devicesService.findAll(DEVICES_ZIGBEE_HERDSMAN_TYPE);
			for (const device of devices) {
				await this.deviceConnectivityService.setConnectionState(device.id, {
					state: ConnectionState.UNKNOWN,
				});
			}
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to mark all devices offline: ${err.message}`);
		}
	}
}
