import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SecurityAlertAckEntity } from '../entities/security-alert-ack.entity';
import { DefaultSecurityProvider } from '../providers/default-security.provider';
import { SECURITY_STATE_PROVIDERS, Severity } from '../security.constants';
import { SecurityAlertAckService } from '../services/security-alert-ack.service';
import { SecurityAggregatorService } from '../services/security-aggregator.service';
import { SecurityService } from '../services/security.service';

import { SecurityController } from './security.controller';

describe('SecurityController', () => {
	let controller: SecurityController;
	let service: SecurityService;

	beforeEach(async () => {
		const defaultProvider = new DefaultSecurityProvider();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SecurityController],
			providers: [
				{
					provide: SECURITY_STATE_PROVIDERS,
					useValue: [defaultProvider],
				},
				{
					provide: getRepositoryToken(SecurityAlertAckEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						create: jest.fn(),
						save: jest.fn(),
						delete: jest.fn(),
						clear: jest.fn(),
					},
				},
				SecurityAlertAckService,
				SecurityAggregatorService,
				SecurityService,
			],
		}).compile();

		controller = module.get<SecurityController>(SecurityController);
		service = module.get<SecurityService>(SecurityService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
	});

	describe('getStatus', () => {
		it('should return default security status', async () => {
			const result = await controller.getStatus();

			expect(result.data).toBeDefined();
			expect(result.data.armedState).toBeNull();
			expect(result.data.alarmState).toBeNull();
			expect(result.data.highestSeverity).toBe(Severity.INFO);
			expect(result.data.activeAlertsCount).toBe(0);
			expect(result.data.hasCriticalAlert).toBe(false);
			expect(result.data.lastEvent).toBeUndefined();
		});
	});
});
