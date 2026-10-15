import { Characteristic, HAPStatus, Service } from '@homebridge/hap-nodejs';

import { HomeKitProfileFixture } from '../../../../test/support/homekit-profile.fixture';
import { ChannelCategory, DataTypeType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { HomeKitEventListener } from '../listeners/homekit-event.listener';

const failure = HAPStatus.SERVICE_COMMUNICATION_FAILURE;
describe('HomeKit standard sensor profiles with current producer authority', () => {
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
	it('keeps concentration usable without inventing required CO2 detection, including initial HAP status and fault GET', async () => {
		const device = fixture.device();
		const concentration = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.CONCENTRATION, {
			dataType: DataTypeType.FLOAT,
			unit: 'ppm',
		});
		fixture.publish(concentration, 450);
		const service = fixture.build(device).getService(Service.CarbonDioxideSensor);
		const detection = service.getCharacteristic(Characteristic.CarbonDioxideDetected);
		const level = service.getCharacteristic(Characteristic.CarbonDioxideLevel);
		const fault = service.getCharacteristic(Characteristic.StatusFault);
		expect(detection.statusCode).toBe(failure);
		expect(service.testCharacteristic(Characteristic.CarbonDioxidePeakLevel)).toBe(false);
		for (const value of [0, 450, 100000]) {
			fixture.publish(concentration, value);
			expect(await level.handleGetRequest()).toBe(value);
			expect(await fault.handleGetRequest()).toBe(1);
			await expect(detection.handleGetRequest()).rejects.toBe(failure);
		}
	});
	it('tracks independent detection/level/peak faults, invalid ranges, recovery and exact expiry without a timer tick', async () => {
		const device = fixture.device();
		const level = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.CONCENTRATION, {
			dataType: DataTypeType.FLOAT,
			unit: 'ppm',
		});
		const detected = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.DETECTED);
		const peak = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.PEAK_LEVEL, {
			dataType: DataTypeType.FLOAT,
			unit: 'ppm',
		});
		fixture.publish(level, 600);
		fixture.publish(detected, false);
		fixture.publish(peak, 1000);
		const service = fixture.build(device).getService(Service.CarbonDioxideSensor);
		const reading = service.getCharacteristic(Characteristic.CarbonDioxideLevel);
		const detection = service.getCharacteristic(Characteristic.CarbonDioxideDetected);
		const fault = service.getCharacteristic(Characteristic.StatusFault);
		expect(await detection.handleGetRequest()).toBe(0);
		fixture.publish(detected, true);
		expect(await detection.handleGetRequest()).toBe(1);
		for (const invalid of [-1, 100001, NaN, Infinity, null, '500']) {
			fixture.publish(level, invalid);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			expect(await detection.handleGetRequest()).toBe(1);
			expect(await fault.handleGetRequest()).toBe(1);
		}
		fixture.publish(level, 600);
		fixture.publish(peak, null);
		expect(await reading.handleGetRequest()).toBe(600);
		expect(await fault.handleGetRequest()).toBe(1);
		fixture.publish(peak, 1000);
		expect(await fault.handleGetRequest()).toBe(0);
		jest.setSystemTime(Date.now() + 999);
		expect(await reading.handleGetRequest()).toBe(600);
		jest.setSystemTime(Date.now() + 1);
		await expect(reading.handleGetRequest()).rejects.toBe(failure);
		expect(await fault.handleGetRequest()).toBe(1);
		fixture.publish(level, 601);
		fixture.publish(peak, 1000);
		fixture.publish(detected, false);
		expect(await reading.handleGetRequest()).toBe(601);
		expect(await fault.handleGetRequest()).toBe(0);
	});
	it('ignores persisted last-good CO2 after process restart until current evidence returns', async () => {
		const device = fixture.device();
		const output = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.CONCENTRATION, {
			dataType: DataTypeType.FLOAT,
			unit: 'ppm',
		});
		fixture.publish(output, 700);
		fixture.build(device);
		output.value = new PropertyValueState(700, new Date().toISOString());
		const restarted = new HomeKitProfileFixture();
		try {
			const service = restarted.build(device).getService(Service.CarbonDioxideSensor);
			const reading = service.getCharacteristic(Characteristic.CarbonDioxideLevel);
			expect(reading.statusCode).toBe(failure);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			restarted.publish(output, 702);
			expect(await reading.handleGetRequest()).toBe(702);
		} finally {
			restarted.destroy();
		}
	});

	it.each([
		[DataTypeType.BOOL, 'ppm'],
		[DataTypeType.UCHAR, 'ppm'],
		[DataTypeType.FLOAT, '%'],
		[DataTypeType.FLOAT, null],
	] as const)(
		'rejects CO2 level metadata %s/%s without converting numeric values to ppm',
		(dataType, unit: string | null) => {
			const device = fixture.device();
			const level = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.CONCENTRATION, {
				dataType,
				unit,
			});
			fixture.publish(level, 450);
			expect(fixture.registry.canMap(device)).toBe(false);
			const detection = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.DETECTED);
			const peak = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.PEAK_LEVEL, {
				dataType,
				unit,
			});
			fixture.publish(detection, false);
			fixture.publish(peak, 450);
			const service = fixture.build(device).getService(Service.CarbonDioxideSensor);
			expect(service.testCharacteristic(Characteristic.CarbonDioxideLevel)).toBe(false);
			expect(service.testCharacteristic(Characteristic.CarbonDioxidePeakLevel)).toBe(false);
			expect(fixture.registry.getBindingsForProperty(level.id)).toHaveLength(0);
			expect(fixture.registry.getBindingsForProperty(peak.id)).toHaveLength(0);
		},
	);
	it.each([
		[PropertyCategory.CONCENTRATION, Characteristic.CarbonDioxideLevel, DataTypeType.FLOAT, '%'],
		[PropertyCategory.CONCENTRATION, Characteristic.CarbonDioxideLevel, DataTypeType.BOOL, 'ppm'],
		[PropertyCategory.PEAK_LEVEL, Characteristic.CarbonDioxidePeakLevel, DataTypeType.FLOAT, '%'],
		[PropertyCategory.PEAK_LEVEL, Characteristic.CarbonDioxidePeakLevel, DataTypeType.UCHAR, 'ppm'],
	] as const)(
		'fails %s on metadata drift before rebuild and withdraws the old binding',
		async (category, type, dataType, unit) => {
			const device = fixture.device();
			const detection = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, PropertyCategory.DETECTED);
			const output = fixture.property(device, ChannelCategory.CARBON_DIOXIDE, category, {
				dataType: DataTypeType.FLOAT,
				unit: 'ppm',
			});
			fixture.publish(detection, false);
			fixture.publish(output, 450);
			const oldAccessory = fixture.build(device),
				service = oldAccessory.getService(Service.CarbonDioxideSensor);
			const reading = service.getCharacteristic(type);
			expect(await reading.handleGetRequest()).toBe(450);
			Object.assign(output, { dataType, unit });
			new HomeKitEventListener(fixture.registry).handlePropertyValueChanged(output);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			expect(await service.getCharacteristic(Characteristic.StatusFault).handleGetRequest()).toBe(1);
			// Equal-valued live evidence cannot restore a binding whose metadata no longer denotes ppm.
			fixture.publish(output, 450);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			const replacement = fixture.build(device);
			expect(replacement.UUID).toBe(oldAccessory.UUID);
			expect(replacement.getService(Service.CarbonDioxideSensor).testCharacteristic(type)).toBe(false);
			expect(fixture.registry.getBindingsForProperty(output.id)).toHaveLength(0);
			await expect(reading.handleGetRequest()).rejects.toBe(failure);
			Object.assign(output, { dataType: DataTypeType.FLOAT, unit: 'ppm' });
			const recovered = fixture.build(device).getService(Service.CarbonDioxideSensor);
			expect(await recovered.getCharacteristic(type).handleGetRequest()).toBe(450);
			expect(fixture.registry.getBindingsForProperty(output.id)).toHaveLength(1);
		},
	);
	it.each([
		[
			ChannelCategory.HUMIDITY,
			PropertyCategory.HUMIDITY,
			Service.HumiditySensor,
			Characteristic.CurrentRelativeHumidity,
			50,
		],
		[
			ChannelCategory.ILLUMINANCE,
			PropertyCategory.ILLUMINANCE,
			Service.LightSensor,
			Characteristic.CurrentAmbientLightLevel,
			100,
		],
		[ChannelCategory.MOTION, PropertyCategory.DETECTED, Service.MotionSensor, Characteristic.MotionDetected, true],
		[
			ChannelCategory.CONTACT,
			PropertyCategory.DETECTED,
			Service.ContactSensor,
			Characteristic.ContactSensorState,
			true,
		],
		[
			ChannelCategory.OCCUPANCY,
			PropertyCategory.DETECTED,
			Service.OccupancySensor,
			Characteristic.OccupancyDetected,
			true,
		],
	] as const)('retains quality and exact expiry for %s', async (category, quantity, serviceType, type, value) => {
		const device = fixture.device(),
			output = fixture.property(device, category, quantity);
		fixture.publish(output, value);
		const service = fixture.build(device).getService(serviceType),
			reading = service.getCharacteristic(type);
		const good = await reading.handleGetRequest();
		fixture.publish(output, value, 'degraded');
		expect(await reading.handleGetRequest()).toBe(good);
		expect(await service.getCharacteristic(Characteristic.StatusFault).handleGetRequest()).toBe(1);
		fixture.publish(output, value);
		expect(await service.getCharacteristic(Characteristic.StatusFault).handleGetRequest()).toBe(0);
		jest.setSystemTime(Date.now() + 1000);
		await expect(reading.handleGetRequest()).rejects.toBe(failure);
	});
	it('does not map unsupported specialty and dew-point channels', () => {
		const device = fixture.device();
		fixture.property(device, ChannelCategory.ANALOG_INPUT, PropertyCategory.VALUE);
		expect(fixture.registry.canMap(device)).toBe(false);
	});
});
