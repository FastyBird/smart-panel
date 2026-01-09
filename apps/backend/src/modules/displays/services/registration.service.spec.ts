/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType, TokenType } from '../../auth/auth.constants';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { TokensService } from '../../auth/services/tokens.service';
import { ConnectionState, DisplayRole, HomeMode } from '../displays.constants';
import { RegisterDisplayDto } from '../dto/register-display.dto';
import { DisplayEntity } from '../entities/displays.entity';

import { DisplaysService } from './displays.service';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
	let service: RegistrationService;
	let displaysService: DisplaysService;
	let tokensService: TokensService;
	let jwtService: JwtService;

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
		room: null,
		homeMode: HomeMode.AUTO_SPACE,
		homePageId: null,
		homePage: null,
		status: ConnectionState.UNKNOWN,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockToken = 'mock-jwt-token-for-display';

	beforeEach(async () => {
		const mockRepository = {
			save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
		} as unknown as Repository<DisplayEntity>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RegistrationService,
				{
					provide: DisplaysService,
					useValue: {
						findByMacAddress: jest.fn(),
						create: jest.fn(),
						update: jest.fn(),
					},
				},
				{
					provide: TokensService,
					useValue: {
						create: jest.fn(),
						revokeByOwnerId: jest.fn(),
					},
				},
				{
					provide: JwtService,
					useValue: {
						sign: jest.fn().mockReturnValue(mockToken),
					},
				},
				{
					provide: getRepositoryToken(DisplayEntity),
					useValue: mockRepository,
				},
			],
		}).compile();

		service = module.get<RegistrationService>(RegistrationService);
		displaysService = module.get<DisplaysService>(DisplaysService);
		tokensService = module.get<TokensService>(TokensService);
		jwtService = module.get<JwtService>(JwtService);

		// Store module reference for later use in tests

		(service as { testModule?: TestingModule }).testModule = module;

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(displaysService).toBeDefined();
		expect(tokensService).toBeDefined();
		expect(jwtService).toBeDefined();
	});

	describe('registerDisplay', () => {
		it('should create a new display and return token when display does not exist', async () => {
			const registerDto: RegisterDisplayDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
				build: '42',
				screen_width: 1920,
				screen_height: 1080,
				pixel_ratio: 1.5,
				unit_size: 8,
				rows: 12,
				cols: 24,
			};

			jest.spyOn(displaysService, 'findByMacAddress').mockResolvedValue(null);
			jest.spyOn(displaysService, 'create').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(tokensService, 'create').mockResolvedValue({} as unknown as LongLiveTokenEntity);

			const result = await service.registerDisplay(registerDto, 'FlutterApp', '127.0.0.1');

			expect(result.display).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(result.accessToken).toBe(mockToken);
			expect(displaysService.findByMacAddress).toHaveBeenCalledWith(registerDto.mac_address);
			expect(displaysService.create).toHaveBeenCalledWith({
				macAddress: registerDto.mac_address,
				version: registerDto.version,
				build: registerDto.build,
				screenWidth: registerDto.screen_width,
				screenHeight: registerDto.screen_height,
				pixelRatio: registerDto.pixel_ratio,
				unitSize: registerDto.unit_size,
				rows: registerDto.rows,
				cols: registerDto.cols,
				audioOutputSupported: false,
				audioInputSupported: false,
				registeredFromIp: '127.0.0.1',
			});
			expect(jwtService.sign).toHaveBeenCalledWith(
				{
					sub: mockDisplay.id,
					type: TokenOwnerType.DISPLAY,
					mac: mockDisplay.macAddress,
				},
				{ expiresIn: '365d' },
			);
			expect(tokensService.create).toHaveBeenCalledWith({
				type: TokenType.LONG_LIVE,
				token: mockToken,
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: mockDisplay.id,
				name: `Display Token - ${mockDisplay.macAddress}`,
				description: `Auto-generated token for display ${mockDisplay.name ?? mockDisplay.macAddress}`,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expiresAt: expect.any(Date),
			});
		});

		it('should update existing display and revoke old tokens', async () => {
			const registerDto: RegisterDisplayDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '2.0.0',
				build: '100',
				screen_width: 1920,
				screen_height: 1080,
				pixel_ratio: 1.5,
				unit_size: 8,
				rows: 12,
				cols: 24,
			};

			const updatedDisplay = { ...mockDisplay, version: '2.0.0', build: '100' };

			jest.spyOn(displaysService, 'findByMacAddress').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(displaysService, 'update').mockResolvedValue(toInstance(DisplayEntity, updatedDisplay));
			jest.spyOn(tokensService, 'revokeByOwnerId').mockResolvedValue(undefined);
			jest.spyOn(tokensService, 'create').mockResolvedValue({} as unknown as LongLiveTokenEntity);

			const testModule = (service as { testModule?: TestingModule }).testModule;
			const mockRepository = testModule.get<Repository<DisplayEntity>>(getRepositoryToken(DisplayEntity));
			jest
				.spyOn(mockRepository, 'save')
				.mockResolvedValue(toInstance(DisplayEntity, { ...updatedDisplay, registeredFromIp: '127.0.0.1' }));

			const result = await service.registerDisplay(registerDto, 'FlutterApp', '127.0.0.1');

			expect(result.display.version).toBe('2.0.0');
			expect(result.accessToken).toBe(mockToken);
			expect(displaysService.findByMacAddress).toHaveBeenCalledWith(registerDto.mac_address);
			expect(tokensService.revokeByOwnerId).toHaveBeenCalledWith(mockDisplay.id, TokenOwnerType.DISPLAY);
			expect(displaysService.update).toHaveBeenCalledWith(mockDisplay.id, {
				version: registerDto.version,
				build: registerDto.build,
				screen_width: registerDto.screen_width,
				screen_height: registerDto.screen_height,
				pixel_ratio: registerDto.pixel_ratio,
				unit_size: registerDto.unit_size,
				rows: registerDto.rows,
				cols: registerDto.cols,
			});
			expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({ registeredFromIp: '127.0.0.1' }));
		});

		it('should use default values when optional fields are not provided', async () => {
			const registerDto: RegisterDisplayDto = {
				mac_address: 'AA:BB:CC:DD:EE:FF',
				version: '1.0.0',
			};

			jest.spyOn(displaysService, 'findByMacAddress').mockResolvedValue(null);
			jest.spyOn(displaysService, 'create').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(tokensService, 'create').mockResolvedValue({} as unknown as LongLiveTokenEntity);

			await service.registerDisplay(registerDto, 'FlutterApp', '192.168.1.100');

			expect(displaysService.create).toHaveBeenCalledWith({
				macAddress: registerDto.mac_address,
				version: registerDto.version,
				build: null,
				screenWidth: 0,
				screenHeight: 0,
				pixelRatio: 1,
				unitSize: 8,
				rows: 12,
				cols: 24,
				audioOutputSupported: false,
				audioInputSupported: false,
				registeredFromIp: '192.168.1.100',
			});
		});
	});
});
