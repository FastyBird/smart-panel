/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { DevicesService } from '../../devices/services/devices.service';
import { DisplaysService } from '../../displays/services/displays.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { UsersService } from '../../users/services/users.service';
import { SystemConfigModel } from '../models/config.model';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
	let service: OnboardingService;
	let usersService: UsersService;
	let devicesService: DevicesService;
	let spacesService: SpacesService;
	let displaysService: DisplaysService;
	let configService: ConfigService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				OnboardingService,
				{
					provide: UsersService,
					useValue: {
						findOwner: jest.fn(),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						getCount: jest.fn(),
					},
				},
				{
					provide: SpacesService,
					useValue: {
						findAll: jest.fn(),
					},
				},
				{
					provide: DisplaysService,
					useValue: {
						findAll: jest.fn(),
					},
				},
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: jest.fn(),
						setModuleConfig: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<OnboardingService>(OnboardingService);
		usersService = module.get<UsersService>(UsersService);
		devicesService = module.get<DevicesService>(DevicesService);
		spacesService = module.get<SpacesService>(SpacesService);
		displaysService = module.get<DisplaysService>(DisplaysService);
		configService = module.get<ConfigService>(ConfigService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getStatus', () => {
		it('should return fresh installation status', async () => {
			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(devicesService, 'getCount').mockResolvedValue(0);
			jest.spyOn(spacesService, 'findAll').mockResolvedValue([]);
			jest.spyOn(displaysService, 'findAll').mockResolvedValue([]);
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue({
				onboardingCompleted: false,
			} as SystemConfigModel);

			const status = await service.getStatus();

			expect(status.hasOwner).toBe(false);
			expect(status.onboardingCompleted).toBe(false);
			expect(status.devicesCount).toBe(0);
			expect(status.spacesCount).toBe(0);
			expect(status.displaysCount).toBe(0);
		});

		it('should return status with owner and devices', async () => {
			jest.spyOn(usersService, 'findOwner').mockResolvedValue({ id: '1' } as any);
			jest.spyOn(devicesService, 'getCount').mockResolvedValue(5);
			jest.spyOn(spacesService, 'findAll').mockResolvedValue([{}, {}, {}] as any);
			jest.spyOn(displaysService, 'findAll').mockResolvedValue([{}] as any);
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue({
				onboardingCompleted: true,
			} as SystemConfigModel);

			const status = await service.getStatus();

			expect(status.hasOwner).toBe(true);
			expect(status.onboardingCompleted).toBe(true);
			expect(status.devicesCount).toBe(5);
			expect(status.spacesCount).toBe(3);
			expect(status.displaysCount).toBe(1);
		});

		it('should default onboardingCompleted to false when undefined', async () => {
			jest.spyOn(usersService, 'findOwner').mockResolvedValue(null);
			jest.spyOn(devicesService, 'getCount').mockResolvedValue(0);
			jest.spyOn(spacesService, 'findAll').mockResolvedValue([]);
			jest.spyOn(displaysService, 'findAll').mockResolvedValue([]);
			jest.spyOn(configService, 'getModuleConfig').mockReturnValue({} as SystemConfigModel);

			const status = await service.getStatus();

			expect(status.onboardingCompleted).toBe(false);
		});
	});

	describe('markComplete', () => {
		it('should set onboarding_completed in config', () => {
			service.markComplete();

			expect(configService.setModuleConfig).toHaveBeenCalledWith(SYSTEM_MODULE_NAME, {
				type: SYSTEM_MODULE_NAME,
				onboarding_completed: true,
			});
		});
	});
});
