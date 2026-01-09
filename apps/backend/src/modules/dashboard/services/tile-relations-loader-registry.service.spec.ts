import { Test, TestingModule } from '@nestjs/testing';

import { ITileRelationsLoader } from '../entities/dashboard.relations';

import { TileRelationsLoaderRegistryService } from './tile-relations-loader-registry.service';

describe('TileRelationsLoaderRegistryService', () => {
	let service: TileRelationsLoaderRegistryService;

	const mockLoader: ITileRelationsLoader = {
		supports: jest.fn().mockReturnValue(true),
		loadRelations: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TileRelationsLoaderRegistryService],
		}).compile();

		service = module.get<TileRelationsLoaderRegistryService>(TileRelationsLoaderRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should initially return an empty list of loaders', () => {
		expect(service.getLoaders()).toEqual([]);
	});

	it('should register a loader and retrieve it', () => {
		service.register(mockLoader);

		const loaders = service.getLoaders();

		expect(loaders.length).toBe(1);
		expect(loaders[0]).toBe(mockLoader);
	});

	it('should register multiple loaders', () => {
		const anotherLoader: ITileRelationsLoader = {
			supports: jest.fn().mockReturnValue(false),
			loadRelations: jest.fn(),
		};

		service.register(mockLoader);
		service.register(anotherLoader);

		const loaders = service.getLoaders();

		expect(loaders).toEqual([mockLoader, anotherLoader]);
	});
});
