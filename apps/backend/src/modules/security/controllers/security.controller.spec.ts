import { Test, TestingModule } from '@nestjs/testing';

import { Severity } from '../security.constants';
import { SecurityService } from '../services/security.service';

import { SecurityController } from './security.controller';

describe('SecurityController', () => {
	let controller: SecurityController;
	let service: SecurityService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SecurityController],
			providers: [SecurityService],
		}).compile();

		controller = module.get<SecurityController>(SecurityController);
		service = module.get<SecurityService>(SecurityService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
	});

	describe('getStatus', () => {
		it('should return default security status', () => {
			const result = controller.getStatus();

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
