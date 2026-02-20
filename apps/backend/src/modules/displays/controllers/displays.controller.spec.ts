/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { TokensService } from '../../auth/services/tokens.service';
import { ConnectionState, DisplayRole, HomeMode } from '../displays.constants';
import { DisplaysNotFoundException } from '../displays.exceptions';
import { DisplayEntity } from '../entities/displays.entity';
import { DisplaysService } from '../services/displays.service';
import { HomeResolutionService } from '../services/home-resolution.service';
import { PermitJoinService } from '../services/permit-join.service';
import { RegistrationService } from '../services/registration.service';

import { DisplaysController } from './displays.controller';

describe('DisplaysController', () => {
	let controller: DisplaysController;
	let service: DisplaysService;
	let tokensService: TokensService;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		macAddress: 'AA:BB:CC:DD:EE:FF',
		name: 'Test Display',
		role: DisplayRole.ROOM,
		version: '1.0.0',
		build: '42',
		screenWidth: 1920,
		screenHeight: 1080,
		pixelRatio: 1.5,
		unitSize: 8,
		rows: 12,
		cols: 24,
		darkMode: false,
		brightness: 100,
		screenLockDuration: 30,
		screenSaver: true,
		audioOutputSupported: false,
		audioInputSupported: false,
		speaker: false,
		speakerVolume: 50,
		microphone: false,
		microphoneVolume: 50,
		registeredFromIp: null,
		currentIpAddress: null,
		online: false,
		roomId: null,
		temperatureUnit: null,
		windSpeedUnit: null,
		pressureUnit: null,
		precipitationUnit: null,
		distanceUnit: null,
		room: null,
		homeMode: HomeMode.AUTO_SPACE,
		homePageId: null,
		homePage: null,
		status: ConnectionState.UNKNOWN,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockDisplayTwo: DisplayEntity = {
		id: uuid().toString(),
		macAddress: '11:22:33:44:55:66',
		name: 'Second Display',
		role: DisplayRole.MASTER,
		version: '1.0.0',
		build: '42',
		screenWidth: 1280,
		screenHeight: 720,
		pixelRatio: 1,
		unitSize: 8,
		rows: 6,
		cols: 12,
		darkMode: true,
		brightness: 80,
		screenLockDuration: 60,
		screenSaver: false,
		audioOutputSupported: true,
		audioInputSupported: true,
		speaker: true,
		speakerVolume: 75,
		microphone: true,
		microphoneVolume: 60,
		registeredFromIp: null,
		currentIpAddress: null,
		online: false,
		roomId: null,
		temperatureUnit: null,
		windSpeedUnit: null,
		pressureUnit: null,
		precipitationUnit: null,
		distanceUnit: null,
		room: null,
		homeMode: HomeMode.AUTO_SPACE,
		homePageId: null,
		homePage: null,
		status: ConnectionState.UNKNOWN,
		createdAt: new Date(),
		updatedAt: null,
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DisplaysController],
			providers: [
				{
					provide: DisplaysService,
					useValue: {
						findAll: jest.fn(),
						findOne: jest.fn(),
						getOneOrThrow: jest.fn(),
						update: jest.fn(),
						remove: jest.fn(),
					},
				},
				{
					provide: TokensService,
					useValue: {
						findByOwnerId: jest.fn(),
						revokeByOwnerId: jest.fn(),
					},
				},
				{
					provide: RegistrationService,
					useValue: {
						refreshDisplayToken: jest.fn(),
					},
				},
				{
					provide: PermitJoinService,
					useValue: {
						activatePermitJoin: jest.fn(),
						deactivatePermitJoin: jest.fn(),
						isPermitJoinActive: jest.fn(),
						getExpiresAt: jest.fn(),
						getRemainingTime: jest.fn(),
						getDeploymentMode: jest.fn(),
					},
				},
				{
					provide: HomeResolutionService,
					useValue: {
						resolveHomePage: jest.fn().mockResolvedValue({
							pageId: null,
							resolutionMode: 'fallback',
							reason: 'No pages available',
						}),
						resolveHomePagesBatch: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<DisplaysController>(DisplaysController);
		service = module.get<DisplaysService>(DisplaysService);
		tokensService = module.get<TokensService>(TokensService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(tokensService).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all displays', async () => {
			const mockDisplays = [mockDisplay, mockDisplayTwo];

			jest.spyOn(service, 'findAll').mockResolvedValue(mockDisplays.map((d) => toInstance(DisplayEntity, d)));

			const result = await controller.findAll();

			expect(result.data).toHaveLength(2);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return empty array when no displays exist', async () => {
			jest.spyOn(service, 'findAll').mockResolvedValue([]);

			const result = await controller.findAll();

			expect(result.data).toHaveLength(0);
		});
	});

	describe('findOne', () => {
		it('should return a display by ID', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));

			const result = await controller.findOne(mockDisplay.id);

			expect(result.data).toMatchObject(toInstance(DisplayEntity, mockDisplay));
			expect(result.data.resolvedHomePageId).toBeNull();
			expect(service.getOneOrThrow).toHaveBeenCalledWith(mockDisplay.id);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.findOne('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});

	describe('update', () => {
		it('should update and return the display', async () => {
			const updateDto = { brightness: 80 };
			const updatedDisplay = { ...mockDisplay, brightness: 80 };

			jest.spyOn(service, 'update').mockResolvedValue(toInstance(DisplayEntity, updatedDisplay));

			const result = await controller.update(mockDisplay.id, { data: updateDto });

			expect(result.data.brightness).toBe(80);
			expect(service.update).toHaveBeenCalledWith(mockDisplay.id, updateDto);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'update').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.update('non-existent-id', { data: { brightness: 80 } })).rejects.toThrow(
				DisplaysNotFoundException,
			);
		});
	});

	describe('remove', () => {
		it('should remove a display', async () => {
			jest.spyOn(service, 'remove').mockResolvedValue(undefined);

			await controller.remove(mockDisplay.id);

			expect(service.remove).toHaveBeenCalledWith(mockDisplay.id);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'remove').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.remove('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});

	describe('getTokens', () => {
		it('should return active tokens for a display', async () => {
			const mockToken: Partial<LongLiveTokenEntity> = {
				id: uuid().toString(),
				hashedToken: 'hashed-token',
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplay.id,
				name: 'Display Token',
				description: null,
				revoked: false,
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
				updatedAt: null,
			};

			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(tokensService, 'findByOwnerId').mockResolvedValue([mockToken as LongLiveTokenEntity]);

			const result = await controller.getTokens(mockDisplay.id);

			expect(result.data).toHaveLength(1);
			expect(service.getOneOrThrow).toHaveBeenCalledWith(mockDisplay.id);
			expect(tokensService.findByOwnerId).toHaveBeenCalledWith(mockDisplay.id, TokenOwnerType.DISPLAY);
		});

		it('should filter out revoked tokens', async () => {
			const mockActiveToken: Partial<LongLiveTokenEntity> = {
				id: uuid().toString(),
				hashedToken: 'hashed-token-1',
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplay.id,
				name: 'Active Token',
				description: null,
				revoked: false,
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
				updatedAt: null,
			};

			const mockRevokedToken: Partial<LongLiveTokenEntity> = {
				id: uuid().toString(),
				hashedToken: 'hashed-token-2',
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplay.id,
				name: 'Revoked Token',
				description: null,
				revoked: true,
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				createdAt: new Date(),
				updatedAt: null,
			};

			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest
				.spyOn(tokensService, 'findByOwnerId')
				.mockResolvedValue([mockActiveToken as LongLiveTokenEntity, mockRevokedToken as LongLiveTokenEntity]);

			const result = await controller.getTokens(mockDisplay.id);

			expect(result.data).toHaveLength(1);
			expect(result.data[0].revoked).toBe(false);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.getTokens('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});

	describe('revokeToken', () => {
		it('should revoke all tokens for a display', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(tokensService, 'revokeByOwnerId').mockResolvedValue(undefined);

			await controller.revokeToken(mockDisplay.id);

			expect(service.getOneOrThrow).toHaveBeenCalledWith(mockDisplay.id);
			expect(tokensService.revokeByOwnerId).toHaveBeenCalledWith(mockDisplay.id, TokenOwnerType.DISPLAY);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.revokeToken('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});
});
