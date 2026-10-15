import fs from 'fs';
import os from 'os';
import path from 'path';

import { Bridge, Characteristic, HAPStatus, Perms, Service } from '@homebridge/hap-nodejs';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ConfigService } from '../../../modules/config/services/config.service';
import { PluginConfigMutationRegistryService } from '../../../modules/config/services/plugin-config-mutation-registry.service';
import { PluginsTypeMapperService } from '../../../modules/config/services/plugins-type-mapper.service';
import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { ExtensionsService } from '../../../modules/extensions/services/extensions.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { SwaggerModelsRegistryService } from '../../../modules/swagger/services/swagger-models-registry.service';
import { DEVICES_HOMEKIT_PLUGIN_NAME } from '../devices-homekit.constants';
import { DevicesHomeKitPlugin } from '../devices-homekit.plugin';
import { HomeKitUpdatePluginConfigDto } from '../dto/update-config.dto';
import { HomeKitEventListener } from '../listeners/homekit-event.listener';
import { HomeKitConfigModel } from '../models/config.model';

import { HomeKitBridgeService } from './homekit-bridge.service';
import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';

jest.mock('../utils/ciao-receive-guard', () => ({ installCiaoReceiveGuard: jest.fn() }));

function property(
	channel: ChannelEntity,
	id: string,
	category: PropertyCategory,
	value: string | number | boolean | null,
): ChannelPropertyEntity {
	const result = new ChannelPropertyEntity();
	Object.assign(result, {
		id,
		channel,
		category,
		permissions: [PermissionType.READ_WRITE],
		value: new PropertyValueState(value),
	});
	channel.properties.push(result);
	return result;
}

function channel(device: DeviceEntity, id: string, category: ChannelCategory): ChannelEntity {
	const result = new ChannelEntity();
	Object.assign(result, { id, device, category, properties: [] });
	device.channels.push(result);
	return result;
}

function fixture(online = true): DeviceEntity {
	const device = new DeviceEntity();
	Object.assign(device, {
		id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
		name: 'Switch',
		category: DeviceCategory.GENERIC,
		channels: [],
	});
	device.status.online = online;
	property(channel(device, 'switch', ChannelCategory.SWITCHER), 'on', PropertyCategory.ON, false);
	property(channel(device, 'battery', ChannelCategory.BATTERY), 'level', PropertyCategory.PERCENTAGE, 80);
	const event = property(channel(device, 'button', ChannelCategory.BUTTON), 'event', PropertyCategory.EVENT, null);
	event.permissions = [PermissionType.EVENT_ONLY];
	event.format = ['single', 'double', 'long'];
	return device;
}

