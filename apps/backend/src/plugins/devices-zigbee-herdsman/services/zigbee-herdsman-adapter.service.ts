/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { randomBytes, randomInt } from 'crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME } from '../devices-zigbee-herdsman.constants';
import {
	ZhAdapterCallbacks,
	ZhDeviceAnnounceEvent,
	ZhDeviceInterviewEvent,
	ZhDeviceJoinedEvent,
	ZhDeviceLeaveEvent,
	ZhDiscoveredDevice,
	ZhMessageEvent,
} from '../interfaces/zigbee-herdsman.interface';
import { ZhNetworkConfigModel, ZhSerialConfigModel } from '../models/config.model';

/**
 * Wraps the zigbee-herdsman Controller with typed events and lifecycle management.
 * Handles direct serial communication with Zigbee coordinators.
 */
@Injectable()
export class ZigbeeHerdsmanAdapterService implements OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'AdapterService',
	);

	private controller: any = null;
	private callbacks: ZhAdapterCallbacks = {};
	private started = false;
	private permitJoinEnabled = false;
	private permitJoinTimeout: ReturnType<typeof setTimeout> | null = null;
	private configuredChannel = 0;
	private configuredPanId = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private discoveredDevices: Map<string, ZhDiscoveredDevice> = new Map();

	setCallbacks(callbacks: ZhAdapterCallbacks): void {
		this.callbacks = callbacks;
	}

	isStarted(): boolean {
		return this.started;
	}

	isPermitJoinEnabled(): boolean {
		return this.permitJoinEnabled;
	}

	getDiscoveredDevices(): ZhDiscoveredDevice[] {
		return Array.from(this.discoveredDevices.values());
	}

	getDiscoveredDevice(ieeeAddress: string): ZhDiscoveredDevice | undefined {
		return this.discoveredDevices.get(ieeeAddress);
	}

	/**
	 * Returns the raw zigbee-herdsman Device object for direct ZCL operations.
	 */
	getHerdsmanDevice(ieeeAddress: string): any {
		if (!this.controller || !this.started) {
			return null;
		}
		return this.controller.getDeviceByIeeeAddr(ieeeAddress) ?? null;
	}

	async start(
		serialConfig: ZhSerialConfigModel,
		networkConfig: ZhNetworkConfigModel,
		databasePath: string,
	): Promise<void> {
		if (this.started) {
			this.logger.warn('Adapter already started, stopping first');
			await this.stop();
		}

		this.logger.debug(`Starting zigbee-herdsman adapter on ${serialConfig.path}`);

		try {
			// Dynamic import for zigbee-herdsman
			const { Controller } = await import('zigbee-herdsman');

			// zigbee-herdsman persists network params in its database file.
			// On first start with no DB, it generates them from the values below.
			// On subsequent starts, it reads from the DB and ignores these.
			// We provide sensible defaults for first-time network formation.
			const networkKey = networkConfig.networkKey ?? this.generateNetworkKey();
			const panId = networkConfig.panId ?? this.generatePanId();
			const extendedPanId = networkConfig.extendedPanId ?? this.generateExtendedPanId();

			// Store configured values for getCoordinatorInfo fallback
			this.configuredChannel = networkConfig.channel;
			this.configuredPanId = panId;

			this.controller = new Controller({
				network: {
					panID: panId,
					extendedPanID: extendedPanId,
					channelList: [networkConfig.channel],
					networkKey,
				},
				serialPort: {
					path: serialConfig.path,
					baudRate: serialConfig.baudRate,
					rtscts: false,
					adapter: serialConfig.adapterType === 'auto' ? undefined : serialConfig.adapterType,
				},
				databasePath,
				backupPath: databasePath.replace('.db', '-backup.db'),
				adapter: {
					concurrent: 16,
					delay: 0,
					disableLED: false,
				},
				acceptJoiningDeviceHandler: () => Promise.resolve(true),
			} as any);

			// Register event listeners
			this.controller.on('deviceJoined', this.onDeviceJoined.bind(this));
			this.controller.on('deviceInterview', this.onDeviceInterview.bind(this));
			this.controller.on('deviceLeave', this.onDeviceLeave.bind(this));
			this.controller.on('deviceAnnounce', this.onDeviceAnnounce.bind(this));
			this.controller.on('message', this.onMessage.bind(this));
			this.controller.on('adapterDisconnected', this.onAdapterDisconnected.bind(this));

			await this.controller.start();
			this.started = true;

			// Load existing devices
			await this.loadExistingDevices();

			this.logger.debug('Zigbee-herdsman adapter started successfully');
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to start zigbee-herdsman adapter: ${err.message}`, { stack: err.stack });
			this.started = false;
			throw error;
		}
	}

	async stop(): Promise<void> {
		if (!this.started || !this.controller) {
			return;
		}

		this.logger.debug('Stopping zigbee-herdsman adapter');

		if (this.permitJoinTimeout) {
			clearTimeout(this.permitJoinTimeout);
			this.permitJoinTimeout = null;
		}
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		try {
			await this.controller.stop();
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Error stopping adapter: ${err.message}`);
		}

		this.controller = null;
		this.started = false;
		this.permitJoinEnabled = false;
		this.logger.debug('Zigbee-herdsman adapter stopped');
	}

	async permitJoin(enabled: boolean, timeout?: number): Promise<void> {
		if (!this.controller || !this.started) {
			throw new Error('Adapter not started');
		}

		if (this.permitJoinTimeout) {
			clearTimeout(this.permitJoinTimeout);
			this.permitJoinTimeout = null;
		}

		if (enabled) {
			const joinTimeout = Math.min(timeout && timeout > 0 ? timeout : 254, 254);
			// Pass timeout to the native zigbee-herdsman permitJoin API —
			// the controller handles the timer internally and auto-disables join.
			await this.controller.permitJoin(true, joinTimeout);
			this.permitJoinEnabled = true;

			// Safety fallback: also set our own timer in case the controller's
			// internal timer doesn't fire (e.g. adapter disconnection).
			this.permitJoinTimeout = setTimeout(
				() => {
					this.permitJoinEnabled = false;
				},
				(joinTimeout + 1) * 1000,
			);

			this.logger.debug(`Permit join enabled for ${joinTimeout} seconds`);
		} else {
			await this.controller.permitJoin(false);
			this.permitJoinEnabled = false;
			this.logger.debug('Permit join disabled');
		}
	}

	async removeDevice(ieeeAddress: string): Promise<void> {
		if (!this.controller || !this.started) {
			throw new Error('Adapter not started');
		}

		const device = this.controller.getDeviceByIeeeAddr(ieeeAddress);
		if (!device) {
			throw new Error(`Device ${ieeeAddress} not found on network`);
		}

		await device.removeFromNetwork();
		this.discoveredDevices.delete(ieeeAddress);
		this.logger.debug(`Device ${ieeeAddress} removed from network`);
	}

	async sendCommand(
		ieeeAddress: string,
		endpointId: number,
		clusterKey: string,
		commandKey: string,
		payload: Record<string, unknown>,
	): Promise<void> {
		if (!this.controller || !this.started) {
			throw new Error('Adapter not started');
		}

		const device = this.controller.getDeviceByIeeeAddr(ieeeAddress);
		if (!device) {
			throw new Error(`Device ${ieeeAddress} not found`);
		}

		const endpoint = device.getEndpoint(endpointId);
		if (!endpoint) {
			throw new Error(`Endpoint ${endpointId} not found on device ${ieeeAddress}`);
		}

		await endpoint.command(clusterKey, commandKey, payload);
	}

	async writeAttribute(
		ieeeAddress: string,
		endpointId: number,
		clusterKey: string,
		attributes: Record<string, unknown>,
	): Promise<void> {
		if (!this.controller || !this.started) {
			throw new Error('Adapter not started');
		}

		const device = this.controller.getDeviceByIeeeAddr(ieeeAddress);
		if (!device) {
			throw new Error(`Device ${ieeeAddress} not found`);
		}

		const endpoint = device.getEndpoint(endpointId);
		if (!endpoint) {
			throw new Error(`Endpoint ${endpointId} not found on device ${ieeeAddress}`);
		}

		await endpoint.write(clusterKey, attributes);
	}

	async getCoordinatorInfo(): Promise<{
		type: string;
		ieeeAddress: string;
		firmwareVersion: string | null;
		channel: number;
		panId: number;
		pairedDeviceCount: number;
	} | null> {
		if (!this.controller || !this.started) {
			return null;
		}

		try {
			const coordinator = this.controller.getDevicesByType('Coordinator')[0];
			const devices = this.controller.getDevices().filter((d: any) => d.type !== 'Coordinator');

			let channel = this.configuredChannel;
			let panId = this.configuredPanId;

			if (typeof this.controller.getNetworkParameters === 'function') {
				try {
					const networkParams = await this.controller.getNetworkParameters();
					if (networkParams?.channel) {
						channel = networkParams.channel;
					}
					if (networkParams?.panID) {
						panId = networkParams.panID;
					}
				} catch {
					// Fall back to configured values
				}
			}

			return {
				type: coordinator?.manufacturerName ?? 'Unknown',
				ieeeAddress: coordinator?.ieeeAddr ?? '',
				firmwareVersion: coordinator?.softwareBuildID ?? null,
				channel,
				panId,
				pairedDeviceCount: devices.length,
			};
		} catch {
			return null;
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.stop();
	}

	// =========================================================================
	// Private methods
	// =========================================================================

	private async loadExistingDevices(): Promise<void> {
		if (!this.controller) {
			return;
		}

		try {
			const devices = this.controller.getDevices();

			for (const device of devices) {
				if (device.type === 'Coordinator') {
					continue;
				}

				await this.registerDiscoveredDevice(device);
			}

			this.logger.debug(`Loaded ${this.discoveredDevices.size} existing devices`);
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to load existing devices: ${err.message}`);
		}
	}

	private async registerDiscoveredDevice(device: any): Promise<void> {
		let definition = null;

		try {
			const converters = await import('zigbee-herdsman-converters');
			const findByDevice = converters.findByDevice ?? converters.default?.findByDevice;

			if (findByDevice) {
				definition = await findByDevice(device);
			}
		} catch {
			this.logger.debug(`Could not resolve device definition for ${device.ieeeAddr}`);
		}

		const discoveredDevice: ZhDiscoveredDevice = {
			ieeeAddress: device.ieeeAddr,
			networkAddress: device.networkAddress,
			friendlyName: definition?.model
				? `${definition.model}_${device.networkAddress.toString(16)}`
				: String(device.ieeeAddr),
			type: device.type,
			manufacturerName: device.manufacturerName ?? null,
			modelId: device.modelID ?? null,
			dateCode: device.dateCode ?? null,
			softwareBuildId: device.softwareBuildID ?? null,
			interviewStatus: device.interviewCompleted ? 'completed' : device.interviewing ? 'in_progress' : 'not_started',
			definition: definition
				? {
						model: definition.model,
						vendor: definition.vendor,
						description: definition.description,
						exposes: definition.exposes ?? [],
						fromZigbee: definition.fromZigbee ?? [],
						toZigbee: definition.toZigbee ?? [],
					}
				: null,
			powerSource: device.powerSource ?? null,
			lastSeen: device.lastSeen ? new Date(device.lastSeen) : null,
			available: true,
		};

		this.discoveredDevices.set(device.ieeeAddr, discoveredDevice);
	}

	private async onDeviceJoined(payload: any): Promise<void> {
		const event: ZhDeviceJoinedEvent = {
			ieeeAddress: payload.device.ieeeAddr,
			networkAddress: payload.device.networkAddress,
		};

		this.logger.debug(`Device joined: ${event.ieeeAddress}`);
		await this.registerDiscoveredDevice(payload.device);
		await this.callbacks.onDeviceJoined?.(event);
	}

	private async onDeviceInterview(payload: any): Promise<void> {
		const event: ZhDeviceInterviewEvent = {
			ieeeAddress: payload.device.ieeeAddr,
			status: payload.status,
		};

		this.logger.debug(`Device interview: ${event.ieeeAddress} status=${event.status}`);

		// Re-register to update definition
		await this.registerDiscoveredDevice(payload.device);

		// Update interview status
		const discovered = this.discoveredDevices.get(event.ieeeAddress);
		if (discovered) {
			discovered.interviewStatus =
				event.status === 'successful' ? 'completed' : event.status === 'failed' ? 'failed' : 'in_progress';
		}

		await this.callbacks.onDeviceInterview?.(event);
	}

	private async onDeviceLeave(payload: any): Promise<void> {
		const event: ZhDeviceLeaveEvent = {
			ieeeAddress: payload.ieeeAddr,
			networkAddress: payload.networkAddress ?? 0,
		};

		this.logger.debug(`Device left: ${event.ieeeAddress}`);
		this.discoveredDevices.delete(event.ieeeAddress);

		await this.callbacks.onDeviceLeave?.(event);
	}

	private async onDeviceAnnounce(payload: any): Promise<void> {
		const event: ZhDeviceAnnounceEvent = {
			ieeeAddress: payload.device.ieeeAddr,
			networkAddress: payload.device.networkAddress,
		};

		this.logger.debug(`Device announce: ${event.ieeeAddress}`);

		const discovered = this.discoveredDevices.get(event.ieeeAddress);
		if (discovered) {
			discovered.available = true;
			discovered.lastSeen = new Date();
		}

		await this.callbacks.onDeviceAnnounce?.(event);
	}

	private async onMessage(payload: any): Promise<void> {
		const event: ZhMessageEvent = {
			ieeeAddress: payload.device.ieeeAddr,
			type: payload.type,
			cluster: payload.cluster,
			data: payload.data ?? {},
			endpoint: payload.endpoint?.ID ?? 1,
			linkquality: payload.linkquality,
			groupId: payload.groupID,
		};

		// Update last seen
		const discovered = this.discoveredDevices.get(event.ieeeAddress);
		if (discovered) {
			discovered.available = true;
			discovered.lastSeen = new Date();
		}

		await this.callbacks.onMessage?.(event);
	}

	private async onAdapterDisconnected(): Promise<void> {
		this.logger.warn('Zigbee adapter disconnected');
		this.started = false;

		// Clean up the controller reference to prevent leaking serial port
		// handles, timers, and event listeners on subsequent start() calls.
		this.controller = null;

		if (this.permitJoinTimeout) {
			clearTimeout(this.permitJoinTimeout);
			this.permitJoinTimeout = null;
		}
		this.permitJoinEnabled = false;

		// Mark all devices as unavailable
		for (const device of this.discoveredDevices.values()) {
			device.available = false;
		}

		await this.callbacks.onAdapterDisconnected?.();
	}

	private generateNetworkKey(): number[] {
		return Array.from(randomBytes(16));
	}

	private generatePanId(): number {
		return randomInt(1, 0xfffe);
	}

	private generateExtendedPanId(): number[] {
		return Array.from(randomBytes(8));
	}
}
