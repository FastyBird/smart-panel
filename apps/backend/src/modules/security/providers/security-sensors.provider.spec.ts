import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { DevicesService } from '../../devices/services/devices.service';
import { SecurityAlertType, Severity } from '../security.constants';

import { SecuritySensorsProvider } from './security-sensors.provider';

function createProperty(category: PropertyCategory, value: string | number | boolean | null): ChannelPropertyEntity {
	const prop = new ChannelPropertyEntity();
	prop.category = category;
	prop.value = value != null ? new PropertyValueState(value) : null;

	return prop;
}

function createChannel(category: ChannelCategory, detected: string | number | boolean | null): ChannelEntity {
	const channel = new ChannelEntity();
	channel.category = category;
	channel.properties = [createProperty(PropertyCategory.DETECTED, detected)];

	return channel;
}

function createDevice(id: string, channels: ChannelEntity[], category = DeviceCategory.GENERIC): DeviceEntity {
	const device = new DeviceEntity();
	device.id = id;
	device.category = category;
	device.channels = channels;

	return device;
}

describe('SecuritySensorsProvider', () => {
	let provider: SecuritySensorsProvider;
	let devicesService: { findAll: jest.Mock };

	beforeEach(async () => {
		devicesService = { findAll: jest.fn().mockResolvedValue([]) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [SecuritySensorsProvider, { provide: DevicesService, useValue: devicesService }],
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
		expect(signal.activeAlerts).toEqual([]);
	});

	it('should return empty signal when no sensors are triggered', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.SMOKE, false)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.activeAlerts).toEqual([]);
	});

	it('should map smoke sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)])]);

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
			createDevice('d1', [createChannel(ChannelCategory.CARBON_MONOXIDE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('co');
	});

	it('should map leak sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.LEAK, true)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('water_leak');
	});

	it('should map gas sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.GAS, true)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('gas');
	});

	it('should map motion sensor to warning severity', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.MOTION, true)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.lastEvent?.type).toBe('intrusion');
		expect(signal.lastEvent?.severity).toBe(Severity.WARNING);
	});

	it('should map occupancy sensor to warning severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.OCCUPANCY, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.lastEvent?.type).toBe('intrusion');
	});

	it('should map contact sensor to info severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.CONTACT, true)]),
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
			createDevice('d1', [createChannel(ChannelCategory.CONTACT, true)]),
			createDevice('d2', [createChannel(ChannelCategory.MOTION, true)]),
			createDevice('d3', [createChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(3);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
	});

	it('should sum active alerts count correctly', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d2', [createChannel(ChannelCategory.LEAK, true)]),
			createDevice('d3', [createChannel(ChannelCategory.MOTION, true)]),
			createDevice('d4', [createChannel(ChannelCategory.CONTACT, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(4);
	});

	it('should select lastEvent deterministically (highest severity first, then device ID)', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d2', [createChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		// Both critical, d1 comes first alphabetically by id
		expect(signal.lastEvent?.sourceDeviceId).toBe('d1');
	});

	it('should detect security channels on non-sensor devices', async () => {
		const device = new DeviceEntity();
		device.id = 'd1';
		device.category = DeviceCategory.GENERIC;
		device.channels = [createChannel(ChannelCategory.SMOKE, true)];

		devicesService.findAll.mockResolvedValue([device]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.SMOKE);
	});

	it('should ignore channels without DETECTED property', async () => {
		const channel = new ChannelEntity();
		channel.category = ChannelCategory.SMOKE;
		channel.properties = [createProperty(PropertyCategory.GENERIC, true)];

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should ignore channels with null property value', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.SMOKE, null)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should handle string "true" as detected', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, 'true')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should handle numeric 1 as detected', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.SMOKE, 1)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should return empty signal on error (never throw)', async () => {
		devicesService.findAll.mockRejectedValue(new Error('DB error'));

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.activeAlerts).toEqual([]);
	});

	it('should ignore non-security channel categories', async () => {
		const channel = new ChannelEntity();
		channel.category = ChannelCategory.GENERIC;
		channel.properties = [createProperty(PropertyCategory.DETECTED, true)];

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	// --- activeAlerts specific tests ---

	it('should emit activeAlerts with deterministic IDs', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d2', [createChannel(ChannelCategory.LEAK, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlerts).toHaveLength(2);

		const ids = (signal.activeAlerts ?? []).map((a) => a.id);
		expect(ids).toContain(`sensor:d1:${SecurityAlertType.SMOKE}`);
		expect(ids).toContain(`sensor:d2:${SecurityAlertType.WATER_LEAK}`);
	});

	it('should set acknowledged=false on all alerts', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)])]);

		const signal = await provider.getSignals();

		for (const alert of signal.activeAlerts ?? []) {
			expect(alert.acknowledged).toBe(false);
		}
	});

	it('should produce stable alert IDs across calls', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)])]);

		const signal1 = await provider.getSignals();
		const signal2 = await provider.getSignals();

		expect(signal1.activeAlerts?.[0].id).toBe(signal2.activeAlerts?.[0].id);
	});

	it('should include sourceDeviceId in alerts', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('dev-abc', [createChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlerts?.[0].sourceDeviceId).toBe('dev-abc');
	});

	it('should match activeAlertsCount to activeAlerts.length', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d2', [createChannel(ChannelCategory.MOTION, true)]),
			createDevice('d3', [createChannel(ChannelCategory.CONTACT, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(signal.activeAlerts?.length);
	});

	// --- Channel-based discovery tests ---

	it('should generate critical alert from thermostat device with smoke channel', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)], DeviceCategory.THERMOSTAT),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.SMOKE);
		expect(signal.activeAlerts?.[0].sourceDeviceId).toBe('d1');
	});

	it('should never generate alerts for environment-only channels', async () => {
		const tempChannel = new ChannelEntity();
		tempChannel.category = ChannelCategory.TEMPERATURE;
		tempChannel.properties = [createProperty(PropertyCategory.DETECTED, true)];

		const humidityChannel = new ChannelEntity();
		humidityChannel.category = ChannelCategory.HUMIDITY;
		humidityChannel.properties = [createProperty(PropertyCategory.DETECTED, true)];

		devicesService.findAll.mockResolvedValue([createDevice('d1', [tempChannel, humidityChannel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.activeAlerts).toEqual([]);
	});

	it('should only alert on security channels when device has mixed channels', async () => {
		const smokeChannel = createChannel(ChannelCategory.SMOKE, true);

		const tempChannel = new ChannelEntity();
		tempChannel.category = ChannelCategory.TEMPERATURE;
		tempChannel.properties = [createProperty(PropertyCategory.DETECTED, true)];

		devicesService.findAll.mockResolvedValue([createDevice('d1', [smokeChannel, tempChannel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.SMOKE);
	});

	it('should produce same alert ID regardless of device category', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)], DeviceCategory.SENSOR),
		]);
		const signal1 = await provider.getSignals();

		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createChannel(ChannelCategory.SMOKE, true)], DeviceCategory.THERMOSTAT),
		]);
		const signal2 = await provider.getSignals();

		expect(signal1.activeAlerts?.[0].id).toBe(signal2.activeAlerts?.[0].id);
		expect(signal1.activeAlerts?.[0].id).toBe(`sensor:d1:${SecurityAlertType.SMOKE}`);
	});
});
