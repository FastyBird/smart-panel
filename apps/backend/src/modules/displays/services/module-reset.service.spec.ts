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
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { InfluxDbService } from '../../influxdb/services/influxdb.service';
import { ConnectionState, HomeMode } from '../displays.constants';
import { DisplayEntity } from '../entities/displays.entity';

import { DisplaysModuleResetService } from './module-reset.service';

describe('DisplaysModuleResetService', () => {
	let service: DisplaysModuleResetService;
	let repository: Repository<DisplayEntity>;
	let tokensService: TokensService;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		macAddress: 'AA:BB:CC:DD:EE:FF',
		name: 'Test Display',
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
		spaceId: null,
		space: null,
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
		spaceId: null,
		space: null,
		homeMode: HomeMode.AUTO_SPACE,
		homePageId: null,
		homePage: null,
		status: ConnectionState.UNKNOWN,
		createdAt: new Date(),
		updatedAt: null,
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			clear: jest.fn(),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DisplaysModuleResetService,
				{ provide: getRepositoryToken(DisplayEntity), useFactory: mockRepository },
				{
					provide: TokensService,
					useValue: {
						revokeByOwnerId: jest.fn(),
					},
				},
				{
					provide: InfluxDbService,
					useValue: {
						dropMeasurement: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		service = module.get<DisplaysModuleResetService>(DisplaysModuleResetService);
		repository = module.get<Repository<DisplayEntity>>(getRepositoryToken(DisplayEntity));
		tokensService = module.get<TokensService>(TokensService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(tokensService).toBeDefined();
	});

	describe('reset', () => {
		it('should revoke all display tokens and clear displays', async () => {
			const mockDisplays = [mockDisplay, mockDisplayTwo];

			jest.spyOn(repository, 'find').mockResolvedValue(mockDisplays.map((d) => toInstance(DisplayEntity, d)));
			jest.spyOn(repository, 'clear').mockResolvedValue(undefined);
			jest.spyOn(tokensService, 'revokeByOwnerId').mockResolvedValue(undefined);

			await service.reset();

			expect(repository.find).toHaveBeenCalled();
			expect(tokensService.revokeByOwnerId).toHaveBeenCalledTimes(2);
			expect(tokensService.revokeByOwnerId).toHaveBeenCalledWith(mockDisplay.id, TokenOwnerType.DISPLAY);
			expect(tokensService.revokeByOwnerId).toHaveBeenCalledWith(mockDisplayTwo.id, TokenOwnerType.DISPLAY);
			expect(repository.clear).toHaveBeenCalled();
		});

		it('should handle empty displays list', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([]);
			jest.spyOn(repository, 'clear').mockResolvedValue(undefined);

			await service.reset();

			expect(repository.find).toHaveBeenCalled();
			expect(tokensService.revokeByOwnerId).not.toHaveBeenCalled();
			expect(repository.clear).toHaveBeenCalled();
		});
	});
});