describe('HomeKit lifecycle with real HAP accessories and serialized config mutations', () => {
	let config: HomeKitConfigModel;
	let device: DeviceEntity;
	let rows: Map<string, DeviceEntity>;
	let registry: HomeKitMapperRegistryService;
	let bridge: HomeKitBridgeService;
	let listener: HomeKitEventListener;
	let findOne: jest.Mock;
	let dispatch: jest.Mock;
	let persist: jest.Mock;
	let storage: string;
	let previousConfigPath: string | undefined;
	let commits: number;

	beforeEach(() => {
		previousConfigPath = process.env.FB_CONFIG_PATH;
		storage = fs.mkdtempSync(path.join(os.tmpdir(), 'homekit-lifecycle-'));
		process.env.FB_CONFIG_PATH = storage;
		// Real services/accessories/characteristics, with network publication disabled.
		jest.spyOn(Bridge.prototype, 'publish').mockResolvedValue(undefined);
		jest.spyOn(Bridge.prototype, 'unpublish').mockResolvedValue(undefined);
		jest.spyOn(Bridge.prototype, 'setupURI').mockReturnValue('');
		device = fixture();
		rows = new Map([[device.id, device]]);
		config = Object.assign(new HomeKitConfigModel(), {
			type: DEVICES_HOMEKIT_PLUGIN_NAME,
			enabled: true,
			mappedDeviceIds: [device.id],
		});
		registry = new HomeKitMapperRegistryService();
		findOne = jest.fn((id: string) => Promise.resolve(rows.get(id) ?? null));
		const devices = { findOne } as unknown as DevicesService;
		dispatch = jest.fn().mockResolvedValue(undefined);
		const dispatcher = { dispatch, dispatchBatch: dispatch } as unknown as HomeKitCommandDispatcher;
		const mutations = new PluginConfigMutationRegistryService();
		commits = 0;
		persist = jest.fn((_type: string, update: { mapped_device_ids?: string[] }) => {
			if (update.mapped_device_ids)
				config = Object.assign(new HomeKitConfigModel(), config, { mappedDeviceIds: [...update.mapped_device_ids] });
		});
		const configService = {
			getPluginConfig: () => config,
			setPluginConfig: persist,
			updatePluginConfig: (type: string, update: HomeKitUpdatePluginConfigDto) =>
				mutations.execute(type, update, () => {
					commits++;
					persist(type, update);
				}),
		} as unknown as ConfigService;
		bridge = new HomeKitBridgeService(configService, devices, registry, dispatcher, new EventEmitter2());
		new DevicesHomeKitPlugin(
			{ registerMapping: jest.fn() } as unknown as PluginsTypeMapperService,
			{ register: jest.fn() } as unknown as SwaggerModelsRegistryService,
			{ registerPluginMetadata: jest.fn() } as unknown as ExtensionsService,
			{ register: jest.fn() } as unknown as ManagedServiceManagerService,
			bridge,
			mutations,
			devices,
			registry,
			configService,
		).onModuleInit();
		listener = new HomeKitEventListener(registry, bridge, devices, {
			findOne: jest.fn((id: string) => Promise.resolve(device.channels.find((c) => c.id === id))),
		} as unknown as ChannelsService);
	});

	afterEach(async () => {
		listener.onModuleDestroy();
		await bridge.stop();
		jest.restoreAllMocks();
		if (previousConfigPath === undefined) delete process.env.FB_CONFIG_PATH;
		else process.env.FB_CONFIG_PATH = previousConfigPath;
		fs.rmSync(storage, { recursive: true, force: true });
	});

	function accessory() {
		return (bridge as unknown as { bridge: Bridge }).bridge.bridgedAccessories[0];
	}

	it('prunes stale ids at startup and reconcile, including while stopped', async () => {
		config.mappedDeviceIds.push('missing');
		await bridge.start();
		expect(config.mappedDeviceIds).toEqual([device.id]);
		expect(commits).toBe(1);
		config.mappedDeviceIds.push('another-missing');
		await bridge.reconcileLatestMapping();
		expect(config.mappedDeviceIds).toEqual([device.id]);
		await bridge.stop();
		config.enabled = false;
		rows.delete(device.id);
		await bridge.reconcileLatestMapping();
		expect(config.mappedDeviceIds).toEqual([]);
		expect(bridge.getState()).toBe('stopped');
	});

	it('deletes through config mutation, releases bindings/listeners, and ignores unmapped ids', async () => {
		await bridge.start();
		const old = accessory();
		rows.delete(device.id);
		await listener.handleDeviceDeleted(device);
		expect(config.mappedDeviceIds).toEqual([]);
		expect(registry.getBindingsForProperty('on')).toEqual([]);
		expect(registry.getListenersForProperty('level')).toEqual([]);
		expect(registry.getOccurrenceListeners('event')).toEqual([]);
		expect(registry.getSnapshot().deviceStates?.size).toBe(0);
		await expect(old.getService(Service.Switch).getCharacteristic(Characteristic.On).handleGetRequest()).rejects.toBe(
			HAPStatus.SERVICE_COMMUNICATION_FAILURE,
		);
		const count = commits;
		await listener.handleDeviceDeleted(device);
		expect(commits).toBe(count);
	});

	it('debounces structure events per mapped device, retaining UUID and replacing old resources', async () => {
		await bridge.start();
		const old = accessory();
		const oldUuid = old.UUID;
		const switchChannel = device.channels[0];
		switchChannel.properties = [];
		const replacement = property(switchChannel, 'new-on', PropertyCategory.ON, true);
		listener.handleChannelStructureChanged(switchChannel);
		await listener.handlePropertyStructureChanged(replacement);
		await listener.handlePropertyStructureChanged({ id: 'on', channel: 'switch' } as unknown as ChannelPropertyEntity);
		await new Promise((resolve) => setTimeout(resolve, 140));
		await bridge.applyMapping(); // drain lifecycle work
		expect(accessory()).not.toBe(old);
		expect(accessory().UUID).toBe(oldUuid);
		expect(registry.getBindingsForProperty('on')).toEqual([]);
		expect(registry.getBindingsForProperty('new-on')).toHaveLength(1);
		expect(commits).toBe(0); // rebuild does not rewrite unchanged config
		await expect(old.getService(Service.Switch).getCharacteristic(Characteristic.On).handleGetRequest()).rejects.toBe(
			HAPStatus.SERVICE_COMMUNICATION_FAILURE,
		);
		// Removing the remaining mappable channels prunes the mapping.
		device.channels = [];
		listener.handleChannelStructureChanged(switchChannel);
		await new Promise((resolve) => setTimeout(resolve, 140));
		await bridge.applyMapping();
		expect(config.mappedDeviceIds).toEqual([]);
		expect(registry.getBindingsForProperty('new-on')).toEqual([]);
	});

	it('keeps concurrent mapping additions when a deletion is queued', async () => {
		await bridge.start();
		const second = fixture();
		second.id = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6';
		for (const ch of second.channels) {
			ch.id += '-second';
			for (const prop of ch.properties) prop.id += '-second';
		}
		rows.set(second.id, second);
		await Promise.all([bridge.updateMappedDevices([device.id, second.id]), listener.handleDeviceDeleted(device)]);
		expect(config.mappedDeviceIds).toEqual([second.id]);
		expect(
			accessory().getService(Service.AccessoryInformation).getCharacteristic(Characteristic.SerialNumber).value,
		).toBe(second.id);
		expect(registry.getBindingsForProperty('on')).toEqual([]);
		expect(registry.getBindingsForProperty('on-second')).toHaveLength(1);
	});

	it('cancels pending rebuild timers on shutdown and ignores unmapped structure changes', async () => {
		await bridge.start();
		const build = jest.spyOn(registry, 'buildAccessory');
		listener.handleChannelStructureChanged(device.channels[0]);
		listener.onModuleDestroy();
		listener.handleChannelStructureChanged({ device: 'unmapped' } as ChannelEntity);
		await new Promise((resolve) => setTimeout(resolve, 140));
		expect(build).not.toHaveBeenCalled();
	});

	it('compensates config and restores original same-UUID accessory on failed rebuild', async () => {
		await bridge.start();
		const old = accessory();
		const hapBridge = (bridge as unknown as { bridge: Bridge }).bridge;
		jest.spyOn(hapBridge, 'addBridgedAccessory').mockImplementationOnce((acc) => {
			Bridge.prototype.addBridgedAccessory.call(hapBridge, acc);
			throw new Error('addition failed after mutation');
		});
		await expect(bridge.maintainMapping({ rebuildDeviceIds: [device.id] })).rejects.toThrow('addition failed');
		expect(accessory()).toBe(old);
		expect(config.mappedDeviceIds).toEqual([device.id]);
		expect(registry.getBindingsForProperty('on')).toHaveLength(1);
		expect(await old.getService(Service.Switch).getCharacteristic(Characteristic.On).handleGetRequest()).toBe(false);
		expect(bridge.getState()).toBe('started');
	});

	it('restores config and live resources if deleting an accessory fails after mutation', async () => {
		await bridge.start();
		const old = accessory();
		const hapBridge = (bridge as unknown as { bridge: Bridge }).bridge;
		jest.spyOn(hapBridge, 'removeBridgedAccessory').mockImplementationOnce((acc) => {
			Bridge.prototype.removeBridgedAccessory.call(hapBridge, acc);
			throw new Error('removal failed after mutation');
		});
		rows.delete(device.id);
		await expect(listener.handleDeviceDeleted(device)).rejects.toThrow('removal failed');
		expect(config.mappedDeviceIds).toEqual([device.id]);
		expect(accessory()).toBe(old);
		expect(registry.getBindingsForProperty('on')).toHaveLength(1);
		expect(registry.getListenersForProperty('level')).toHaveLength(1);
		expect(registry.getOccurrenceListeners('event')).toHaveLength(1);
	});

	it('guards switch, button and battery reads/writes offline and refreshes values on return online', async () => {
		device.status.online = false;
		await bridge.start();
		const acc = accessory();
		const on = acc.getService(Service.Switch).getCharacteristic(Characteristic.On);
		const battery = acc.getService(Service.Battery);
		const button = acc
			.getService(Service.StatelessProgrammableSwitch)
			.getCharacteristic(Characteristic.ProgrammableSwitchEvent);
		for (const characteristic of [on, button, ...battery.characteristics]) {
			// Name is static and has no mapper getter.
			if (characteristic.UUID === Characteristic.Name.UUID) continue;
			await expect(characteristic.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
		await expect(on.handleSetRequest(true)).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		expect(dispatch).not.toHaveBeenCalled();
		device.channels[0].properties[0].value = new PropertyValueState(true);
		device.channels[1].properties[0].value = new PropertyValueState(15);
		const updated = jest.spyOn(on, 'updateValue');
		await listener.handleConnectionChanged({ device, state: ConnectionState.CONNECTED });
		expect(await on.handleGetRequest()).toBe(true);
		expect(updated).toHaveBeenCalledWith(true);
		expect(await battery.getCharacteristic(Characteristic.BatteryLevel).handleGetRequest()).toBe(15);
		expect(await battery.getCharacteristic(Characteristic.StatusLowBattery).handleGetRequest()).toBe(
			Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW,
		);
		await listener.handleConnectionChanged({ device, state: ConnectionState.DISCONNECTED });
		await expect(on.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
	});

	it('does not let late reconnect reads overwrite newer property or offline events', async () => {
		await bridge.start();
		const on = accessory().getService(Service.Switch).getCharacteristic(Characteristic.On);
		await listener.handleConnectionChanged({ device, state: ConnectionState.DISCONNECTED });
		let resolve!: (value: DeviceEntity) => void;
		findOne.mockImplementationOnce(
			() =>
				new Promise<DeviceEntity>((done) => {
					resolve = done;
				}),
		);
		const refresh = listener.handleConnectionChanged({ device, state: ConnectionState.CONNECTED });
		const stale = fixture();
		stale.channels[1].properties[0].value = new PropertyValueState(30);
		device.channels[0].properties[0].value = new PropertyValueState(true);
		listener.handlePropertyValueSet(device.channels[0].properties[0]);
		resolve(stale);
		await refresh;
		expect(await on.handleGetRequest()).toBe(true);
		expect(
			await accessory().getService(Service.Battery).getCharacteristic(Characteristic.BatteryLevel).handleGetRequest(),
		).toBe(30);
		await listener.handleConnectionChanged({ device, state: ConnectionState.DISCONNECTED });
		findOne.mockImplementationOnce(
			() =>
				new Promise<DeviceEntity>((done) => {
					resolve = done;
				}),
		);
		const second = listener.handleConnectionChanged({ device, state: ConnectionState.CONNECTED });
		await listener.handleConnectionChanged({ device, state: ConnectionState.DISCONNECTED });
		resolve(stale);
		await second;
		await expect(on.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
	});

	it('uses newer connection events instead of a late initial device.status load', async () => {
		registry.trackDevice(device.id);
		registry.setDeviceOnline(device.id, false);
		// Entity loaded before the event still says online.
		const staged = registry.buildAccessory(device, { dispatch } as unknown as HomeKitCommandDispatcher);
		registry.commitStaged(staged);
		await expect(
			staged.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).handleGetRequest(),
		).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
	});

	it('guards every thermostat coordinator read and write while offline', async () => {
		device.channels = [];
		property(
			channel(device, 'ambient', ChannelCategory.TEMPERATURE),
			'temperature',
			PropertyCategory.TEMPERATURE,
			21,
		).permissions = [PermissionType.READ_ONLY];
		const heater = channel(device, 'heater', ChannelCategory.HEATER);
		property(heater, 'heater-on', PropertyCategory.ON, true);
		property(heater, 'heater-temp', PropertyCategory.TEMPERATURE, 22);
		property(heater, 'locked', PropertyCategory.LOCKED, false);
		const cooler = channel(device, 'cooler', ChannelCategory.COOLER);
		property(cooler, 'cooler-on', PropertyCategory.ON, false);
		property(cooler, 'cooler-temp', PropertyCategory.TEMPERATURE, 25);
		device.status.online = false;
		await bridge.start();
		const thermostat = accessory().getService(Service.Thermostat);
		for (const characteristic of thermostat.characteristics) {
			if (characteristic.UUID === Characteristic.Name.UUID) continue;
			await expect(characteristic.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			if (characteristic.props.perms.includes(Perms.PAIRED_WRITE)) {
				await expect(characteristic.handleSetRequest(characteristic.value ?? 0)).rejects.toBe(
					HAPStatus.SERVICE_COMMUNICATION_FAILURE,
				);
			}
		}
		expect(dispatch).not.toHaveBeenCalled();
		heater.properties[1].value = new PropertyValueState(23);
		await listener.handleConnectionChanged({ device, state: ConnectionState.CONNECTED });
		expect(await thermostat.getCharacteristic(Characteristic.TargetTemperature).handleGetRequest()).toBe(23);
	});
});
