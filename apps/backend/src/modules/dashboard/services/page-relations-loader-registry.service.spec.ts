import { Test, TestingModule } from '@nestjs/testing';

import { IPageRelationsLoader } from '../entities/dashboard.relations';

import { PageRelationsLoaderRegistryService } from './page-relations-loader-registry.service';

describe('PageRelationsLoaderRegistryService', () => {
	let service: PageRelationsLoaderRegistryService;

	const mockLoader: IPageRelationsLoader = {
		supports: jest.fn().mockReturnValue(true),
		loadRelations: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PageRelationsLoaderRegistryService],
		}).compile();

		service = module.get<PageRelationsLoaderRegistryService>(PageRelationsLoaderRegistryService);
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
		const anotherLoader: IPageRelationsLoader = {
			supports: jest.fn().mockReturnValue(false),
			loadRelations: jest.fn(),
		};

		service.register(mockLoader);
		service.register(anotherLoader);

		const loaders = service.getLoaders();

		expect(loaders).toEqual([mockLoader, anotherLoader]);
	});
});
