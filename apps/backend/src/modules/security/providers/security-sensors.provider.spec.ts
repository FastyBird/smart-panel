import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { DevicesService } from '../../devices/services/devices.service';
import { ArmedState, SecurityAlertType, Severity } from '../security.constants';
import { DetectionRulesLoaderService } from '../spec/detection-rules-loader.service';
import { ResolvedSensorRule } from '../spec/detection-rules.types';

import { SecuritySensorsProvider } from './security-sensors.provider';

function createProperty(category: PropertyCategory, value: string | number | boolean | null): ChannelPropertyEntity {
	const prop = new ChannelPropertyEntity();
	prop.category = category;
	prop.value = value != null ? new PropertyValueState(value) : null;

	return prop;
}

function createChannel(category: ChannelCategory, properties: ChannelPropertyEntity[]): ChannelEntity {
	const channel = new ChannelEntity();
	channel.category = category;
	channel.properties = properties;

	return channel;
}

function createDetectedChannel(category: ChannelCategory, detected: string | number | boolean | null): ChannelEntity {
	return createChannel(category, [createProperty(PropertyCategory.DETECTED, detected)]);
}

function createDevice(id: string, channels: ChannelEntity[], category = DeviceCategory.GENERIC): DeviceEntity {
	const device = new DeviceEntity();
	device.id = id;
	device.category = category;
	device.channels = channels;

	return device;
}

/**
 * Build a default rules map matching the builtin YAML for testing.
 */
function buildDefaultRules(): Map<string, ResolvedSensorRule> {
	const rules = new Map<string, ResolvedSensorRule>();

	rules.set(ChannelCategory.SMOKE, {
		channelCategory: ChannelCategory.SMOKE,
		alertType: SecurityAlertType.SMOKE,
		severity: Severity.CRITICAL,
		properties: [{ property: PropertyCategory.DETECTED, operator: 'eq', value: true }],
	});

	rules.set(ChannelCategory.CARBON_MONOXIDE, {
		channelCategory: ChannelCategory.CARBON_MONOXIDE,
		alertType: SecurityAlertType.CO,
		severity: Severity.CRITICAL,
		properties: [
			{ property: PropertyCategory.DETECTED, operator: 'eq', value: true },
			{ property: PropertyCategory.CONCENTRATION, operator: 'gt', value: 35 },
		],
	});

	rules.set(ChannelCategory.LEAK, {
		channelCategory: ChannelCategory.LEAK,
		alertType: SecurityAlertType.WATER_LEAK,
		severity: Severity.CRITICAL,
		properties: [{ property: PropertyCategory.DETECTED, operator: 'eq', value: true }],
	});

	rules.set(ChannelCategory.GAS, {
		channelCategory: ChannelCategory.GAS,
		alertType: SecurityAlertType.GAS,
		severity: Severity.CRITICAL,
		properties: [
			{ property: PropertyCategory.DETECTED, operator: 'eq', value: true },
			{ property: PropertyCategory.STATUS, operator: 'in', value: ['warning', 'alarm'] },
		],
	});

	rules.set(ChannelCategory.MOTION, {
		channelCategory: ChannelCategory.MOTION,
		alertType: SecurityAlertType.INTRUSION,
		severity: Severity.WARNING,
		properties: [{ property: PropertyCategory.DETECTED, operator: 'eq', value: true }],
	});

	rules.set(ChannelCategory.OCCUPANCY, {
		channelCategory: ChannelCategory.OCCUPANCY,
		alertType: SecurityAlertType.INTRUSION,
		severity: Severity.WARNING,
		properties: [{ property: PropertyCategory.DETECTED, operator: 'eq', value: true }],
	});

	rules.set(ChannelCategory.CONTACT, {
		channelCategory: ChannelCategory.CONTACT,
		alertType: SecurityAlertType.ENTRY_OPEN,
		severity: Severity.INFO,
		properties: [{ property: PropertyCategory.DETECTED, operator: 'eq', value: true }],
	});

	return rules;
}

