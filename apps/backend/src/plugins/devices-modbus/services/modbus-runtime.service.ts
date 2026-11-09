import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ConnectionState, EventType } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	IManagedExtensionService,
	ServiceState,
} from '../../../modules/extensions/services/managed-extension-service.interface';
import {
	DEVICES_MODBUS_PLUGIN_NAME,
	DEVICES_MODBUS_TYPE,
	MODBUS_DEFAULTS,
	ModbusBindingRole,
} from '../devices-modbus.constants';
import { UpdateModbusChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ModbusDeviceEntity } from '../entities/devices-modbus.entity';
import { ModbusEndpointEntity } from '../entities/modbus-endpoint.entity';
import { ModbusPropertyValue } from '../lib/codec';
import { ModbusEndpointUnavailableError } from '../lib/errors';
import { DevicePoller, ModbusDeviceSnapshot, PollerCallbacks } from '../runtime/device-poller';
import { EndpointConnection } from '../runtime/endpoint-connection';

import { ModbusBindingsService } from './modbus-bindings.service';
import { ModbusConnectionsListener, ModbusConnectionsService } from './modbus-connections.service';
import { ModbusEndpointsService } from './modbus-endpoints.service';

/** States in which every read-bound property is already invalid (`null`). */
const INVALIDATING_STATES = new Set<ConnectionState>([
	ConnectionState.LOST,
	ConnectionState.ALERT,
	ConnectionState.DISCONNECTED,
]);

interface LoadedDevice {
	endpointId: string | null;
	readPropertyIds: string[];
	poller: DevicePoller | null;
	/** The device may be commanded over its endpoint connection. */
	commandable: boolean;
}

const isModbusDevice = (device: DeviceEntity | null | undefined): device is ModbusDeviceEntity =>
	device instanceof ModbusDeviceEntity || device?.type === DEVICES_MODBUS_TYPE;

/**
 * Modbus runtime (managed connector service): one `DevicePoller` per loaded device on its endpoint's connection,
 * sample reporting and device connection state.
 *
 * A device entry is replaced (never mutated) on every load, endpoint change and unload; pollers and in-flight reports
 * check by identity that their entry is still the current one, so late results of a replaced or deleted device are
 * discarded. Loads of the same device that overlap are resolved last-wins, so a device never has two pollers.
 */
@Injectable()
export class ModbusRuntimeService implements IManagedExtensionService {
	readonly owner = { kind: 'plugin', type: DEVICES_MODBUS_PLUGIN_NAME } as const;
	readonly serviceId = 'connector';

	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusRuntimeService');

	private state: ServiceState = 'stopped';
	private lifecycle: Promise<void> = Promise.resolve();

	private readonly devices = new Map<string, LoadedDevice>();
	/** Latest load ticket per device; an older load that resolves later is dropped. */
	private readonly loads = new Map<string, number>();
	private loadSequence = 0;
	/** Last connection state stored for each device by this runtime. */
	private readonly lastStates = new Map<string, ConnectionState>();
	private readonly overloadedEndpoints = new Set<string>();

	private readonly connectionsListener: ModbusConnectionsListener = {
		endpointStopping: (endpointId) => this.stopEndpointPollers(endpointId),
		endpointChanged: (endpointId) => this.reloadEndpoint(endpointId),
	};

