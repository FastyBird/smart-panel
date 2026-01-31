/* eslint-disable @typescript-eslint/unbound-method */
import { Repository } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SecurityEventEntity } from '../entities/security-event.entity';
import { SecurityAlertModel } from '../models/security-status.model';
import { AlarmState, ArmedState, SecurityAlertType, SecurityEventType, Severity } from '../security.constants';

import { SecurityEventsService } from './security-events.service';

describe('SecurityEventsService', () => {
	let service: SecurityEventsService;
	let repo: jest.Mocked<Repository<SecurityEventEntity>>;

	const mockQueryBuilder = {
		orderBy: jest.fn().mockReturnThis(),
		limit: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		getMany: jest.fn().mockResolvedValue([]),
	};

	const mockRepo = () => ({
		find: jest.fn().mockResolvedValue([]),
		findOne: jest.fn(),
		create: jest.fn((data: Partial<SecurityEventEntity>) => ({ ...data }) as SecurityEventEntity),
		save: jest.fn((entity: any) => Promise.resolve(entity)),
		delete: jest.fn(),
		remove: jest.fn(),
		count: jest.fn().mockResolvedValue(0),
		createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
	});

	const makeAlert = (overrides: Partial<SecurityAlertModel> = {}): SecurityAlertModel => {
		const alert = new SecurityAlertModel();
		alert.id = overrides.id ?? 'sensor:dev1:smoke';
		alert.type = (overrides.type as SecurityAlertType) ?? SecurityAlertType.SMOKE;
		alert.severity = overrides.severity ?? Severity.CRITICAL;
		alert.timestamp = overrides.timestamp ?? '2025-01-18T12:00:00Z';
		alert.acknowledged = overrides.acknowledged ?? false;
		alert.sourceDeviceId = overrides.sourceDeviceId ?? 'dev1';

		return alert;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecurityEventsService,
				{
					provide: getRepositoryToken(SecurityEventEntity),
					useFactory: mockRepo,
				},
			],
		}).compile();

		service = module.get<SecurityEventsService>(SecurityEventsService);
		repo = module.get(getRepositoryToken(SecurityEventEntity));
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('findRecent', () => {
		it('should return events with default limit', async () => {
			await service.findRecent();
			expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('event.timestamp', 'DESC');
			expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
		});

		it('should clamp limit to max 200', async () => {
			await service.findRecent({ limit: 500 });
			expect(mockQueryBuilder.limit).toHaveBeenCalledWith(200);
		});

		it('should apply since filter', async () => {
			const since = new Date('2025-01-01T00:00:00Z');
			await service.findRecent({ since });
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.timestamp >= :since', {
				since: since.toISOString(),
			});
		});

		it('should apply severity filter', async () => {
			await service.findRecent({ severity: Severity.CRITICAL });
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.severity = :severity', {
				severity: 'critical',
			});
		});

		it('should apply type filter', async () => {
			await service.findRecent({ type: SecurityEventType.ALERT_RAISED });
			expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('event.eventType = :type', {
				type: 'alert_raised',
			});
		});
	});

	describe('recordAlertTransitions', () => {
		it('should not generate events on first call (seed)', async () => {
			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('should generate alert_raised when new alert appears', async () => {
			// Seed with empty
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			// New alert appears
			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(repo.save).toHaveBeenCalled();
			const saved = repo.save.mock.calls[0][0] as SecurityEventEntity[];
			const raised = saved.find((e) => e.eventType === SecurityEventType.ALERT_RAISED);
			expect(raised).toBeDefined();
			expect(raised!.alertId).toBe('sensor:dev1:smoke');
			expect(raised!.severity).toBe(Severity.CRITICAL);
		});

		it('should generate alert_resolved when alert disappears', async () => {
			const alert = makeAlert();
			// Seed with alert
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			// Alert disappears
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			expect(repo.save).toHaveBeenCalled();
			const saved = repo.save.mock.calls[0][0] as SecurityEventEntity[];
			const resolved = saved.find((e) => e.eventType === SecurityEventType.ALERT_RESOLVED);
			expect(resolved).toBeDefined();
			expect(resolved!.alertId).toBe('sensor:dev1:smoke');
		});

		it('should generate armed_state_changed event', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([], ArmedState.ARMED_AWAY, AlarmState.IDLE);

			expect(repo.save).toHaveBeenCalled();
			const saved = repo.save.mock.calls[0][0] as SecurityEventEntity[];
			const stateChange = saved.find((e) => e.eventType === SecurityEventType.ARMED_STATE_CHANGED);
			expect(stateChange).toBeDefined();
			expect(stateChange!.payload).toEqual({ from: ArmedState.DISARMED, to: ArmedState.ARMED_AWAY });
		});

		it('should generate alarm_state_changed event', async () => {
			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([], ArmedState.DISARMED, AlarmState.TRIGGERED);

			expect(repo.save).toHaveBeenCalled();
			const saved = repo.save.mock.calls[0][0] as SecurityEventEntity[];
			const stateChange = saved.find((e) => e.eventType === SecurityEventType.ALARM_STATE_CHANGED);
			expect(stateChange).toBeDefined();
			expect(stateChange!.severity).toBe(Severity.CRITICAL);
			expect(stateChange!.payload).toEqual({ from: AlarmState.IDLE, to: AlarmState.TRIGGERED });
		});

		it('should not generate events when nothing changed', async () => {
			const alert = makeAlert();
			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			await service.recordAlertTransitions([alert], ArmedState.DISARMED, AlarmState.IDLE);

			expect(repo.save).not.toHaveBeenCalled();
		});
	});

	describe('recordAcknowledgement', () => {
		it('should create alert_acknowledged event', async () => {
			await service.recordAcknowledgement('sensor:dev1:smoke', 'smoke', 'dev1');

			expect(repo.save).toHaveBeenCalled();
			const saved = repo.save.mock.calls[0][0] as SecurityEventEntity;
			expect(saved.eventType).toBe(SecurityEventType.ALERT_ACKNOWLEDGED);
			expect(saved.alertId).toBe('sensor:dev1:smoke');
			expect(saved.alertType).toBe('smoke');
			expect(saved.sourceDeviceId).toBe('dev1');
		});
	});

	describe('enforceRetention', () => {
		it('should not delete when under limit', async () => {
			repo.count.mockResolvedValue(100);

			await service.enforceRetention();

			expect(repo.find).not.toHaveBeenCalled();
			expect(repo.delete).not.toHaveBeenCalled();
		});

		it('should delete old events when over limit', async () => {
			const cutoffEvent = { id: 'old', timestamp: new Date('2025-01-01') } as SecurityEventEntity;
			repo.count.mockResolvedValueOnce(250).mockResolvedValueOnce(200);
			repo.find.mockResolvedValueOnce([cutoffEvent]);

			await service.enforceRetention();

			expect(repo.delete).toHaveBeenCalled();
		});
	});
});