describe('SecuritySensorsProvider', () => {
	let provider: SecuritySensorsProvider;
	let devicesService: { findAll: jest.Mock };
	let rulesLoader: { getSensorRules: jest.Mock };

	beforeEach(async () => {
		devicesService = { findAll: jest.fn().mockResolvedValue([]) };
		rulesLoader = { getSensorRules: jest.fn().mockReturnValue(buildDefaultRules()) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecuritySensorsProvider,
				{ provide: DevicesService, useValue: devicesService },
				{ provide: DetectionRulesLoaderService, useValue: rulesLoader },
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
		expect(signal.activeAlerts).toEqual([]);
	});

	it('should return empty signal when no sensors are triggered', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, false)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.activeAlerts).toEqual([]);
	});

	it('should map smoke sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
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
			createDevice('d1', [createDetectedChannel(ChannelCategory.CARBON_MONOXIDE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('co');
	});

	it('should map leak sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createDetectedChannel(ChannelCategory.LEAK, true)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('water_leak');
	});

	it('should map gas sensor to critical severity', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createDetectedChannel(ChannelCategory.GAS, true)])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.lastEvent?.type).toBe('gas');
	});

	it('should map motion sensor to info severity when disarmed (no context)', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.MOTION, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.lastEvent?.type).toBe('intrusion');
		expect(signal.lastEvent?.severity).toBe(Severity.INFO);
	});

	it('should map motion sensor to warning severity when armed', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.MOTION, true)]),
		]);

		const signal = await provider.getSignals({ armedState: ArmedState.ARMED_AWAY });

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.lastEvent?.type).toBe('intrusion');
		expect(signal.lastEvent?.severity).toBe(Severity.WARNING);
	});

	it('should map occupancy sensor to info severity when disarmed (no context)', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.OCCUPANCY, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.lastEvent?.type).toBe('intrusion');
	});

	it('should map occupancy sensor to warning severity when armed', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.OCCUPANCY, true)]),
		]);

		const signal = await provider.getSignals({ armedState: ArmedState.ARMED_HOME });

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.lastEvent?.type).toBe('intrusion');
	});

	it('should map contact sensor to info severity', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.CONTACT, true)]),
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
			createDevice('d1', [createDetectedChannel(ChannelCategory.CONTACT, true)]),
			createDevice('d2', [createDetectedChannel(ChannelCategory.MOTION, true)]),
			createDevice('d3', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(3);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
	});

	it('should sum active alerts count correctly', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d2', [createDetectedChannel(ChannelCategory.LEAK, true)]),
			createDevice('d3', [createDetectedChannel(ChannelCategory.MOTION, true)]),
			createDevice('d4', [createDetectedChannel(ChannelCategory.CONTACT, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(4);
	});

	it('should select lastEvent deterministically (highest severity first, then device ID)', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d2', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		// Both critical, d1 comes first alphabetically by id
		expect(signal.lastEvent?.sourceDeviceId).toBe('d1');
	});

	it('should detect security channels on non-sensor devices', async () => {
		const device = new DeviceEntity();
		device.id = 'd1';
		device.category = DeviceCategory.GENERIC;
		device.channels = [createDetectedChannel(ChannelCategory.SMOKE, true)];

		devicesService.findAll.mockResolvedValue([device]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.SMOKE);
	});

	it('should ignore channels without matching property', async () => {
		const channel = new ChannelEntity();
		channel.category = ChannelCategory.SMOKE;
		channel.properties = [createProperty(PropertyCategory.GENERIC, true)];

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should ignore channels with null property value', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, null)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should handle string "true" as detected', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, 'true')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should handle numeric 1 as detected', async () => {
		devicesService.findAll.mockResolvedValue([createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, 1)])]);

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
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d2', [createDetectedChannel(ChannelCategory.LEAK, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlerts).toHaveLength(2);

		const ids = (signal.activeAlerts ?? []).map((a) => a.id);
		expect(ids).toContain(`sensor:d1:${SecurityAlertType.SMOKE}`);
		expect(ids).toContain(`sensor:d2:${SecurityAlertType.WATER_LEAK}`);
	});

	it('should set acknowledged=false on all alerts', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		for (const alert of signal.activeAlerts ?? []) {
			expect(alert.acknowledged).toBe(false);
		}
	});

	it('should produce stable alert IDs across calls', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal1 = await provider.getSignals();
		const signal2 = await provider.getSignals();

		expect(signal1.activeAlerts?.[0].id).toBe(signal2.activeAlerts?.[0].id);
	});

	it('should include sourceDeviceId in alerts', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('dev-abc', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlerts?.[0].sourceDeviceId).toBe('dev-abc');
	});

	it('should match activeAlertsCount to activeAlerts.length', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
			createDevice('d2', [createDetectedChannel(ChannelCategory.MOTION, true)]),
			createDevice('d3', [createDetectedChannel(ChannelCategory.CONTACT, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(signal.activeAlerts?.length);
	});

	// --- Channel-based discovery tests ---

	it('should generate critical alert from thermostat device with smoke channel', async () => {
		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)], DeviceCategory.THERMOSTAT),
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
		const smokeChannel = createDetectedChannel(ChannelCategory.SMOKE, true);

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
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)], DeviceCategory.SENSOR),
		]);
		const signal1 = await provider.getSignals();

		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)], DeviceCategory.THERMOSTAT),
		]);
		const signal2 = await provider.getSignals();

		expect(signal1.activeAlerts?.[0].id).toBe(signal2.activeAlerts?.[0].id);
		expect(signal1.activeAlerts?.[0].id).toBe(`sensor:d1:${SecurityAlertType.SMOKE}`);
	});

	// --- Rule-based detection: multi-property fallback ---

	it('should trigger CO alert via concentration threshold when detected is absent', async () => {
		// CO channel with only concentration property (no "detected" property)
		const channel = createChannel(ChannelCategory.CARBON_MONOXIDE, [
			createProperty(PropertyCategory.CONCENTRATION, 50),
		]);

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.CO);
		expect(signal.hasCriticalAlert).toBe(true);
	});

	it('should NOT trigger CO alert when concentration is below threshold', async () => {
		const channel = createChannel(ChannelCategory.CARBON_MONOXIDE, [
			createProperty(PropertyCategory.CONCENTRATION, 20),
		]);

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should prefer detected=true over concentration threshold (priority order)', async () => {
		// Both properties present: detected=true should win (it comes first in rules)
		const channel = createChannel(ChannelCategory.CARBON_MONOXIDE, [
			createProperty(PropertyCategory.DETECTED, true),
			createProperty(PropertyCategory.CONCENTRATION, 20), // Below threshold
		]);

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.CO);
	});

	it('should trigger gas alert via status "in" operator', async () => {
		const channel = createChannel(ChannelCategory.GAS, [createProperty(PropertyCategory.STATUS, 'alarm')]);

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(1);
		expect(signal.activeAlerts?.[0].type).toBe(SecurityAlertType.GAS);
	});

	it('should NOT trigger gas alert when status is not in the list', async () => {
		const channel = createChannel(ChannelCategory.GAS, [createProperty(PropertyCategory.STATUS, 'normal')]);

		devicesService.findAll.mockResolvedValue([createDevice('d1', [channel])]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
	});

	it('should return empty signal when rules map is empty', async () => {
		rulesLoader.getSensorRules.mockReturnValue(new Map());

		devicesService.findAll.mockResolvedValue([
			createDevice('d1', [createDetectedChannel(ChannelCategory.SMOKE, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.activeAlertsCount).toBe(0);
		expect(signal.activeAlerts).toEqual([]);
	});
});