	constructor(
		private readonly devicesService: DevicesService,
		private readonly bindingsService: ModbusBindingsService,
		private readonly endpointsService: ModbusEndpointsService,
		private readonly connections: ModbusConnectionsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	start(): Promise<void> {
		return this.withLifecycle(async () => {
			if (this.state === 'started') {
				return;
			}

			this.state = 'starting';

			try {
				this.connections.attach(this.connectionsListener);

				await this.connections.reconcile();

				const devices = await this.devicesService.findAll<ModbusDeviceEntity>(DEVICES_MODBUS_TYPE);

				for (const device of devices) {
					await this.loadSafely(device.id, device);
				}

				this.state = 'started';
			} catch (error) {
				const err = error as Error;

				this.logger.error('Failed to start the Modbus runtime', { message: err.message, stack: err.stack });

				await this.shutdown();

				this.state = 'error';

				throw error;
			}
		});
	}

	stop(): Promise<void> {
		return this.withLifecycle(async () => {
			if (this.state === 'stopped') {
				return;
			}

			await this.shutdown();

			this.state = 'stopped';
		});
	}

	getState(): ServiceState {
		return this.state;
	}

	/** (Re)loads a device: any existing poller is replaced. A no-op while the runtime is not running. */
	async loadDevice(deviceId: string): Promise<void> {
		if (!this.isRunning()) {
			return;
		}

		await this.load(deviceId);
	}

	/** Stops polling a device and forgets it; pending loads of it are cancelled. */
	unloadDevice(deviceId: string): Promise<void> {
		this.loads.delete(deviceId);
		this.dropDevice(deviceId);
		this.lastStates.delete(deviceId);

		return Promise.resolve();
	}

	/** Reads the given properties from the device now and reports them. */
	async readBack(deviceId: string, propertyIds: string[]): Promise<void> {
		const poller = this.devices.get(deviceId)?.poller;

		if (!poller) {
			throw new ModbusEndpointUnavailableError(`Modbus device id=${deviceId} is not being polled`);
		}

		await poller.pollNow(propertyIds);
	}

	getConnection(deviceId: string): EndpointConnection | null {
		const entry = this.devices.get(deviceId);

		return entry?.commandable && entry.endpointId ? this.connections.get(entry.endpointId) : null;
	}

	@OnEvent(EventType.DEVICE_CREATED)
	async onDeviceCreated(device: DeviceEntity): Promise<void> {
		if (isModbusDevice(device) && this.isRunning()) {
			await this.loadSafely(device.id);
		}
	}

	@OnEvent(EventType.DEVICE_UPDATED)
	async onDeviceUpdated(device: DeviceEntity): Promise<void> {
		if (isModbusDevice(device) && this.isRunning()) {
			await this.loadSafely(device.id);
		}
	}

	@OnEvent(EventType.DEVICE_DELETED)
	async onDeviceDeleted(device: DeviceEntity): Promise<void> {
		if (isModbusDevice(device)) {
			await this.unloadDevice(device.id);
		}
	}

	private isRunning(): boolean {
		return this.state === 'starting' || this.state === 'started';
	}

	private withLifecycle(task: () => Promise<void>): Promise<void> {
		const run: Promise<void> = this.lifecycle.then(task);

		this.lifecycle = run.catch((): void => undefined);

		return run;
	}

	/** Stops every poller, reports every loaded device `disconnected` (best effort) and stops all connections. */
	private async shutdown(): Promise<void> {
		this.state = 'stopping';

		const entries = [...this.devices];

		this.loads.clear();

		for (const [, entry] of entries) {
			entry.poller?.stop();
		}

		for (const [deviceId, entry] of entries) {
			await this.applyState(deviceId, entry, ConnectionState.DISCONNECTED, 'Modbus runtime stopped', () => true);
		}

		this.devices.clear();
		this.lastStates.clear();
		this.overloadedEndpoints.clear();

		await this.connections.stopAll();
	}

	private async loadSafely(deviceId: string, device?: ModbusDeviceEntity): Promise<void> {
		try {
			await this.load(deviceId, device);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to load Modbus device id=${deviceId}`, { message: err.message, stack: err.stack });
		}
	}

	private async load(deviceId: string, preloaded?: ModbusDeviceEntity): Promise<void> {
		const ticket = ++this.loadSequence;

		this.loads.set(deviceId, ticket);

		const device = preloaded ?? (await this.devicesService.findOne<ModbusDeviceEntity>(deviceId, DEVICES_MODBUS_TYPE));
		const bindings = device ? await this.bindingsService.findByDevice(deviceId) : [];
		const endpoint = device?.modbusEndpointId ? await this.endpointsService.findOne(device.modbusEndpointId) : null;

		if (this.loads.get(deviceId) !== ticket || !this.isRunning()) {
			return;
		}

		this.loads.delete(deviceId);
		this.dropDevice(deviceId);

		if (!device) {
			this.lastStates.delete(deviceId);

			return;
		}

		const reads = bindings
			.filter((binding) => binding.role === ModbusBindingRole.READ)
			.map((binding) => ({ propertyId: binding.propertyId, binding }));
		const entry: LoadedDevice = {
			endpointId: device.modbusEndpointId,
			readPropertyIds: reads.map((read) => read.propertyId),
			poller: null,
			commandable: false,
		};

		this.devices.set(deviceId, entry);

		const isCurrent = () => this.isRunning() && this.devices.get(deviceId) === entry;
		const target = this.resolveTarget(device, endpoint);

		if ('problem' in target) {
			await this.applyState(deviceId, entry, target.problem, target.reason, isCurrent);

			return;
		}

		entry.commandable = true;

		if (reads.length === 0) {
			await this.applyState(deviceId, entry, ConnectionState.ALERT, 'Device has no read bindings', isCurrent);

			return;
		}

		entry.poller = new DevicePoller(
			this.snapshot(device, target.endpoint, reads),
			target.connection,
			this.pollerCallbacks(deviceId, target.endpoint.id, isCurrent),
		);
		entry.poller.start();
	}

	/** The running connection the device is polled over, or why it cannot be. */
	private resolveTarget(
		device: ModbusDeviceEntity,
		endpoint: ModbusEndpointEntity | null,
	): { endpoint: ModbusEndpointEntity; connection: EndpointConnection } | { problem: ConnectionState; reason: string } {
		if (!device.enabled) {
			return { problem: ConnectionState.DISCONNECTED, reason: 'Device is disabled' };
		}

		if (!endpoint) {
			return { problem: ConnectionState.ALERT, reason: 'Modbus endpoint is missing' };
		}

		if (!endpoint.enabled) {
			return { problem: ConnectionState.DISCONNECTED, reason: 'Modbus endpoint is disabled' };
		}

		const connection = this.connections.get(endpoint.id);

		if (!connection) {
			return { problem: ConnectionState.DISCONNECTED, reason: 'Modbus endpoint connection is not running' };
		}

		return { endpoint, connection };
	}

	private snapshot(
		device: ModbusDeviceEntity,
		endpoint: ModbusEndpointEntity,
		reads: ModbusDeviceSnapshot['reads'],
	): ModbusDeviceSnapshot {
		return {
			deviceId: device.id,
			endpointId: endpoint.id,
			unitId: device.modbusUnitId ?? MODBUS_DEFAULTS.UNIT_ID,
			pollIntervalMs: device.modbusPollIntervalMs ?? MODBUS_DEFAULTS.POLL_INTERVAL_MS,
			byteOrder: device.modbusByteOrder ?? MODBUS_DEFAULTS.BYTE_ORDER,
			wordOrder: device.modbusWordOrder ?? MODBUS_DEFAULTS.WORD_ORDER,
			limits: {
				maxRegisters: device.modbusMaxReadRegisters ?? MODBUS_DEFAULTS.MAX_READ_REGISTERS,
				maxBits: device.modbusMaxReadBits ?? MODBUS_DEFAULTS.MAX_READ_BITS,
				maxGap: device.modbusMaxReadGap ?? MODBUS_DEFAULTS.MAX_READ_GAP,
			},
			reads,
		};
	}

	private pollerCallbacks(deviceId: string, endpointId: string, isCurrent: () => boolean): PollerCallbacks {
		return {
			report: (propertyId, value, sampledAt) => this.report(propertyId, value, sampledAt, isCurrent),
			setConnectionState: (state, reason) => this.setDeviceState(deviceId, state, reason),
			isCurrent,
			setOverloaded: () => this.refreshOverload(endpointId),
		};
	}

	/** Stops the pollers on an endpoint whose connection is about to stop; `reloadEndpoint` restarts them. */
	private stopEndpointPollers(endpointId: string): void {
		for (const [deviceId, entry] of [...this.devices]) {
			if (entry.endpointId !== endpointId) {
				continue;
			}

			entry.poller?.stop();

			this.devices.set(deviceId, { ...entry, poller: null, commandable: false });
		}

		this.refreshOverload(endpointId);
	}

	private async reloadEndpoint(endpointId: string): Promise<void> {
		const deviceIds = [...this.devices]
			.filter(([, entry]) => entry.endpointId === endpointId)
			.map(([deviceId]) => deviceId);

		for (const deviceId of deviceIds) {
			await this.loadSafely(deviceId);
		}
	}

	private dropDevice(deviceId: string): void {
		const entry = this.devices.get(deviceId);

		if (!entry) {
			return;
		}

		this.devices.delete(deviceId);
		entry.poller?.stop();

		if (entry.endpointId) {
			this.refreshOverload(entry.endpointId);
		}
	}

	/** The endpoint is overloaded while any device polled over it is. */
	private refreshOverload(endpointId: string): void {
		const overloaded = [...this.devices.values()].some(
			(entry) => entry.endpointId === endpointId && entry.poller?.isOverloaded() === true,
		);

		if (overloaded === this.overloadedEndpoints.has(endpointId)) {
			return;
		}

		if (overloaded) {
			this.overloadedEndpoints.add(endpointId);
		} else {
			this.overloadedEndpoints.delete(endpointId);
		}

		this.connections.get(endpointId)?.markOverloaded(overloaded);
	}

	/**
	 * Stores a state the runtime decided outside a poller. Entering `lost`, `alert` or `disconnected` from any other
	 * state invalidates the read-bound properties once; properties without a read binding are never touched.
	 */
	private async applyState(
		deviceId: string,
		entry: LoadedDevice,
		state: ConnectionState,
		reason: string,
		isCurrent: () => boolean,
	): Promise<void> {
		const previous = this.lastStates.get(deviceId);

		if (previous === state) {
			return;
		}

		if (INVALIDATING_STATES.has(state) && (previous === undefined || !INVALIDATING_STATES.has(previous))) {
			const now = new Date();

			for (const propertyId of entry.readPropertyIds) {
				if (!isCurrent()) {
					return;
				}

				try {
					await this.report(propertyId, null, now, isCurrent);
				} catch (error) {
					this.logger.warn(
						`Failed to invalidate property id=${propertyId} of device id=${deviceId}: ${(error as Error).message}`,
					);
				}
			}
		}

		if (!isCurrent()) {
			return;
		}

		try {
			await this.setDeviceState(deviceId, state, reason);
		} catch (error) {
			this.logger.warn(`Failed to set connection state ${state} of device id=${deviceId}: ${(error as Error).message}`);
		}
	}

	private async setDeviceState(deviceId: string, state: ConnectionState, reason?: string): Promise<void> {
		if (this.lastStates.get(deviceId) === state) {
			return;
		}

		await this.deviceConnectivityService.setConnectionState(deviceId, { state, reason });

		this.lastStates.set(deviceId, state);
	}

	private async report(
		propertyId: string,
		value: ModbusPropertyValue | null,
		sampledAt: Date,
		isCurrent: () => boolean,
	): Promise<void> {
		await this.channelsPropertiesService.reportSample(
			propertyId,
			toInstance(UpdateModbusChannelPropertyDto, { type: DEVICES_MODBUS_TYPE, value }),
			{ sampledAt, receivedAt: new Date(), observedAt: sampledAt, provenance: 'live', isCurrent },
			{ skipUnchangedMetadata: true },
		);
	}
}
