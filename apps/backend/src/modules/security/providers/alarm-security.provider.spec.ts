import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { DevicesService } from '../../devices/services/devices.service';
import { AlarmState, ArmedState, SecurityAlertType, Severity } from '../security.constants';

import { AlarmSecurityProvider } from './alarm-security.provider';

function makeProperty(category: PropertyCategory, value: string | number | boolean | null) {
	return {
		id: `prop-${category}`,
		category,
		value: value != null ? { value } : null,
	};
}

function makeAlarmDevice(
	id: string,
	properties: ReturnType<typeof makeProperty>[],
	channelCategory: ChannelCategory = ChannelCategory.ALARM,
) {
	return {
		id,
		category: DeviceCategory.ALARM,
		channels: [
			{
				id: `channel-${id}`,
				category: channelCategory,
				properties,
			},
		],
	};
}

describe('AlarmSecurityProvider', () => {
	let provider: AlarmSecurityProvider;
	let devicesService: { findAll: jest.Mock };

	beforeEach(async () => {
		devicesService = { findAll: jest.fn().mockResolvedValue([]) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [AlarmSecurityProvider, { provide: DevicesService, useValue: devicesService }],
		}).compile();

		provider = module.get<AlarmSecurityProvider>(AlarmSecurityProvider);
	});

	it('should return key "alarm"', () => {
		expect(provider.getKey()).toBe('alarm');
	});

	it('should return empty signal when no alarm devices exist', async () => {
		devicesService.findAll.mockResolvedValue([{ id: 'dev-1', category: DeviceCategory.LIGHTING, channels: [] }]);

		const signal = await provider.getSignals();

		expect(signal).toEqual({});
	});

	it('should map armedState from state property', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.STATE, 'armed_away')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.armedState).toBe(ArmedState.ARMED_AWAY);
	});

	it('should return armedState null when state property missing', async () => {
		devicesService.findAll.mockResolvedValue([makeAlarmDevice('dev-1', [])]);

		const signal = await provider.getSignals();

		expect(signal.armedState).toBeNull();
	});

	it('should prefer alarm_state over triggered', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [
				makeProperty(PropertyCategory.ALARM_STATE, 'pending'),
				makeProperty(PropertyCategory.TRIGGERED, true),
			]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.PENDING);
	});

	it('should use triggered=true when alarm_state missing', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.TRIGGERED, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.TRIGGERED);
	});

	it('should use triggered="true" string when alarm_state missing', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.TRIGGERED, 'true')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.TRIGGERED);
	});

	it('should default alarmState to idle when no alarm_state or triggered', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.STATE, 'disarmed')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.IDLE);
	});

	it('should compute severity critical when triggered', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ALARM_STATE, 'triggered')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should compute severity critical when tampered', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.TAMPERED, true)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
	});

	it('should compute severity warning when fault > 0', async () => {
		devicesService.findAll.mockResolvedValue([makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.FAULT, 3)])]);

		const signal = await provider.getSignals();

		expect(signal.highestSeverity).toBe(Severity.WARNING);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.activeAlertsCount).toBe(1);
	});

	it('should compute severity critical when triggered property is true even if alarm_state is pending', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [
				makeProperty(PropertyCategory.ALARM_STATE, 'pending'),
				makeProperty(PropertyCategory.TRIGGERED, true),
			]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.PENDING);
		expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		expect(signal.hasCriticalAlert).toBe(true);
	});

	it('should compute severity warning when active is false', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ACTIVE, false)]),
		]);

		const signal = await provider.getSignals();

		expect(signal.highestSeverity).toBe(Severity.WARNING);
	});

	it('should compute severity info when all normal', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [
				makeProperty(PropertyCategory.STATE, 'disarmed'),
				makeProperty(PropertyCategory.ALARM_STATE, 'idle'),
				makeProperty(PropertyCategory.ACTIVE, true),
				makeProperty(PropertyCategory.FAULT, 0),
			]),
		]);

		const signal = await provider.getSignals();

		expect(signal.highestSeverity).toBe(Severity.INFO);
		expect(signal.hasCriticalAlert).toBe(false);
		expect(signal.activeAlertsCount).toBe(0);
	});

	describe('multi-device behavior', () => {
		it('should use triggered from any device as dominant alarmState', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ALARM_STATE, 'idle')]),
				makeAlarmDevice('dev-2', [makeProperty(PropertyCategory.ALARM_STATE, 'triggered')]),
			]);

			const signal = await provider.getSignals();

			expect(signal.alarmState).toBe(AlarmState.TRIGGERED);
		});

		it('should take max severity across devices', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.FAULT, 1)]),
				makeAlarmDevice('dev-2', [makeProperty(PropertyCategory.TAMPERED, true)]),
			]);

			const signal = await provider.getSignals();

			expect(signal.highestSeverity).toBe(Severity.CRITICAL);
		});

		it('should use armedState from first device by sorted id', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-b', [makeProperty(PropertyCategory.STATE, 'armed_home')]),
				makeAlarmDevice('dev-a', [makeProperty(PropertyCategory.STATE, 'armed_away')]),
			]);

			const signal = await provider.getSignals();

			expect(signal.armedState).toBe(ArmedState.ARMED_AWAY);
		});

		it('should pick most urgent alarmState across devices (pending > idle)', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ALARM_STATE, 'idle')]),
				makeAlarmDevice('dev-2', [makeProperty(PropertyCategory.ALARM_STATE, 'pending')]),
			]);

			const signal = await provider.getSignals();

			expect(signal.alarmState).toBe(AlarmState.PENDING);
		});

		it('should count activeAlertsCount per device with issues', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.FAULT, 1)]),
				makeAlarmDevice('dev-2', [makeProperty(PropertyCategory.TAMPERED, true)]),
				makeAlarmDevice('dev-3', [makeProperty(PropertyCategory.ALARM_STATE, 'idle')]),
			]);

			const signal = await provider.getSignals();

			expect(signal.activeAlertsCount).toBe(2);
		});
	});

	describe('lastEvent', () => {
		it('should pass through valid last_event property', async () => {
			const event = JSON.stringify({
				type: 'intrusion',
				timestamp: '2025-06-15T12:00:00Z',
				sourceDeviceId: 'sensor-1',
				severity: 'critical',
			});

			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.LAST_EVENT, event)]),
			]);

			const signal = await provider.getSignals();

			expect(signal.lastEvent).toBeDefined();
			expect(signal.lastEvent?.type).toBe('intrusion');
			expect(signal.lastEvent?.timestamp).toBe('2025-06-15T12:00:00.000Z');
		});

		it('should ignore invalid last_event JSON', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.LAST_EVENT, 'not-json')]),
			]);

			const signal = await provider.getSignals();

			expect(signal.lastEvent).toBeUndefined();
		});

		it('should handle numeric timestamp in seconds (Unix epoch)', async () => {
			// 1718449200 seconds = 2024-06-15T11:00:00.000Z
			const event = JSON.stringify({ type: 'intrusion', timestamp: 1718449200 });

			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.LAST_EVENT, event)]),
			]);

			const signal = await provider.getSignals();

			expect(signal.lastEvent).toBeDefined();
			expect(signal.lastEvent?.timestamp).toBe('2024-06-15T11:00:00.000Z');
		});

		it('should handle numeric timestamp in milliseconds', async () => {
			// 1718449200000 ms = 2024-06-15T11:00:00.000Z
			const event = JSON.stringify({ type: 'intrusion', timestamp: 1718449200000 });

			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.LAST_EVENT, event)]),
			]);

			const signal = await provider.getSignals();

			expect(signal.lastEvent).toBeDefined();
			expect(signal.lastEvent?.timestamp).toBe('2024-06-15T11:00:00.000Z');
		});

		it('should discard invalid severity in last_event', async () => {
			const event = JSON.stringify({
				type: 'intrusion',
				timestamp: '2025-06-15T12:00:00Z',
				severity: 'banana',
			});

			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.LAST_EVENT, event)]),
			]);

			const signal = await provider.getSignals();

			expect(signal.lastEvent).toBeDefined();
			expect(signal.lastEvent?.severity).toBeUndefined();
		});

		it('should pick newest lastEvent across devices', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [
					makeProperty(PropertyCategory.LAST_EVENT, JSON.stringify({ type: 'old', timestamp: '2025-01-01T00:00:00Z' })),
				]),
				makeAlarmDevice('dev-2', [
					makeProperty(PropertyCategory.LAST_EVENT, JSON.stringify({ type: 'new', timestamp: '2025-06-15T12:00:00Z' })),
				]),
			]);

			const signal = await provider.getSignals();

			expect(signal.lastEvent?.type).toBe('new');
		});
	});

	it('should never throw, return empty signal on error', async () => {
		devicesService.findAll.mockRejectedValue(new Error('DB connection failed'));

		const signal = await provider.getSignals();

		expect(signal).toEqual({});
	});

	it('should handle device with no alarm channel gracefully', async () => {
		devicesService.findAll.mockResolvedValue([
			{
				id: 'dev-1',
				category: DeviceCategory.ALARM,
				channels: [{ id: 'ch-1', category: ChannelCategory.GENERIC, properties: [] }],
			},
		]);

		const signal = await provider.getSignals();

		expect(signal.armedState).toBeNull();
		expect(signal.alarmState).toBe(AlarmState.IDLE);
		expect(signal.highestSeverity).toBe(Severity.INFO);
	});

	it('should handle invalid armedState value gracefully', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.STATE, 'unknown_state')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.armedState).toBeNull();
	});

	it('should fall back to triggered when alarm_state has invalid value', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [
				makeProperty(PropertyCategory.ALARM_STATE, 'bogus_value'),
				makeProperty(PropertyCategory.TRIGGERED, true),
			]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.TRIGGERED);
	});

	it('should fall back to idle when alarm_state has invalid value and not triggered', async () => {
		devicesService.findAll.mockResolvedValue([
			makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ALARM_STATE, 'bogus_value')]),
		]);

		const signal = await provider.getSignals();

		expect(signal.alarmState).toBe(AlarmState.IDLE);
	});

	// --- activeAlerts specific tests ---

	describe('activeAlerts', () => {
		it('should emit intrusion alert when triggered', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ALARM_STATE, 'triggered')]),
			]);

			const signal = await provider.getSignals();

			expect(signal.activeAlerts).toBeDefined();
			expect(signal.activeAlerts).toHaveLength(1);

			const alert = signal.activeAlerts?.[0];
			expect(alert?.id).toBe(`alarm:dev-1:${SecurityAlertType.INTRUSION}`);
			expect(alert?.type).toBe(SecurityAlertType.INTRUSION);
			expect(alert?.severity).toBe(Severity.CRITICAL);
			expect(alert?.acknowledged).toBe(false);
		});

		it('should emit tamper alert when tampered', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.TAMPERED, true)]),
			]);

			const signal = await provider.getSignals();

			const tamperAlerts = (signal.activeAlerts ?? []).filter((a) => a.type === SecurityAlertType.TAMPER);
			expect(tamperAlerts).toHaveLength(1);
			expect(tamperAlerts[0].id).toBe(`alarm:dev-1:${SecurityAlertType.TAMPER}`);
			expect(tamperAlerts[0].severity).toBe(Severity.CRITICAL);
		});

		it('should emit fault alert when fault > 0', async () => {
			devicesService.findAll.mockResolvedValue([makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.FAULT, 3)])]);

			const signal = await provider.getSignals();

			const faultAlerts = (signal.activeAlerts ?? []).filter((a) => a.type === SecurityAlertType.FAULT);
			expect(faultAlerts).toHaveLength(1);
			expect(faultAlerts[0].id).toBe(`alarm:dev-1:${SecurityAlertType.FAULT}`);
			expect(faultAlerts[0].severity).toBe(Severity.WARNING);
		});

		it('should emit fault alert when active is false', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ACTIVE, false)]),
			]);

			const signal = await provider.getSignals();

			const faultAlerts = (signal.activeAlerts ?? []).filter((a) => a.type === SecurityAlertType.FAULT);
			expect(faultAlerts).toHaveLength(1);
		});

		it('should emit no alerts when all normal', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [
					makeProperty(PropertyCategory.STATE, 'disarmed'),
					makeProperty(PropertyCategory.ALARM_STATE, 'idle'),
					makeProperty(PropertyCategory.ACTIVE, true),
					makeProperty(PropertyCategory.FAULT, 0),
				]),
			]);

			const signal = await provider.getSignals();

			expect(signal.activeAlerts).toEqual([]);
		});

		it('should emit multiple alerts for multiple exception states on same device', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [
					makeProperty(PropertyCategory.ALARM_STATE, 'triggered'),
					makeProperty(PropertyCategory.TAMPERED, true),
				]),
			]);

			const signal = await provider.getSignals();

			expect(signal.activeAlerts?.length).toBeGreaterThanOrEqual(2);

			const types = (signal.activeAlerts ?? []).map((a) => a.type);
			expect(types).toContain(SecurityAlertType.INTRUSION);
			expect(types).toContain(SecurityAlertType.TAMPER);
		});

		it('should produce deterministic alert IDs', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-1', [makeProperty(PropertyCategory.ALARM_STATE, 'triggered')]),
			]);

			const signal1 = await provider.getSignals();
			const signal2 = await provider.getSignals();

			expect(signal1.activeAlerts?.[0].id).toBe(signal2.activeAlerts?.[0].id);
		});

		it('should include sourceDeviceId in alerts', async () => {
			devicesService.findAll.mockResolvedValue([
				makeAlarmDevice('dev-abc', [makeProperty(PropertyCategory.TAMPERED, true)]),
			]);

			const signal = await provider.getSignals();

			expect(signal.activeAlerts?.[0].sourceDeviceId).toBe('dev-abc');
		});
	});
});
