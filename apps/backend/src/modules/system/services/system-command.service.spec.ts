/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ModuleRef } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AppInstanceHolder } from '../../../common/services/app-instance-holder.service';
import { PlatformNotSupportedException } from '../../platform/platform.exceptions';
import { PlatformService } from '../../platform/services/platform.service';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { EventType } from '../system.constants';

import { FactoryResetRegistryService } from './factory-reset-registry.service';
import { SystemCommandService } from './system-command.service';

function makeUser(): ClientUserDto {
	const user = new ClientUserDto();

	user.id = 'user-1';

	return user;
}

describe('SystemCommandService', () => {
	let service: SystemCommandService;
	let platformService: { reboot: jest.Mock; powerOff: jest.Mock };
	let eventEmitter: { emit: jest.Mock };
	let appInstanceHolder: { getApp: jest.Mock };
	let mockApp: { close: jest.Mock };
	let processExitSpy: jest.SpyInstance;

	beforeEach(() => {
		platformService = {
			reboot: jest.fn().mockResolvedValue(undefined),
			powerOff: jest.fn().mockResolvedValue(undefined),
		};

		eventEmitter = { emit: jest.fn() };

		mockApp = { close: jest.fn().mockResolvedValue(undefined) };
		appInstanceHolder = { getApp: jest.fn().mockReturnValue(mockApp) };

		const moduleRef = {
			get: jest.fn().mockReturnValue({}),
		};

		service = new SystemCommandService(
			moduleRef as unknown as ModuleRef,
			{} as FactoryResetRegistryService,
			{ stopAllServices: jest.fn() } as any,
			platformService as unknown as PlatformService,
			{ revokeByOwnerId: jest.fn() } as any,
			eventEmitter as unknown as EventEmitter2,
			appInstanceHolder as unknown as AppInstanceHolder,
		);

		// Prevent process.exit from actually killing the test runner
		processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
	});

	afterEach(() => {
		processExitSpy.mockRestore();
	});

	describe('reboot', () => {
		it('should emit processing event and call platformService.reboot', async () => {
			const result = await service.reboot(makeUser());

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.SYSTEM_REBOOT, {
				triggered_by: 'user-1',
				status: 'processing',
			});
			expect(platformService.reboot).toHaveBeenCalled();
			expect(result.success).toBe(true);
		});

		it('should return failure when platform is not supported', async () => {
			platformService.reboot.mockRejectedValue(new PlatformNotSupportedException('reboot'));

			const result = await service.reboot(makeUser());

			expect(result.success).toBe(false);
			expect(result.reason).toContain('not supported');
		});

		it('should return failure on unknown errors', async () => {
			platformService.reboot.mockRejectedValue(new Error('unexpected'));

			const result = await service.reboot(makeUser());

			expect(result.success).toBe(false);
			expect(result.reason).toBe('Unknown error');
		});
	});

	describe('powerOff', () => {
		it('should emit processing event and call platformService.powerOff', async () => {
			const result = await service.powerOff(makeUser());

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.SYSTEM_POWER_OFF, {
				triggered_by: 'user-1',
				status: 'processing',
			});
			expect(platformService.powerOff).toHaveBeenCalled();
			expect(result.success).toBe(true);
		});

		it('should return failure when platform is not supported', async () => {
			platformService.powerOff.mockRejectedValue(new PlatformNotSupportedException('powerOff'));

			const result = await service.powerOff(makeUser());

			expect(result.success).toBe(false);
			expect(result.reason).toContain('not supported');
		});
	});

	describe('restartService', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should emit processing event, close app, and call process.exit(0)', async () => {
			const promise = service.restartService(makeUser());

			// Advance past the 500ms delay
			jest.advanceTimersByTime(500);

			await promise;

			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.SYSTEM_SERVICE_RESTART, {
				triggered_by: 'user-1',
				status: 'processing',
			});
			expect(mockApp.close).toHaveBeenCalled();
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});

		it('should still exit even if app.close() throws', async () => {
			mockApp.close.mockRejectedValue(new Error('close failed'));

			const promise = service.restartService(makeUser());

			jest.advanceTimersByTime(500);

			await promise;

			expect(processExitSpy).toHaveBeenCalledWith(0);
		});
	});
});
