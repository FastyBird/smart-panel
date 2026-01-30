import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { DevicesService } from '../../devices/services/devices.service';
import { Severity } from '../security.constants';

import { SecuritySensorsProvider } from './security-sensors.provider';

function createProperty(category: PropertyCategory, value: any): ChannelPropertyEntity {
	const prop = new ChannelPropertyEntity();
	prop.category = category;
	prop.value = value != null ? new PropertyValueState(value) : null;

	return prop;
}

function createChannel(category: ChannelCategory, detected: any): ChannelEntity {
	const channel = new ChannelEntity();
	channel.category = category;
	channel.properties = [createProperty(PropertyCategory.DETECTED, detected)];

	return channel;
}

function createSensorDevice(id: string, channels: ChannelEntity[]): DeviceEntity {
	const device = new DeviceEntity();
	device.id = id;
	device.category = DeviceCategory.SENSOR;
	device.channels = channels;

	return device;
}

describe('SecuritySensorsProvider', () => {
	let provider: SecuritySensorsProvider;
	let devicesService: { findAll: jest.Mock };

	beforeEach(async () => {
		devicesService = { findAll: jest.fn().mockResolvedValue([]) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecuritySensorsProvider,
				{ provide: DevicesService, useValue: devicesService },
			],
		}).compile();

		provider = module.get<SecuritySensorsProvider>(SecuritySensorsProvider);
	});

	it('should return key "security_sensors"', () => {
		expect(provider.getKey()).toBe('security_sensors');
	});

	it('should return empty signal when no devices exist', async () => {
		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.lastEvent).toBeUndefined();
	});

	it('should return empty signal when no sensors are triggered', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, false)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.hasCriticalAlert).toBe(false);
	});

	it('should map smoke sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('smoke');
		expect(signal.lastEvent?.severity).toBe(Severity.CRITICAL);
		expect(signal.lastEvent?.sourceDeviceId).toBe('d1');
	});

	it('should map CO sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.CARBON_MONOXIDE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('co');
	});

	it('should map leak sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.LEAK, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('water_leak');
	});

	it('should map gas sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.GAS, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('co');
	});

	it('should map motion sensor to warning severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.MOTION, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.lastEvent?.type).toBe('intrusion');
		expect(signal.lastEvent?.severity).toBe(Severity.WARNING);
	});

	it('should map occupancy sensor to warning severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.OCCUPANCY, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.lastEvent?.type).toBe('intrusion');
	});

	it('should map contact sensor to info severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.CONTACT, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.lastEvent?.type).toBe('entry_open');
		expect(signal.lastEvent?.severity).toBe(Severity.INFO);
	});

	it('should compute max severity across multiple sensors', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.CONTACT, true)]),
			createSensorDevice('d2', [createChannel(ChannelCategory.MOTION, true)]),
			createSensorDevice('d3', [createChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(3);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
	});

	it('should sum active alerts count correctly', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
			createSensorDevice('d2', [createChannel(ChannelCategory.LEAK, true)]),
			createSensorDevice('d3', [createChannel(ChannelCategory.MOTION, true)]),
			createSensorDevice('d4', [createChannel(ChannelCategory.CONTACT, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(4);
	});

	it('should select lastEvent deterministically (highest severity first, then device ID)', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d2', [createChannel(ChannelCategory.SMOKE, true)]),
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		// Both critical, d1 comes first alphabetically
		expect(signal.lastEvent?.sourceDeviceId).toBe('d1');
	});

	it('should ignore non-sensor devices', async () => {
		const device = new DeviceEntity();
		device.id = 'd1';
		device.category = DeviceCategory.GENERIC;
		device.channels = [createChannel(ChannelCategory.SMOKE, true)];

		devicesService.findAll.mockResolvedValue([device]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should ignore channels without DETECTED property', async () => {
		const channel = new ChannelEntity();
		channel.category = ChannelCategory.SMOKE;
		channel.properties = [createProperty(PropertyCategory.GENERIC, true)];

		devicesService.findAll.mockResolvedValue([createSensorDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should ignore channels with null property value', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, null)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should handle string "true" as detected', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, 'true')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should handle numeric 1 as detected', async () => {
		devicesService.findAll.mockResolvedValue([
			createSensorDevice('d1', [createChannel(ChannelCategory.SMOKE, 1)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should return empty signal on error (never throw)', async () => {
		devicesService.findAll.mockRejectedValue(new Error('DB error'));

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.hasCriticalAlert).toBe(false);
	});

	it('should ignore non-security channel categories', async () => {
		const channel = new ChannelEntity();
		channel.category = ChannelCategory.GENERIC;
		channel.properties = [createProperty(PropertyCategory.DETECTED, true)];

		devicesService.findAll.mockResolvedValue([createSensorDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});
});
