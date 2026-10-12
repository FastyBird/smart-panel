/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';

import {
	NotificationActionType,
	NotificationKind,
	NotificationSeverity,
} from '../../notifications/notifications.constants';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { StorageService } from '../../storage/services/storage.service';
import { SecurityAlertModel } from '../models/security-status.model';
import {
	AlarmState,
	ArmedState,
	SECURITY_MODULE_NAME,
	SecurityAlertType,
	SecurityEventType,
	Severity,
} from '../security.constants';

import { SecurityEventsService } from './security-events.service';

describe('SecurityEventsService', () => {
	let service: SecurityEventsService;
	let influxDb: jest.Mocked<StorageService>;
	let notifications: { notify: jest.Mock; resolve: jest.Mock };

	const makeAlert = (overrides: Partial<SecurityAlertModel> = {}): SecurityAlertModel => {
		const alert = new SecurityAlertModel();
		alert.id = overrides.id ?? 'sensor:dev1:smoke';
		alert.type = overrides.type ?? SecurityAlertType.SMOKE;
		alert.severity = overrides.severity ?? Severity.CRITICAL;
		alert.timestamp = overrides.timestamp ?? '2025-01-18T12:00:00Z';
		alert.acknowledged = overrides.acknowledged ?? false;
		alert.sourceDeviceId = overrides.sourceDeviceId ?? 'dev1';

		return alert;
	};

	beforeEach(async () => {
		notifications = {
			notify: jest.fn().mockResolvedValue(null),
			resolve: jest.fn().mockResolvedValue(true),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecurityEventsService,
				{
					provide: StorageService,
					useValue: {
						isConnected: jest.fn().mockReturnValue(true),
						registerSchema: jest.fn(),
						writePoints: jest.fn().mockResolvedValue(undefined),
						query: jest.fn().mockResolvedValue([]),
					},
				},
				{ provide: NotificationsService, useValue: notifications },
			],
		}).compile();

		service = module.get<SecurityEventsService>(SecurityEventsService);
		influxDb = module.get(StorageService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('findRecent', () => {
		it('should return empty array when not connected', async () => {
			influxDb.isConnected.mockReturnValue(false);
			const result = await service.findRecent();
			expect(result).toEqual([]);
		});

		it('should query InfluxDB with default limit', async () => {
			await service.findRecent();
			expect(influxDb.query).toHaveBeenCalled();
			const queryArg = influxDb.query.mock.calls[0][0];
			expect(queryArg).toContain('LIMIT 50');
		});

		it('should clamp limit to max 200', async () => {
			await service.findRecent({ limit: 500 });
			const queryArg = influxDb.query.mock.calls[0][0];
			expect(queryArg).toContain('LIMIT 200');
		});

		it('should apply severity filter', async () => {
			await service.findRecent({ severity: Severity.CRITICAL });
			const queryArg = influxDb.query.mock.calls[0][0];
			expect(queryArg).toContain("severity = 'critical'");
		});

		it('should apply type filter', async () => {
			await service.findRecent({ type: SecurityEventType.ALERT_RAISED });
			const queryArg = influxDb.query.mock.calls[0][0];
			expect(queryArg).toContain("eventType = 'alert_raised'");
		});
	});

	describe('recordAlertTransitions', () => {
		it('should not generate events on first call (seed)', async () => {
			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);
			expect(influxDb.writePoints).not.toHaveBeenCalled();
		});

		it('should generate alert_raised when new alert appears', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(influxDb.writePoints).toHaveBeenCalled();
			const points = influxDb.writePoints.mock.calls[0][0];
			expect(points).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						measurement: 'security_event',
						tags: expect.objectContaining({
							eventType: SecurityEventType.ALERT_RAISED,
						}),
						fields: expect.objectContaining({
							alertId: 'sensor:dev1:smoke',
						}),
					}),
				]),
			);
		});

		it('should generate alert_resolved when alert disappears', async () => {
			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			expect(influxDb.writePoints).toHaveBeenCalled();
			const points = influxDb.writePoints.mock.calls[0][0];
			expect(points).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						tags: expect.objectContaining({
							eventType: SecurityEventType.ALERT_RESOLVED,
						}),
						fields: expect.objectContaining({
							alertId: 'sensor:dev1:smoke',
						}),
					}),
				]),
			);
		});

		it('should generate armed_state_changed event', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([], ArmedState.ARMED_AWAY, AlarmState.IDLE);

			expect(influxDb.writePoints).toHaveBeenCalled();
			const points = influxDb.writePoints.mock.calls[0][0];
			expect(points).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						tags: expect.objectContaining({
							eventType: SecurityEventType.ARMED_STATE_CHANGED,
						}),
					}),
				]),
			);
		});

		it('should generate alarm_state_changed event', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.TRIGGERED);

			expect(influxDb.writePoints).toHaveBeenCalled();
			const points = influxDb.writePoints.mock.calls[0][0];
			expect(points).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						tags: expect.objectContaining({
							eventType: SecurityEventType.ALARM_STATE_CHANGED,
							severity: Severity.CRITICAL,
						}),
					}),
				]),
			);
		});

		it('should not generate events when nothing changed', async () => {
			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(influxDb.writePoints).not.toHaveBeenCalled();
		});

		it('should raise a critical notification when a new alert appears', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			const alert = makeAlert({ id: 'sensor:dev1:smoke', type: SecurityAlertType.SMOKE, sourceDeviceId: 'dev1' });
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.notify).toHaveBeenCalledWith({
				source: SECURITY_MODULE_NAME,
				kind: NotificationKind.ISSUE,
				key: 'alert:sensor:dev1:smoke',
				severity: NotificationSeverity.CRITICAL,
				title: 'Security alert: smoke',
				actions: [{ type: NotificationActionType.LINK, label: 'Open security', url: '/security', primary: true }],
				data: { alert_type: SecurityAlertType.SMOKE, source_device_id: 'dev1' },
			});
		});

		it('should fall back to a null source_device_id when the alert carries none', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			const alert = new SecurityAlertModel();
			alert.id = 'sensor:dev2:tamper';
			alert.type = SecurityAlertType.TAMPER;
			alert.severity = Severity.WARNING;
			alert.timestamp = '2025-01-18T12:00:00Z';
			alert.acknowledged = false;
			// sourceDeviceId intentionally left undefined - not every alert originates from a device.

			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.notify).toHaveBeenCalledWith(
				expect.objectContaining({
					data: { alert_type: SecurityAlertType.TAMPER, source_device_id: null },
				}),
			);
		});

		it('should resolve the notification when an alert disappears', async () => {
			const alert = makeAlert({ id: 'sensor:dev1:smoke' });
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.resolve).toHaveBeenCalledWith(SECURITY_MODULE_NAME, 'alert:sensor:dev1:smoke');
		});

		it('should log and swallow a resolve failure without throwing', async () => {
			notifications.resolve.mockRejectedValue(new Error('db is down'));

			const alert = makeAlert({ id: 'sensor:dev1:smoke' });
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			await expect(service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE)).resolves.toBeUndefined();
		});

		it('should retry a failed resolution on a later poll', async () => {
			const alert = makeAlert({ id: 'sensor:dev1:smoke' });
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			notifications.resolve.mockRejectedValueOnce(new Error('db is down'));
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.resolve).toHaveBeenCalledTimes(1);

			// Nothing changed since the last poll - the alert is still gone - but the earlier
			// resolution never actually landed, so this poll must retry it.
			notifications.resolve.mockResolvedValueOnce(true);
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.resolve).toHaveBeenCalledTimes(2);
			expect(notifications.resolve).toHaveBeenNthCalledWith(2, SECURITY_MODULE_NAME, 'alert:sensor:dev1:smoke');
		});

		it('should not retry a pending resolution once the same alert is active again', async () => {
			const alert = makeAlert({ id: 'sensor:dev1:smoke' });
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			notifications.resolve.mockRejectedValueOnce(new Error('db is down'));
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.resolve).toHaveBeenCalledTimes(1);

			// The alert re-triggers before the earlier resolution was retried - it must be
			// raised again, not silently resolved out from under itself.
			notifications.notify.mockClear();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(notifications.resolve).toHaveBeenCalledTimes(1);
			expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ key: 'alert:sensor:dev1:smoke' }));
		});
	});

	describe('recordAcknowledgement', () => {
		it('should write alert_acknowledged point to InfluxDB', async () => {
			await service.recordAcknowledgement('sensor:dev1:smoke', 'smoke', 'dev1', Severity.CRITICAL);

			expect(influxDb.writePoints).toHaveBeenCalled();
			const points = influxDb.writePoints.mock.calls[0][0];
			expect(points[0]).toEqual(
				expect.objectContaining({
					measurement: 'security_event',
					tags: expect.objectContaining({
						eventType: SecurityEventType.ALERT_ACKNOWLEDGED,
						severity: Severity.CRITICAL,
					}),
					fields: expect.objectContaining({
						alertId: 'sensor:dev1:smoke',
						alertType: 'smoke',
						sourceDeviceId: 'dev1',
					}),
				}),
			);
		});

		it('should not write when disconnected', async () => {
			influxDb.isConnected.mockReturnValue(false);
			await service.recordAcknowledgement('sensor:dev1:smoke', 'smoke', 'dev1', Severity.CRITICAL);
			expect(influxDb.writePoints).not.toHaveBeenCalled();
		});
	});
});
