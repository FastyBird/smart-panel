import { Accessory, Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
	ChannelCategory,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import {
	PropertyProducerLease,
	PropertyProducerRegistryService,
} from '../../../modules/devices/services/property-producer.registry.service';
import { PropertyValueSourceRegistryService } from '../../../modules/devices/services/property-value-source.registry.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../../devices-virtual/entities/devices-virtual.entity';
import { VirtualValueSourceService } from '../../devices-virtual/services/virtual-value-source.service';
import { HomeKitEventListener } from '../listeners/homekit-event.listener';

import { HomeKitCommandDispatcher } from './homekit-command.dispatcher';
import { HomeKitMapperRegistryService } from './homekit-mapper-registry.service';
import { HomeKitPropertyStateService } from './homekit-property-state.service';

/** Real HAP, registry, producer leases and event delivery; no bridge advertising or network writes. */
describe('HomeKit managed virtual state', () => {
	let events: EventEmitter2, producers: PropertyProducerRegistryService, registry: HomeKitMapperRegistryService;
	let dispatcher: HomeKitCommandDispatcher;
	let leases: Map<string, PropertyProducerLease>;
	let sequence: number;
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-10-15T12:00:00Z'));
		events = new EventEmitter2();
		producers = new PropertyProducerRegistryService(events);
		const sources = new PropertyValueSourceRegistryService();
		sources.register(new VirtualValueSourceService());
		registry = new HomeKitMapperRegistryService(new HomeKitPropertyStateService(producers, sources));
		const listener = new HomeKitEventListener(registry);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_STATE_CHANGED, (property: ChannelPropertyEntity) =>
			listener.handlePropertyValueSet(property),
		);
		events.on(EventType.CHANNEL_PROPERTY_VALUE_SET, (property: ChannelPropertyEntity) =>
			listener.handlePropertyValueSet(property),
		);
		dispatcher = new HomeKitCommandDispatcher({ canExecuteCompositeProperty: () => false } as never);
		leases = new Map();
		sequence = 0;
	});
	afterEach(() => {
		producers.onModuleDestroy();
		jest.useRealTimers();
	});
	const device = (category = DeviceCategory.SENSOR) =>
		Object.assign(new VirtualDeviceEntity(), {
			id: `device-${++sequence}`,
			name: 'Virtual',
			category,
			mode: VirtualDeviceMode.SENSOR_TRANSFORM,
			channels: [],
			status: { online: true },
		});
	const property = (
		parent: VirtualDeviceEntity,
		category: ChannelCategory,
		quantity: PropertyCategory,
		writable = false,
		value: unknown = 99,
	) => {
		let channel = parent.channels.find((candidate) => candidate.category === category) as VirtualChannelEntity;
		if (!channel) {
			channel = Object.assign(new VirtualChannelEntity(), {
				id: `channel-${++sequence}`,
				category,
				device: parent,
				properties: [],
			});
			parent.channels.push(channel);
		}
		const output = Object.assign(new VirtualChannelPropertyEntity(), {
			id: `property-${++sequence}`,
			channel,
			category: quantity,
			permissions: [writable ? PermissionType.READ_WRITE : PermissionType.READ_ONLY],
			valueOrigin: writable ? VirtualValueOrigin.LOCAL : VirtualValueOrigin.DERIVED,
			value: new PropertyValueState(value as number),
		});
		channel.properties.push(output);
		return output;
	};
	const publish = (
		output: ChannelPropertyEntity,
		value: number | boolean | null,
		quality: 'good' | 'degraded' = 'good',
	) => {
		let lease = leases.get(output.id);
		if (!lease) {
			lease = producers.register(output, 1);
			leases.set(output.id, lease);
		}
		const now = Date.now();
		expect(
			producers.commit(
				lease,
				new PropertyValueState(value),
				{
					quality,
					reasons: quality === 'degraded' ? ['mixed'] : [],
					sampledAt: new Date(now),
					evaluatedAt: new Date(now),
					expiresAt: new Date(now + 1000),
				},
				producers.version(lease),
			),
		).toBe(true);
	};
	const build = (parent: DeviceEntity): Accessory => {
		const staged = registry.buildAccessory(parent, dispatcher);
		if (!staged) throw new Error('Missing accessory');
		registry.commitStaged(staged);
		return staged.accessory;
	};
	it.each([
		[
			ChannelCategory.TEMPERATURE,
			PropertyCategory.TEMPERATURE,
			Service.TemperatureSensor,
			Characteristic.CurrentTemperature,
			-5,
			101,
		],
		[
			ChannelCategory.HUMIDITY,
			PropertyCategory.HUMIDITY,
			Service.HumiditySensor,
			Characteristic.CurrentRelativeHumidity,
			50,
			101,
		],
		[
			ChannelCategory.ILLUMINANCE,
			PropertyCategory.ILLUMINANCE,
			Service.LightSensor,
			Characteristic.CurrentAmbientLightLevel,
			100,
			-1,
		],
	] as const)(
		'validates managed %s without changing physical fallback policy',
		async (category, quantity, serviceType, characteristicType, good, invalid) => {
			const parent = device(),
				output = property(parent, category, quantity),
				accessory = build(parent);
			const service = accessory.getService(serviceType),
				reading = service.getCharacteristic(characteristicType),
				fault = service.getCharacteristic(Characteristic.StatusFault);
			await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			publish(output, good, 'degraded');
			expect(await reading.handleGetRequest()).toBe(good);
			expect(await fault.handleGetRequest()).toBe(1);
			publish(output, good);
			expect(await fault.handleGetRequest()).toBe(0);
			for (const invalidValue of [invalid, NaN, null]) {
				publish(output, invalidValue);
				await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
				expect(await fault.handleGetRequest()).toBe(1);
			}
		},
	);

	it('fails managed GET closed when a low-level composition omits the state adapter', async () => {
		const parent = device();
		property(parent, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
		registry = new HomeKitMapperRegistryService();
		const reading = build(parent)
			.getService(Service.TemperatureSensor)
			.getCharacteristic(Characteristic.CurrentTemperature);
		await expect(reading.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
	});
	it('does not invent a standard HAP service for an arbitrary numeric quantity', () => {
		const parent = device();
		property(parent, ChannelCategory.ANALOG_INPUT, PropertyCategory.VALUE);
		expect(registry.canMap(parent)).toBe(false);
	});
	it('retains mixed any-on/representative brightness while unknown color fails individually', async () => {
		const parent = device(DeviceCategory.LIGHTING);
		const on = property(parent, ChannelCategory.LIGHT, PropertyCategory.ON),
			brightness = property(parent, ChannelCategory.LIGHT, PropertyCategory.BRIGHTNESS),
			hue = property(parent, ChannelCategory.LIGHT, PropertyCategory.HUE);
		publish(on, true, 'degraded');
		publish(brightness, 42, 'degraded');
		publish(hue, null, 'degraded');
		const service = build(parent).getService(Service.Lightbulb);
		expect(await service.getCharacteristic(Characteristic.On).handleGetRequest()).toBe(true);
		expect(await service.getCharacteristic(Characteristic.Brightness).handleGetRequest()).toBe(42);
		await expect(service.getCharacteristic(Characteristic.Hue).handleGetRequest()).rejects.toBe(
			HAPStatus.SERVICE_COMMUNICATION_FAILURE,
		);
		expect(service.testCharacteristic(Characteristic.StatusFault)).toBe(false);
	});
	it('reports confirmed controller activity independently of requested OFF, and never guesses unknown feedback', async () => {
		const parent = device(DeviceCategory.THERMOSTAT);
		const ambient = property(parent, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE),
			requested = property(parent, ChannelCategory.HEATER, PropertyCategory.ON, true, false);
		property(parent, ChannelCategory.HEATER, PropertyCategory.TEMPERATURE, true, 22);
		const status = property(parent, ChannelCategory.HEATER, PropertyCategory.STATUS);
		status.valueOrigin = VirtualValueOrigin.LOCAL;
		publish(ambient, 18);
		publish(status, true);
		const service = build(parent).getService(Service.Thermostat),
			current = service.getCharacteristic(Characteristic.CurrentHeatingCoolingState),
			target = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);
		expect(await target.handleGetRequest()).toBe(Characteristic.TargetHeatingCoolingState.OFF);
		expect(await current.handleGetRequest()).toBe(Characteristic.CurrentHeatingCoolingState.HEAT);
		requested.value = new PropertyValueState(true);
		events.emit(EventType.CHANNEL_PROPERTY_VALUE_SET, requested);
		publish(status, false);
		expect(await target.handleGetRequest()).toBe(Characteristic.TargetHeatingCoolingState.HEAT);
		expect(await current.handleGetRequest()).toBe(Characteristic.CurrentHeatingCoolingState.OFF);
		publish(status, null);
		await expect(current.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		jest.setSystemTime(Date.now() + 1001);
		await expect(service.getCharacteristic(Characteristic.CurrentTemperature).handleGetRequest()).rejects.toBe(
			HAPStatus.SERVICE_COMMUNICATION_FAILURE,
		);
		expect(service.testCharacteristic(Characteristic.StatusFault)).toBe(false);
	});
	it('fences replaced accessory GET/SET and accepts equal-value quality changes', async () => {
		const parent = device(),
			output = property(parent, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
		publish(output, 21);
		const first = build(parent)
			.getService(Service.TemperatureSensor)
			.getCharacteristic(Characteristic.CurrentTemperature);
		const replacement = build(parent).getService(Service.TemperatureSensor);
		publish(output, 21, 'degraded');
		await expect(first.handleGetRequest()).rejects.toBe(HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		expect(await replacement.getCharacteristic(Characteristic.CurrentTemperature).handleGetRequest()).toBe(21);
		expect(await replacement.getCharacteristic(Characteristic.StatusFault).handleGetRequest()).toBe(1);
	});
});
