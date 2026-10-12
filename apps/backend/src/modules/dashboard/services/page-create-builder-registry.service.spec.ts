import { Test, TestingModule } from '@nestjs/testing';

import { IPageNestedCreateBuilder } from '../entities/dashboard.relations';

import { PageCreateBuilderRegistryService } from './page-create-builder-registry.service';

describe('PageCreateBuilderRegistryService', () => {
	let module: TestingModule | undefined;
	let service: PageCreateBuilderRegistryService;

	const mockBuilder: IPageNestedCreateBuilder = {
		supports: jest.fn().mockReturnValue(true),
		build: jest.fn(),
	};

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [PageCreateBuilderRegistryService],
		}).compile();

		service = module.get<PageCreateBuilderRegistryService>(PageCreateBuilderRegistryService);
	});

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
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
		const anotherBuilder: IPageNestedCreateBuilder = {
			supports: jest.fn().mockReturnValue(false),
			build: jest.fn(),
		};

		service.register(mockBuilder);
		service.register(anotherBuilder);

		const builders = service.getBuilders();

		expect(builders).toEqual([mockBuilder, anotherBuilder]);
	});
});
