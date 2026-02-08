/* eslint-disable @typescript-eslint/unbound-method */
import { In, Not, Repository } from 'typeorm';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';

import { SecurityAlertAckService } from './security-alert-ack.service';

describe('SecurityAlertAckService', () => {
	let service: SecurityAlertAckService;
	let repo: jest.Mocked<Repository<SecurityAlertAckEntity>>;

	const mockRepo = () => ({
		find: jest.fn(),
		findOne: jest.fn(),
		create: jest.fn((data: Partial<SecurityAlertAckEntity>) => ({ ...data }) as SecurityAlertAckEntity),
		save: jest.fn((entity: SecurityAlertAckEntity | SecurityAlertAckEntity[]) => Promise.resolve(entity)),
		delete: jest.fn(),
		clear: jest.fn(),
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SecurityAlertAckService,
				{
					provide: getRepositoryToken(SecurityAlertAckEntity),
					useFactory: mockRepo,
				},
			],
		}).compile();

		service = module.get<SecurityAlertAckService>(SecurityAlertAckService);
		repo = module.get(getRepositoryToken(SecurityAlertAckEntity));
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('findByIds', () => {
		it('should return empty array for empty ids', async () => {
			const result = await service.findByIds([]);
			expect(result).toEqual([]);
			expect(repo.find).not.toHaveBeenCalled();
		});

		it('should query by ids', async () => {
			const records = [{ id: 'a', acknowledged: true }] as SecurityAlertAckEntity[];
			repo.find.mockResolvedValue(records);

			const result = await service.findByIds(['a', 'b']);
			expect(repo.find).toHaveBeenCalledWith({ where: { id: In(['a', 'b']) } });
			expect(result).toEqual(records);
		});
	});

	describe('acknowledge', () => {
		it('should create new record if not found', async () => {
			repo.findOne.mockResolvedValue(null);
			repo.create.mockReturnValue({ id: 'sensor:dev1:smoke' } as SecurityAlertAckEntity);
			repo.save.mockImplementation((e) => Promise.resolve(e as SecurityAlertAckEntity));

			const result = await service.acknowledge('sensor:dev1:smoke');
			expect(result.acknowledged).toBe(true);
			expect(result.acknowledgedAt).toBeInstanceOf(Date);
		});

		it('should update existing record', async () => {
			const existing = {
				id: 'sensor:dev1:smoke',
				acknowledged: false,
				acknowledgedAt: null,
			} as SecurityAlertAckEntity;
			repo.findOne.mockResolvedValue(existing);
			repo.save.mockImplementation((e) => Promise.resolve(e as SecurityAlertAckEntity));

			const result = await service.acknowledge('sensor:dev1:smoke');
			expect(result.acknowledged).toBe(true);
			expect(result.acknowledgedAt).toBeInstanceOf(Date);
		});

		it('should store lastEventAt when provided', async () => {
			repo.findOne.mockResolvedValue(null);
			repo.create.mockReturnValue({ id: 'a' } as SecurityAlertAckEntity);
			repo.save.mockImplementation((e) => Promise.resolve(e as SecurityAlertAckEntity));

			const ts = new Date('2025-01-15T00:00:00Z');
			const result = await service.acknowledge('a', ts);
			expect(result.lastEventAt).toEqual(ts);
		});
	});

	describe('acknowledgeAll', () => {
		it('should do nothing for empty list', async () => {
			await service.acknowledgeAll([]);
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('should acknowledge existing and create new records with timestamps', async () => {
			const existing = {
				id: 'a',
				acknowledged: false,
				acknowledgedAt: null,
				lastEventAt: null,
			} as SecurityAlertAckEntity;
			repo.find.mockResolvedValue([existing]);
			repo.save.mockImplementation((e: any) => Promise.resolve(e));

			const tsA = new Date('2025-01-10T00:00:00Z');
			const tsB = new Date('2025-01-11T00:00:00Z');

			await service.acknowledgeAll([
				{ id: 'a', timestamp: tsA },
				{ id: 'b', timestamp: tsB },
			]);

			expect(repo.save).toHaveBeenCalled();
			const savedEntities = repo.save.mock.calls[0][0] as SecurityAlertAckEntity[];
			expect(savedEntities).toHaveLength(2);
			expect(savedEntities.every((e) => e.acknowledged === true)).toBe(true);
			expect(existing.lastEventAt).toEqual(tsA);
		});
	});

	describe('resetAcknowledgement', () => {
		it('should do nothing if record not found', async () => {
			repo.findOne.mockResolvedValue(null);

			await service.resetAcknowledgement('a', new Date('2025-01-01'));
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('should reset acknowledged and acknowledgedAt and update lastEventAt', async () => {
			const existing = {
				id: 'a',
				acknowledged: true,
				acknowledgedAt: new Date('2025-01-01'),
				lastEventAt: new Date('2025-01-01'),
			} as SecurityAlertAckEntity;
			repo.findOne.mockResolvedValue(existing);
			repo.save.mockImplementation((e) => Promise.resolve(e as SecurityAlertAckEntity));

			const newTimestamp = new Date('2025-01-02');
			await service.resetAcknowledgement('a', newTimestamp);

			expect(existing.acknowledged).toBe(false);
			expect(existing.acknowledgedAt).toBeNull();
			expect(existing.lastEventAt).toEqual(newTimestamp);
			expect(repo.save).toHaveBeenCalledWith(existing);
		});
	});

	describe('updateLastEventAt', () => {
		it('should do nothing if record not found', async () => {
			repo.findOne.mockResolvedValue(null);

			await service.updateLastEventAt('a', new Date('2025-01-01'));
			expect(repo.save).not.toHaveBeenCalled();
		});

		it('should update lastEventAt without changing acknowledged', async () => {
			const existing = {
				id: 'a',
				acknowledged: true,
				lastEventAt: new Date('2025-01-01'),
			} as SecurityAlertAckEntity;
			repo.findOne.mockResolvedValue(existing);
			repo.save.mockImplementation((e) => Promise.resolve(e as SecurityAlertAckEntity));

			await service.updateLastEventAt('a', new Date('2025-01-02'));
			expect(existing.acknowledged).toBe(true);
			expect(existing.lastEventAt).toEqual(new Date('2025-01-02'));
		});

		it('should set lastEventAt when previously null without changing acknowledged', async () => {
			const existing = {
				id: 'a',
				acknowledged: true,
				lastEventAt: null,
			} as SecurityAlertAckEntity;
			repo.findOne.mockResolvedValue(existing);
			repo.save.mockImplementation((e) => Promise.resolve(e as SecurityAlertAckEntity));

			await service.updateLastEventAt('a', new Date('2025-01-01'));
			expect(existing.acknowledged).toBe(true);
			expect(existing.lastEventAt).toEqual(new Date('2025-01-01'));
		});

		it('should not update when timestamp is same or older', async () => {
			const existing = {
				id: 'a',
				acknowledged: true,
				lastEventAt: new Date('2025-01-02'),
			} as SecurityAlertAckEntity;
			repo.findOne.mockResolvedValue(existing);

			await service.updateLastEventAt('a', new Date('2025-01-01'));
			expect(repo.save).not.toHaveBeenCalled();
		});
	});

	describe('cleanupStale', () => {
		it('should clear all when no active ids', async () => {
			await service.cleanupStale([]);
			expect(repo.clear).toHaveBeenCalled();
		});

		it('should delete records not in active ids', async () => {
			await service.cleanupStale(['a', 'b']);
			expect(repo.delete).toHaveBeenCalledWith({ id: Not(In(['a', 'b'])) });
		});
	});
});
