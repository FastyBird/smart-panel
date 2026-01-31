/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { SecurityAlertModel, SecurityStatusModel } from '../models/security-status.model';
import { SecurityAlertType, Severity } from '../security.constants';

import { SecurityAggregatorService } from './security-aggregator.service';
import { SecurityAlertAckService } from './security-alert-ack.service';
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

	beforeEach(() => {
		aggregator = {
			aggregate: jest.fn(),
		} as any;

		ackService = {
			findByIds: jest.fn().mockResolvedValue([]),
			acknowledge: jest.fn(),
			acknowledgeAll: jest.fn(),
			updateLastEventAt: jest.fn(),
			cleanupStale: jest.fn(),
		} as any;

		service = new SecurityService(aggregator, ackService);
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

		it('should reset ack when alert timestamp is newer than stored lastEventAt', async () => {
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
			expect(ackService.updateLastEventAt).toHaveBeenCalledWith('sensor:dev1:smoke', new Date('2025-01-02T00:00:00Z'));
		});

		it('should not call updateLastEventAt for alerts with invalid timestamps', async () => {
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
			expect(ackService.updateLastEventAt).not.toHaveBeenCalled();
		});

		it('should preserve acknowledged state when initializing lastEventAt', async () => {
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
			expect(result.activeAlerts[0].acknowledged).toBe(true);
			expect(ackService.updateLastEventAt).toHaveBeenCalledWith('sensor:dev1:smoke', new Date('2025-01-01T00:00:00Z'));
		});

		it('should cleanup stale ack records', async () => {
			const alert = makeAlert('sensor:dev1:smoke', '2025-01-01T00:00:00Z');
			aggregator.aggregate.mockResolvedValue(makeStatus([alert]));

			await service.getStatus();
			expect(ackService.cleanupStale).toHaveBeenCalledWith(['sensor:dev1:smoke']);
		});
	});

	describe('acknowledgeAlert', () => {
		it('should delegate to ack service', async () => {
			const entity = { id: 'a', acknowledged: true } as SecurityAlertAckEntity;
			ackService.acknowledge.mockResolvedValue(entity);

			const result = await service.acknowledgeAlert('a');
			expect(result).toBe(entity);
		});
	});

	describe('acknowledgeAllAlerts', () => {
		it('should acknowledge all active alert ids', async () => {
			const alerts = [makeAlert('a', '2025-01-01T00:00:00Z'), makeAlert('b', '2025-01-01T00:00:00Z')];
			aggregator.aggregate.mockResolvedValue(makeStatus(alerts));
			ackService.findByIds.mockResolvedValue([
				{ id: 'a', acknowledged: true } as SecurityAlertAckEntity,
				{ id: 'b', acknowledged: true } as SecurityAlertAckEntity,
			]);

			const result = await service.acknowledgeAllAlerts();
			expect(ackService.acknowledgeAll).toHaveBeenCalledWith(['a', 'b']);
			expect(result).toHaveLength(2);
		});
	});
});
