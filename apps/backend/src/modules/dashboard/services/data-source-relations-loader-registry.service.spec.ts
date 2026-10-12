import { Test, TestingModule } from '@nestjs/testing';

import { IDataSourceRelationsLoader } from '../entities/dashboard.relations';

import { DataSourceRelationsLoaderRegistryService } from './data-source-relations-loader-registry.service';

describe('DataSourceRelationsLoaderRegistryService', () => {
	let service: DataSourceRelationsLoaderRegistryService;

	const mockLoader: IDataSourceRelationsLoader = {
		supports: jest.fn().mockReturnValue(true),
		loadRelations: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [DataSourceRelationsLoaderRegistryService],
		}).compile();

		service = module.get<DataSourceRelationsLoaderRegistryService>(DataSourceRelationsLoaderRegistryService);
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
		const anotherLoader: IDataSourceRelationsLoader = {
			supports: jest.fn().mockReturnValue(false),
			loadRelations: jest.fn(),
		};

		service.register(mockLoader);
		service.register(anotherLoader);

		const loaders = service.getLoaders();

		expect(loaders).toEqual([mockLoader, anotherLoader]);
	});
});
