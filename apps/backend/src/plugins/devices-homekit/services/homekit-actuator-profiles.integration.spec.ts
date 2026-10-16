import { Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';

import { HomeKitProfileFixture } from '../../../../test/support/homekit-profile.fixture';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { QualifiedPropertySample } from '../../../modules/devices/models/property-sample.model';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { VirtualLightGroupProfile } from '../../devices-virtual/entities/virtual-producer.entity';
import { reportGroup } from '../../devices-virtual/services/virtual-group-profile';
import { HomeKitEventListener } from '../listeners/homekit-event.listener';

const failure = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
describe('HomeKit fan and covering profiles', () => {
	let fixture: HomeKitProfileFixture;
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-10-15T12:00:00Z'));
		fixture = new HomeKitProfileFixture();
	});
	afterEach(() => {
		fixture.destroy();
		jest.useRealTimers();
	});
	it('maps ON/OFF and native fan optionals through registry, producer and dispatcher without synthesizing activity', async () => {
		const device = fixture.device(DeviceCategory.FAN);
		const on = fixture.property(device, ChannelCategory.FAN, PropertyCategory.ON);
		const speed = fixture.property(device, ChannelCategory.FAN, PropertyCategory.SPEED, {
			dataType: DataTypeType.UCHAR,
			unit: '%',
			format: [10, 90],
			step: 10,
		});
		const swing = fixture.property(device, ChannelCategory.FAN, PropertyCategory.SWING);
		const direction = fixture.property(device, ChannelCategory.FAN, PropertyCategory.DIRECTION, {
			dataType: DataTypeType.ENUM,
			format: ['clockwise', 'counter_clockwise'],
		});
		const mode = fixture.property(device, ChannelCategory.FAN, PropertyCategory.MODE, {
			dataType: DataTypeType.ENUM,
			format: ['auto', 'manual'],
		});
		fixture.publish(on, false);
		fixture.publish(speed, 30);
		fixture.publish(swing, false);
		fixture.publish(direction, 'clockwise');
		fixture.publish(mode, 'manual');
		expect(fixture.registry.getSuggestedServiceType(device)).toBe('fan');
		const service = fixture.build(device).getService(Service.Fanv2);
		expect(service.subtype).toBe(device.channels[0].id);
		expect(service.testCharacteristic(Characteristic.StatusFault)).toBe(false);
		expect(service.testCharacteristic(Characteristic.CurrentFanState)).toBe(false);
		const rotation = service.getCharacteristic(Characteristic.RotationSpeed);
		expect(rotation.props).toMatchObject({ minValue: 10, maxValue: 90, minStep: 10 });
		for (const [property, type, reported, request, dispatched] of [
			[on, Characteristic.Active, 0, 1, true],
			[speed, Characteristic.RotationSpeed, 30, 50, 50],
			[swing, Characteristic.SwingMode, 0, 1, true],
			[direction, Characteristic.RotationDirection, 0, 1, 'counter_clockwise'],
			[mode, Characteristic.TargetFanState, 0, 1, 'auto'],
		] as const) {
			const characteristic = service.getCharacteristic(type);
			expect(await characteristic.handleGetRequest()).toBe(reported);
			// Successful command acceptance without feedback cannot fabricate a reported value.
			await expect(characteristic.handleSetRequest(request)).resolves.toBe(reported);
			expect(fixture.commands.executePropertyCommandById).toHaveBeenLastCalledWith(property.id, dispatched);
			expect(await characteristic.handleGetRequest()).toBe(reported);
			fixture.publish(property, dispatched);
			expect(await characteristic.handleGetRequest()).toBe(request);
		}
		await service.getCharacteristic(Characteristic.Active).handleSetRequest(0);
		expect(fixture.commands.executePropertyCommandById).toHaveBeenLastCalledWith(on.id, false);
		fixture.publish(on, false);
		expect(await service.getCharacteristic(Characteristic.Active).handleGetRequest()).toBe(0);
		fixture.publish(speed, 35);
		await expect(rotation.handleGetRequest()).rejects.toBe(failure);
		fixture.publish(speed, 90);
		expect(await rotation.handleGetRequest()).toBe(90);
		fixture.publish(direction, 'forward');
		await expect(service.getCharacteristic(Characteristic.RotationDirection).handleGetRequest()).rejects.toBe(failure);
		fixture.publish(mode, 'sleep');
		await expect(service.getCharacteristic(Characteristic.TargetFanState).handleGetRequest()).rejects.toBe(failure);
	});

	it.each([
		[
			PropertyCategory.MODE,
			Characteristic.TargetFanState,
			['auto', 'manual'],
			'manual',
			['auto', 'manual', 'sleep'],
			'sleep',
		],
		[
			PropertyCategory.DIRECTION,
			Characteristic.RotationDirection,
			['clockwise', 'counter_clockwise'],
			'clockwise',
			['forward', 'reverse'],
			'forward',
		],
	] as const)(
		'uses current managed %s metadata and fences SET before deferred rebuild',
		async (category, type, format, value, invalidFormat, noncanonical) => {
			const device = fixture.device(DeviceCategory.FAN);
			const on = fixture.property(device, ChannelCategory.FAN, PropertyCategory.ON);
			const optional = fixture.property(device, ChannelCategory.FAN, category, {
				dataType: DataTypeType.ENUM,
				format: [...format],
			});
			const temperature = fixture.property(device, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE);
			fixture.publish(on, true);
			fixture.publish(optional, value);
			fixture.publish(temperature, 21);
			const initial = fixture.build(device),
				service = initial.getService(Service.Fanv2);
			const reading = service.getCharacteristic(type);
			expect(await reading.handleGetRequest()).toBe(0);
			const listener = new HomeKitEventListener(fixture.registry);
			// Detached metadata reproduces the captured-original-property bug: the original remains canonical.
			const changed: ChannelPropertyEntity = Object.assign(
				Object.create(Object.getPrototypeOf(optional) as object) as ChannelPropertyEntity,
				optional,
				{ format: [...invalidFormat] },
			);
			const fanChannel = device.channels.find((channel) => channel.category === ChannelCategory.FAN);
			fanChannel.properties = fanChannel.properties.map((candidate) =>
				candidate.id === optional.id ? changed : candidate,
			);
			listener.handlePropertyValueChanged(changed);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			await expect(reading.handleSetRequest(1)).rejects.toBe(failure);
			expect(fixture.commands.executePropertyCommandById).not.toHaveBeenCalled();
			expect(optional.format).toEqual([...format]);
			fixture.publish(changed, value);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			expect(
				await initial
					.getService(Service.TemperatureSensor)
					.getCharacteristic(Characteristic.CurrentTemperature)
					.handleGetRequest(),
			).toBe(21);
			const replacement = fixture.build(device);
			expect(replacement.getService(Service.Fanv2).testCharacteristic(type)).toBe(false);
			expect(fixture.registry.getBindingsForProperty(optional.id)).toHaveLength(0);
			changed.format = [...format];
			fixture.publish(changed, noncanonical);
			const recoveredAccessory = fixture.build(device);
			const recovered = recoveredAccessory.getService(Service.Fanv2).getCharacteristic(type);
			await expect(recovered.handleGetRequest()).rejects.toBe(failure);
			fixture.publish(changed, value);
			expect(await recovered.handleGetRequest()).toBe(0);
			fixture.publish(temperature, 21, 'degraded');
			expect(
				await recoveredAccessory
					.getService(Service.TemperatureSensor)
					.getCharacteristic(Characteristic.CurrentTemperature)
					.handleGetRequest(),
			).toBe(21);
			expect(
				await recoveredAccessory
					.getService(Service.TemperatureSensor)
					.getCharacteristic(Characteristic.StatusFault)
					.handleGetRequest(),
			).toBe(1);
			jest.setSystemTime(Date.now() + 1000);
			await expect(recovered.handleGetRequest()).rejects.toBe(failure);
			await expect(reading.handleSetRequest(1)).rejects.toBe(failure);
			expect(fixture.commands.executePropertyCommandById).not.toHaveBeenCalled();
		},
	);
	it('retains sensor services and one binding per property when a sensor-only device rebuilds with a fan', async () => {
		const device = fixture.device(DeviceCategory.FAN);
		const temperature = fixture.property(device, ChannelCategory.TEMPERATURE, PropertyCategory.TEMPERATURE, {
			dataType: DataTypeType.FLOAT,
			unit: '°C',
		});
		const humidity = fixture.property(device, ChannelCategory.HUMIDITY, PropertyCategory.HUMIDITY);
		const motion = fixture.property(device, ChannelCategory.MOTION, PropertyCategory.DETECTED);
		fixture.publish(temperature, 21);
		fixture.publish(humidity, 45);
		fixture.publish(motion, true);
		const previous = fixture.build(device),
			oldTemperature = previous.getService(Service.TemperatureSensor);
		const on = fixture.property(device, ChannelCategory.FAN, PropertyCategory.ON);
		fixture.publish(on, true);
		const replacement = fixture.build(device);
		expect(replacement.UUID).toBe(previous.UUID);
		expect(replacement.getService(Service.TemperatureSensor).subtype).toBe(oldTemperature.subtype);
		for (const [property, type, characteristic, value] of [
			[temperature, Service.TemperatureSensor, Characteristic.CurrentTemperature, 21],
			[humidity, Service.HumiditySensor, Characteristic.CurrentRelativeHumidity, 45],
			[motion, Service.MotionSensor, Characteristic.MotionDetected, true],
			[on, Service.Fanv2, Characteristic.Active, 1],
		] as const) {
			expect(await replacement.getService(type).getCharacteristic(characteristic).handleGetRequest()).toBe(value);
			expect(fixture.registry.getBindingsForProperty(property.id)).toHaveLength(1);
		}
		const identities = replacement.services.map((service) => `${service.UUID}:${service.subtype}`);
		expect(new Set(identities).size).toBe(identities.length);
		await expect(oldTemperature.getCharacteristic(Characteristic.CurrentTemperature).handleGetRequest()).rejects.toBe(
			failure,
		);
		fixture.publish(temperature, 21, 'degraded');
		const currentTemperature = replacement.getService(Service.TemperatureSensor);
		expect(await currentTemperature.getCharacteristic(Characteristic.StatusFault).handleGetRequest()).toBe(1);
		fixture.publish(temperature, 21);
		expect(await currentTemperature.getCharacteristic(Characteristic.StatusFault).handleGetRequest()).toBe(0);
		jest.setSystemTime(Date.now() + 1000);
		await expect(
			currentTemperature.getCharacteristic(Characteristic.CurrentTemperature).handleGetRequest(),
		).rejects.toBe(failure);
		await expect(
			replacement.getService(Service.Fanv2).getCharacteristic(Characteristic.Active).handleGetRequest(),
		).rejects.toBe(failure);
		const rebuiltAgain = fixture.build(device);
		expect(rebuiltAgain.services.map((service) => `${service.UUID}:${service.subtype}`)).toEqual(identities);
		expect(fixture.registry.getBindingsForProperty(temperature.id)).toHaveLength(1);
	});
	it.each([
		[PropertyCategory.SPEED, DataTypeType.ENUM, null, ['off', 'low', 'turbo', 'auto'], Characteristic.RotationSpeed],
		[PropertyCategory.SPEED, DataTypeType.UCHAR, null, [0, 100], Characteristic.RotationSpeed],
		[PropertyCategory.DIRECTION, DataTypeType.ENUM, null, ['forward', 'reverse'], Characteristic.RotationDirection],
		[PropertyCategory.MODE, DataTypeType.ENUM, null, ['manual', 'auto', 'sleep'], Characteristic.TargetFanState],
		[PropertyCategory.SWING, DataTypeType.ENUM, null, ['off', 'on'], Characteristic.SwingMode],
	] as const)('omits unsupported %s contracts', (category, dataType, unit: string | null, format, type) => {
		const device = fixture.device(DeviceCategory.FAN);
		fixture.property(device, ChannelCategory.FAN, PropertyCategory.ON);
		fixture.property(device, ChannelCategory.FAN, category, {
			dataType,
			unit,
			format: [...format] as string[] | number[],
		});
		expect(fixture.build(device).getService(Service.Fanv2).testCharacteristic(type)).toBe(false);
	});
	it('keeps mixed any-ON readable while unknown speed fails, including expiry and rebuild fences', async () => {
		const device = fixture.device(DeviceCategory.FAN);
		const on = fixture.property(device, ChannelCategory.FAN, PropertyCategory.ON);
		const speed = fixture.property(device, ChannelCategory.FAN, PropertyCategory.SPEED, {
			dataType: DataTypeType.UCHAR,
			unit: '%',
			format: [0, 100],
			step: 1,
		});
		const reported = reportGroup(VirtualLightGroupProfile.FAN, [
			{
				identity: 'a',
				samples: new Map([
					[PropertyCategory.ON, { value: true } as QualifiedPropertySample],
					[PropertyCategory.SPEED, { value: 30 } as QualifiedPropertySample],
				]),
			},
			{
				identity: 'b',
				samples: new Map([
					[PropertyCategory.ON, { value: false } as QualifiedPropertySample],
					[PropertyCategory.SPEED, { value: 70 } as QualifiedPropertySample],
				]),
			},
		]);
		expect(reported.mixed).toBe(true);
		fixture.publish(on, reported.on, 'degraded');
		fixture.publish(speed, reported.properties.get(PropertyCategory.SPEED).value, 'degraded');
		const first = fixture.build(device),
			service = first.getService(Service.Fanv2);
		expect(await service.getCharacteristic(Characteristic.Active).handleGetRequest()).toBe(1);
		await expect(service.getCharacteristic(Characteristic.RotationSpeed).handleGetRequest()).rejects.toBe(failure);
		jest.setSystemTime(Date.now() + 1000);
		await expect(service.getCharacteristic(Characteristic.Active).handleGetRequest()).rejects.toBe(failure);
		fixture.publish(on, true);
		fixture.publish(speed, 45);
		const replacement = fixture.build(device);
		expect(replacement.UUID).toBe(first.UUID);
		expect(replacement.getService(Service.Fanv2).subtype).toBe(service.subtype);
		await expect(service.getCharacteristic(Characteristic.Active).handleSetRequest(0)).rejects.toBe(failure);
		expect(fixture.commands.executePropertyCommandById).not.toHaveBeenCalled();
	});
	it.each([false, true])('converts validated managed covering semantics only; enum=%s', async (enumerated) => {
		const device = fixture.device(DeviceCategory.WINDOW_COVERING);
		const position = fixture.property(
			device,
			ChannelCategory.WINDOW_COVERING,
			PropertyCategory.POSITION,
			enumerated
				? { dataType: DataTypeType.ENUM, format: ['closed', 'quarter', 'half', 'three_quarter', 'open'] }
				: { dataType: DataTypeType.UCHAR, unit: '%', format: [0, 100] },
		);
		const status = fixture.property(device, ChannelCategory.WINDOW_COVERING, PropertyCategory.STATUS, {
			dataType: DataTypeType.ENUM,
			format: ['opened', 'closed', 'opening', 'closing', 'stopped'],
		});
		fixture.publish(position, enumerated ? 'open' : 75);
		fixture.publish(status, 'opening');
		const first = fixture.build(device),
			service = first.getService(Service.WindowCovering);
		const current = service.getCharacteristic(Characteristic.CurrentPosition);
		const target = service.getCharacteristic(Characteristic.TargetPosition);
		const moving = service.getCharacteristic(Characteristic.PositionState);
		expect(await current.handleGetRequest()).toBe(enumerated ? 100 : 75);
		for (const [value, expected] of [
			['opening', 1],
			['closing', 0],
			['stopped', 2],
			['opened', 2],
			['closed', 2],
		] as const) {
			fixture.publish(status, value);
			expect(await moving.handleGetRequest()).toBe(expected);
		}
		await target.handleSetRequest(50);
		expect(fixture.commands.executePropertyCommandById).toHaveBeenLastCalledWith(position.id, enumerated ? 'half' : 50);
		expect(await current.handleGetRequest()).toBe(enumerated ? 100 : 75);
		for (const unknown of ['unknown', '1', null]) {
			fixture.publish(status, unknown);
			await expect(moving.handleGetRequest()).rejects.toBe(failure);
		}
		for (const unknown of [null, '25', 'invalid', 101]) {
			fixture.publish(position, unknown);
			await expect(current.handleGetRequest()).rejects.toBe(failure);
		}
		// A disagreement is represented by null, independently of a known moving state.
		fixture.publish(status, 'opening');
		expect(await moving.handleGetRequest()).toBe(1);
		const replacement = fixture.build(device);
		expect(replacement.UUID).toBe(first.UUID);
		expect(replacement.getService(Service.WindowCovering).subtype).toBe(service.subtype);
		await expect(current.handleGetRequest()).rejects.toBe(failure);
		await expect(target.handleSetRequest(25)).rejects.toBe(failure);
		fixture.publish(position, enumerated ? 'quarter' : 25);
		expect(
			await replacement
				.getService(Service.WindowCovering)
				.getCharacteristic(Characteristic.CurrentPosition)
				.handleGetRequest(),
		).toBe(25);
	});
	it('does not infer managed outlet IN_USE from ON when absent or unknown', async () => {
		const device = fixture.device(DeviceCategory.OUTLET);
		const on = fixture.property(device, ChannelCategory.OUTLET, PropertyCategory.ON);
		fixture.publish(on, true);
		let service = fixture.build(device).getService(Service.Outlet);
		expect(await service.getCharacteristic(Characteristic.On).handleGetRequest()).toBe(true);
		expect(service.getCharacteristic(Characteristic.OutletInUse).statusCode).toBe(failure);
		await expect(service.getCharacteristic(Characteristic.OutletInUse).handleGetRequest()).rejects.toBe(failure);
		const inUse = fixture.property(device, ChannelCategory.OUTLET, PropertyCategory.IN_USE);
		fixture.publish(inUse, null);
		service = fixture.build(device).getService(Service.Outlet);
		await expect(service.getCharacteristic(Characteristic.OutletInUse).handleGetRequest()).rejects.toBe(failure);
		fixture.publish(inUse, false);
		expect(await service.getCharacteristic(Characteristic.OutletInUse).handleGetRequest()).toBe(false);
	});
	it('preserves ordinary physical outlet fallback and legacy covering conversions', async () => {
		const physical = (category: ChannelCategory, values: [PropertyCategory, string | boolean][]) => {
			const device = Object.assign(new DeviceEntity(), {
				id: category,
				name: 'Legacy',
				channels: [],
				status: { online: true },
			});
			const channel = Object.assign(new ChannelEntity(), {
				id: `${category}-channel`,
				category,
				device,
				properties: [],
			});
			channel.properties = values.map(([category, value]) =>
				Object.assign(new ChannelPropertyEntity(), {
					id: `${category}-property`,
					channel,
					category,
					value: new PropertyValueState(value),
				}),
			);
			device.channels = [channel];
			return device;
		};
		const outlet = fixture
			.build(physical(ChannelCategory.OUTLET, [[PropertyCategory.ON, true]]))
			.getService(Service.Outlet);
		expect(await outlet.getCharacteristic(Characteristic.OutletInUse).handleGetRequest()).toBe(true);
		const cover = fixture
			.build(
				physical(ChannelCategory.WINDOW_COVERING, [
					[PropertyCategory.POSITION, '75'],
					[PropertyCategory.STATUS, 'legacy-idle'],
				]),
			)
			.getService(Service.WindowCovering);
		expect(await cover.getCharacteristic(Characteristic.CurrentPosition).handleGetRequest()).toBe(75);
		expect(await cover.getCharacteristic(Characteristic.PositionState).handleGetRequest()).toBe(2);
	});
});
