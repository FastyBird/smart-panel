/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { SecurityAlertModel, SecurityStatusModel } from '../models/security-status.model';
import { SecurityAlertType, Severity } from '../security.constants';

import { SecurityAggregatorService } from './security-aggregator.service';
import { SecurityAlertAckService } from './security-alert-ack.service';
import { SecurityEventsService } from './security-events.service';
import { SecurityService } from './security.service';

function makeAlert(id: string, timestamp: string, severity: Severity = Severity.WARNING): SecurityAlertModel {
	const alert = new SecurityAlertModel();
	alert.id = id;
	alert.type = SecurityAlertType.SMOKE;
	alert.severity = severity;
	alert.timestamp = timestamp;
	alert.acknowledged = false;

	return alert;
}

function makeStatus(alerts: SecurityAlertModel[]): SecurityStatusModel {
	const status = new SecurityStatusModel();
	status.armedState = null;
	status.alarmState = null;
	status.highestSeverity = Severity.INFO;
	status.activeAlertsCount = alerts.length;
	status.hasCriticalAlert = false;
	status.activeAlerts = alerts;

	return status;
}

describe('SecurityService', () => {
	let service: SecurityService;
	let aggregator: jest.Mocked<SecurityAggregatorService>;
	let ackService: jest.Mocked<SecurityAlertAckService>;
	let eventsService: jest.Mocked<SecurityEventsService>;
	let eventEmitter: jest.Mocked<EventEmitter2>;

	beforeEach(() => {
		aggregator = {
			aggregate: jest.fn(),
		} as any;

		ackService = {
			findByIds: jest.fn().mockResolvedValue([]),
			acknowledge: jest.fn(),
			acknowledgeAll: jest.fn(),
			resetAcknowledgement: jest.fn(),
			updateLastEventAt: jest.fn(),
			cleanupStale: jest.fn(),
		} as any;

		eventsService = {
			recordAlertTransitions: jest.fn(),
			recordAcknowledgement: jest.fn(),
		} as any;

		eventEmitter = {
			emit: jest.fn(),
		} as any;

		service = new SecurityService(aggregator, ackService, eventsService, eventEmitter);
	});

	describe('getStatus', () => {
		it('should return status without ack processing when no alerts', async () => {
			aggregator.aggregate.mockResolvedValue(makeStatus([]));

			const result = await service.getStatus();
			expect(result.activeAlerts).toHaveLength(0);
			expect(ackService.findByIds).not.toHaveBeenCalled();
		});

		it('should apply acknowledged=true from stored ack records', async () => {
			const alert = makeAlert('sensor:dev1:smoke', '2025-01-01T00:00:00Z');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			const ackRecord = {
				id: 'sensor:dev1:smoke',
				acknowledged: true,
				acknowledgedAt: new Date('2025-01-01'),
				lastEventAt: new Date('2025-01-01'),
				updatedAt: new Date(),
			} as SecurityAlertAckEntity;
			ackService.findByIds.mockResolvedValue([ackRecord]);

			const result = await service.getStatus();
			expect(result.activeAlerts[0].acknowledged).toBe(true);
		});

		it('should show acknowledged=false when alert timestamp is newer than stored lastEventAt', async () => {
			const alert = makeAlert('sensor:dev1:smoke', '2025-01-02T00:00:00Z');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			const ackRecord = {
				id: 'sensor:dev1:smoke',
				acknowledged: true,
				acknowledgedAt: new Date('2025-01-01'),
				lastEventAt: new Date('2025-01-01'),
				updatedAt: new Date(),
			} as SecurityAlertAckEntity;
			ackService.findByIds.mockResolvedValue([ackRecord]);

			const result = await service.getStatus();
			expect(result.activeAlerts[0].acknowledged).toBe(false);
			// getStatus is now read-only — no resetAcknowledgement call
			expect(ackService.resetAcknowledgement).not.toHaveBeenCalled();
		});

		it('should apply stored ack state for alerts with invalid timestamps', async () => {
			const alert = makeAlert('sensor:dev1:smoke', 'not-a-date');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			const ackRecord = {
				id: 'sensor:dev1:smoke',
				acknowledged: true,
				acknowledgedAt: new Date('2025-01-01'),
				lastEventAt: null,
				updatedAt: new Date(),
			} as SecurityAlertAckEntity;
			ackService.findByIds.mockResolvedValue([ackRecord]);

			const result = await service.getStatus();
			expect(result.activeAlerts[0].acknowledged).toBe(true);
		});

		it('should show acknowledged=false when lastEventAt is null (first occurrence tracking)', async () => {
			const alert = makeAlert('sensor:dev1:smoke', '2025-01-01T00:00:00Z');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			const ackRecord = {
				id: 'sensor:dev1:smoke',
				acknowledged: true,
				acknowledgedAt: new Date('2025-01-01'),
				lastEventAt: null,
				updatedAt: new Date(),
			} as SecurityAlertAckEntity;
			ackService.findByIds.mockResolvedValue([ackRecord]);

			const result = await service.getStatus();
			expect(result.activeAlerts[0].acknowledged).toBe(false);
		});

		it('should show acknowledged=true after acking an alert at timestamp T1', async () => {
			const T1 = '2025-01-01T00:00:00Z';
			const alert = makeAlert('sensor:dev1:smoke', T1);
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			// Ack record exists with matching lastEventAt — same event occurrence
			const ackRecord = {
				id: 'sensor:dev1:smoke',
				acknowledged: true,
				acknowledgedAt: new Date(T1),
				lastEventAt: new Date(T1),
				updatedAt: new Date(),
			} as SecurityAlertAckEntity;
			ackService.findByIds.mockResolvedValue([ackRecord]);

			const result = await service.getStatus();
			expect(result.activeAlerts[0].acknowledged).toBe(true);
		});

		it('should show acknowledged=false when same alert reappears with newer timestamp', async () => {
			const T1 = '2025-01-01T00:00:00Z';
			const T2 = '2025-01-02T00:00:00Z';
			const alert = makeAlert('sensor:dev1:smoke', T2);
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			// Ack record was created at T1 — alert now has newer timestamp T2
			const ackRecord = {
				id: 'sensor:dev1:smoke',
				acknowledged: true,
				acknowledgedAt: new Date(T1),
				lastEventAt: new Date(T1),
				updatedAt: new Date(),
			} as SecurityAlertAckEntity;
			ackService.findByIds.mockResolvedValue([ackRecord]);

			const result = await service.getStatus();
			expect(result.activeAlerts[0].acknowledged).toBe(false);
		});
	});

	describe('acknowledgeAlert', () => {
		it('should pass alert timestamp to ack service', async () => {
			const alert = makeAlert('a', '2025-01-15T00:00:00Z');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			const entity = { id: 'a', acknowledged: true } as SecurityAlertAckEntity;
			ackService.acknowledge.mockResolvedValue(entity);

			const result = await service.acknowledgeAlert('a');
			expect(result).toBe(entity);
			expect(ackService.acknowledge).toHaveBeenCalledWith('a', new Date('2025-01-15T00:00:00Z'), undefined);
		});

		it('should throw NotFoundException when alert not found', async () => {
			aggregator.aggregate.mockResolvedValue(makeStatus([]));

			await expect(service.acknowledgeAlert('nonexistent')).rejects.toThrow(NotFoundException);
		});

		it('should pass acknowledgedBy to ack service', async () => {
			const alert = makeAlert('a', '2025-01-15T00:00:00Z');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			const entity = { id: 'a', acknowledged: true } as SecurityAlertAckEntity;
			ackService.acknowledge.mockResolvedValue(entity);

			await service.acknowledgeAlert('a', 'user-123');
			expect(ackService.acknowledge).toHaveBeenCalledWith('a', new Date('2025-01-15T00:00:00Z'), 'user-123');
		});
	});

	describe('acknowledgeAllAlerts', () => {
		it('should pass alert timestamps to ack service', async () => {
			const alerts = [makeAlert('a', '2025-01-01T00:00:00Z'), makeAlert('b', '2025-01-02T00:00:00Z')];
			aggregator.aggregate.mockResolvedValue(makeStatus(alerts));
			ackService.findByIds.mockResolvedValue([
				{ id: 'a', acknowledged: true } as SecurityAlertAckEntity,
				{ id: 'b', acknowledged: true } as SecurityAlertAckEntity,
			]);

			const result = await service.acknowledgeAllAlerts();
			expect(ackService.acknowledgeAll).toHaveBeenCalledWith(
				[
					{ id: 'a', timestamp: new Date('2025-01-01T00:00:00Z') },
					{ id: 'b', timestamp: new Date('2025-01-02T00:00:00Z') },
				],
				undefined,
			);
			expect(result).toHaveLength(2);
		});

		it('should pass acknowledgedBy to ack service', async () => {
			const alerts = [makeAlert('a', '2025-01-01T00:00:00Z')];
			aggregator.aggregate.mockResolvedValue(makeStatus(alerts));
			ackService.findByIds.mockResolvedValue([{ id: 'a', acknowledged: true } as SecurityAlertAckEntity]);

			await service.acknowledgeAllAlerts('user-456');
			expect(ackService.acknowledgeAll).toHaveBeenCalledWith(
				[{ id: 'a', timestamp: new Date('2025-01-01T00:00:00Z') }],
				'user-456',
			);
		});
	});
});
