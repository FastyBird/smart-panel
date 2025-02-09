/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CreateTilesPageDto } from '../dto/create-page.dto';
import { UpdateTilesPageDto } from '../dto/update-page.dto';
import { TilesPageEntity } from '../entities/dashboard.entity';
import { DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { PagesTypeMapperService } from '../services/pages-type-mapper.service';
import { PagesService } from '../services/pages.service';
import { TilesTypeMapperService } from '../services/tiles-type-mapper.service';

import { PagesController } from './pages.controller';

describe('PagesController', () => {
	let controller: PagesController;
	let service: PagesService;
	let pageMapper: PagesTypeMapperService;
	let tileMapper: TilesTypeMapperService;
	let dataSourceMapper: DataSourcesTypeMapperService;

	const mockTilesPage: TilesPageEntity = {
		id: uuid().toString(),
		type: 'tiles',
		title: 'Tiles detail',
		order: 0,
		tiles: [],
		dataSource: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PagesController],
			providers: [
				{
					provide: PagesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: TilesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DataSourcesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: PagesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([mockTilesPage]),
						findOne: jest.fn().mockResolvedValue(mockTilesPage),
						create: jest.fn().mockResolvedValue(mockTilesPage),
						update: jest.fn().mockResolvedValue(mockTilesPage),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<PagesController>(PagesController);
		service = module.get<PagesService>(PagesService);
		pageMapper = module.get<PagesTypeMapperService>(PagesTypeMapperService);
		tileMapper = module.get<TilesTypeMapperService>(TilesTypeMapperService);
		dataSourceMapper = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(pageMapper).toBeDefined();
		expect(tileMapper).toBeDefined();
		expect(dataSourceMapper).toBeDefined();
	});

	describe('Pages', () => {
		it('should return all pages', async () => {
			const result = await controller.findAll();

			expect(result).toEqual([mockTilesPage]);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return a single page', async () => {
			const result = await controller.findOne(mockTilesPage.id);

			expect(result).toEqual(mockTilesPage);
			expect(service.findOne).toHaveBeenCalledWith(mockTilesPage.id);
		});

		it('should create a new page', async () => {
			const createDto: CreateTilesPageDto = {
				type: 'tiles',
				title: 'New Page',
				order: 0,
			};

			jest.spyOn(pageMapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: TilesPageEntity,
				createDto: CreateTilesPageDto,
				updateDto: UpdateTilesPageDto,
			});

			const result = await controller.create(createDto);

			expect(result).toEqual(mockTilesPage);
			expect(service.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a page', async () => {
			const updateDto: UpdateTilesPageDto = {
				title: 'Updated Page',
			};

			jest.spyOn(pageMapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: TilesPageEntity,
				createDto: CreateTilesPageDto,
				updateDto: UpdateTilesPageDto,
			});

			const result = await controller.update(mockTilesPage.id, updateDto);

			expect(result).toEqual(mockTilesPage);
			expect(service.update).toHaveBeenCalledWith(mockTilesPage.id, updateDto);
		});

		it('should delete a page', async () => {
			const result = await controller.remove(mockTilesPage.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockTilesPage.id);
		});
	});
});
