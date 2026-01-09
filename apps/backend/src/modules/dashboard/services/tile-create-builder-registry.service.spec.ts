import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ITileNestedCreateBuilder } from '../entities/dashboard.relations';

import { TileCreateBuilderRegistryService } from './tile-create-builder-registry.service';

describe('TileCreateBuilderRegistryService', () => {
	let service: TileCreateBuilderRegistryService;

	const mockBuilder: ITileNestedCreateBuilder = {
		supports: jest.fn().mockReturnValue(true),
		build: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TileCreateBuilderRegistryService],
		}).compile();

		service = module.get<TileCreateBuilderRegistryService>(TileCreateBuilderRegistryService);

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
		const anotherBuilder: ITileNestedCreateBuilder = {
			supports: jest.fn().mockReturnValue(false),
			build: jest.fn(),
		};

		service.register(mockBuilder);
		service.register(anotherBuilder);

		const builders = service.getBuilders();

		expect(builders).toEqual([mockBuilder, anotherBuilder]);
	});
});
