import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { SpaceIntentService } from '../../spaces/services/space-intent.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { LightingIntentType, LightingMode } from '../../spaces/spaces.constants';
import { SystemConfigModel } from '../models/config.model';
import { EventType, HouseMode } from '../system.constants';

import { HouseModeActionsService } from './house-mode-actions.service';

describe('HouseModeActionsService', () => {
	let service: HouseModeActionsService;
	let configService: jest.Mocked<ConfigService>;
	let spacesService: jest.Mocked<SpacesService>;
	let spaceIntentService: jest.Mocked<SpaceIntentService>;
	let eventEmitter: jest.Mocked<EventEmitter2>;

	const spaceId1 = uuid();
	const spaceId2 = uuid();

	const mockSpaces = [
		{ id: spaceId1, name: 'Living Room' },
		{ id: spaceId2, name: 'Bedroom' },
	];

	const createMockConfig = (mode: HouseMode): Partial<SystemConfigModel> => ({
		houseMode: mode,
	});

	beforeEach(async () => {
		const mockConfigService = {
			getModuleConfig: jest.fn().mockReturnValue(createMockConfig(HouseMode.HOME)),
		};

		const mockSpacesService = {
			findAll: jest.fn().mockResolvedValue(mockSpaces),
		};

		const mockSpaceIntentService = {
			executeLightingIntent: jest.fn().mockResolvedValue({ success: true, affectedDevices: 2, failedDevices: 0 }),
		};

		const mockEventEmitter = {
			emit: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HouseModeActionsService,
				{ provide: ConfigService, useValue: mockConfigService },
				{ provide: SpacesService, useValue: mockSpacesService },
				{ provide: SpaceIntentService, useValue: mockSpaceIntentService },
				{ provide: EventEmitter2, useValue: mockEventEmitter },
			],
		}).compile();

		service = module.get<HouseModeActionsService>(HouseModeActionsService);
		configService = module.get(ConfigService);
		spacesService = module.get(SpacesService);
		spaceIntentService = module.get(SpaceIntentService);
		eventEmitter = module.get(EventEmitter2);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('onModuleInit', () => {
		it('should initialize previous mode from config', () => {
			service.onModuleInit();
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(configService.getModuleConfig).toHaveBeenCalled();
		});
	});

	describe('onConfigUpdated', () => {
		it('should emit HOUSE_MODE_CHANGED event when mode changes', async () => {
			service.onModuleInit();

			// Change to Away mode
			configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);

			await service.onConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.HOUSE_MODE_CHANGED, {
				previousMode: HouseMode.HOME,
				newMode: HouseMode.AWAY,
			});
		});

		it('should not emit event when mode has not changed', async () => {
			service.onModuleInit();

			// Same mode
			configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.HOME) as SystemConfigModel);

			await service.onConfigUpdated();

			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		describe('Away mode', () => {
			it('should turn off all lights in all spaces', async () => {
				service.onModuleInit();

				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);

				await service.onConfigUpdated();

				// Should call executeLightingIntent for each space with OFF intent
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledTimes(2);
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(spaceId1, {
					type: LightingIntentType.OFF,
				});
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(spaceId2, {
					type: LightingIntentType.OFF,
				});
			});
		});

		describe('Night mode', () => {
			it('should apply night lighting in all spaces', async () => {
				service.onModuleInit();

				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.NIGHT) as SystemConfigModel);

				await service.onConfigUpdated();

				// Should call executeLightingIntent for each space with SET_MODE NIGHT intent
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledTimes(2);
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(spaceId1, {
					type: LightingIntentType.SET_MODE,
					mode: LightingMode.NIGHT,
				});
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(spaceId2, {
					type: LightingIntentType.SET_MODE,
					mode: LightingMode.NIGHT,
				});
			});
		});

		describe('Home mode', () => {
			it('should not execute any lighting actions (non-destructive)', async () => {
				// Start from Away mode
				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);
				service.onModuleInit();

				// Change to Home mode
				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.HOME) as SystemConfigModel);

				await service.onConfigUpdated();

				// Should emit the event but not execute any lighting intents
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.HOUSE_MODE_CHANGED, {
					previousMode: HouseMode.AWAY,
					newMode: HouseMode.HOME,
				});

				// No lighting actions should be executed for Home mode
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).not.toHaveBeenCalled();
			});
		});

		it('should handle empty spaces gracefully', async () => {
			spacesService.findAll.mockResolvedValue([]);
			service.onModuleInit();

			configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);

			await service.onConfigUpdated();

			// Should not call executeLightingIntent when no spaces
			// eslint-disable-next-line @typescript-eslint/unbound-method
			expect(spaceIntentService.executeLightingIntent).not.toHaveBeenCalled();
		});

		it('should handle failed lighting intents gracefully', async () => {
			service.onModuleInit();

			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: false,
				affectedDevices: 0,
				failedDevices: 1,
			});

			configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);

			// Should not throw
			await expect(service.onConfigUpdated()).resolves.not.toThrow();
		});

		describe('first detection after init failure', () => {
			it('should execute actions on first detection when init failed', async () => {
				// Simulate init failure
				configService.getModuleConfig.mockImplementationOnce(() => {
					throw new Error('Config not ready');
				});
				service.onModuleInit();

				// First config update with AWAY mode
				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);

				await service.onConfigUpdated();

				// Should execute lighting actions even though this is "first detection"
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledTimes(2);
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(spaceId1, {
					type: LightingIntentType.OFF,
				});
			});

			it('should not emit HOUSE_MODE_CHANGED event on first detection (no previous mode)', async () => {
				// Simulate init failure
				configService.getModuleConfig.mockImplementationOnce(() => {
					throw new Error('Config not ready');
				});
				service.onModuleInit();

				// First config update with AWAY mode
				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);

				await service.onConfigUpdated();

				// Should NOT emit event since there's no previousMode to report
				// eslint-disable-next-line @typescript-eslint/unbound-method
				expect(eventEmitter.emit).not.toHaveBeenCalled();
			});
		});

		describe('rapid mode changes serialization', () => {
			it('should serialize action execution for rapid mode changes', async () => {
				service.onModuleInit();

				const executionOrder: string[] = [];

				// Track execution order with delays
				spaceIntentService.executeLightingIntent.mockImplementation(async (_spaceId, intent) => {
					const mode = intent.type === LightingIntentType.OFF ? 'away' : 'night';
					executionOrder.push(`${mode}-start`);
					await new Promise((resolve) => setTimeout(resolve, 10));
					executionOrder.push(`${mode}-end`);
					return { success: true, affectedDevices: 1, failedDevices: 0 };
				});

				// Trigger rapid mode changes
				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.AWAY) as SystemConfigModel);
				const awayPromise = service.onConfigUpdated();

				configService.getModuleConfig.mockReturnValue(createMockConfig(HouseMode.NIGHT) as SystemConfigModel);
				const nightPromise = service.onConfigUpdated();

				await Promise.all([awayPromise, nightPromise]);

				// All "away" actions should complete before any "night" actions start
				const awayEndIndex = executionOrder.lastIndexOf('away-end');
				const nightStartIndex = executionOrder.indexOf('night-start');

				expect(awayEndIndex).toBeLessThan(nightStartIndex);
			});
		});
	});
});
