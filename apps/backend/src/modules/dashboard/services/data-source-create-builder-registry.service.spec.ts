import { Test, TestingModule } from '@nestjs/testing';

import { IDataSourceNestedCreateBuilder } from '../entities/dashboard.relations';

import { DataSourceCreateBuilderRegistryService } from './data-source-create-builder-registry.service';

describe('DataSourceCreateBuilderRegistryService', () => {
	let service: DataSourceCreateBuilderRegistryService;

	const mockBuilder: IDataSourceNestedCreateBuilder = {
		supports: jest.fn().mockReturnValue(true),
		build: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [DataSourceCreateBuilderRegistryService],
		}).compile();

		service = module.get<DataSourceCreateBuilderRegistryService>(DataSourceCreateBuilderRegistryService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should initially return an empty array of builders', () => {
		expect(service.getBuilders()).toEqual([]);
	});

	it('should register a builder and retrieve it', () => {
		service.register(mockBuilder);

		const builders = service.getBuilders();

		expect(builders.length).toBe(1);
		expect(builders[0]).toBe(mockBuilder);
	});

	it('should register multiple builders', () => {
		const anotherBuilder: IDataSourceNestedCreateBuilder = {
			supports: jest.fn().mockReturnValue(false),
			build: jest.fn(),
		};

		service.register(mockBuilder);
		service.register(anotherBuilder);

		const builders = service.getBuilders();

		expect(builders).toEqual([mockBuilder, anotherBuilder]);
	});
});
