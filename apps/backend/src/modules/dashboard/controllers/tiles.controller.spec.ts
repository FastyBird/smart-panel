/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DASHBOARD_MODULE_PREFIX } from '../dashboard.constants';
import { CreateSingleTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { PageEntity, TileEntity } from '../entities/dashboard.entity';
import { TilesTypeMapperService } from '../services/tiles-type-mapper.service';
import { TilesService } from '../services/tiles.service';

import { TilesController } from './tiles.controller';

class CreateMockTileDto extends CreateSingleTileDto {
	@Expose({ name: 'mock_value' })
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue: string;
}

class UpdateMockTileDto extends UpdateTileDto {
	@Expose({ name: 'mock_value' })
	@IsOptional()
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue?: string;
}

class MockPageEntity extends PageEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	@IsArray()
	@ValidateNested({ each: true })
	tiles: TileEntity[];

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class MockTileEntity extends TileEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

describe('TilesController', () => {
	let controller: TilesController;
	let tilesService: TilesService;
	let tileMapper: TilesTypeMapperService;

	const mockPage: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Tiles detail',
		order: 0,
		showTopBar: false,
		dataSource: [],
		displays: [],
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
		tiles: [],
	};

	const mockTile: MockTileEntity = {
		id: uuid().toString(),
		type: 'mock',
		parentType: 'page',
		parentId: mockPage.id,
		row: 0,
		col: 0,
		rowSpan: 0,
		colSpan: 0,
		hidden: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
	} as MockTileEntity;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [TilesController],
			providers: [
				{
					provide: TilesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: TilesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(MockTileEntity, mockTile)]),
						findOne: jest.fn().mockResolvedValue(toInstance(MockTileEntity, mockTile)),
						create: jest.fn().mockResolvedValue(toInstance(MockTileEntity, mockTile)),
						update: jest.fn().mockResolvedValue(toInstance(MockTileEntity, mockTile)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<TilesController>(TilesController);
		tilesService = module.get<TilesService>(TilesService);
		tileMapper = module.get<TilesTypeMapperService>(TilesTypeMapperService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(tilesService).toBeDefined();
		expect(tileMapper).toBeDefined();
	});

	describe('Tiles', () => {
		it('should return all tiles', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(MockTileEntity, mockTile)]);
			expect(tilesService.findAll).toHaveBeenCalled();
		});

		it('should return a single tile', async () => {
			const result = await controller.findOne(mockTile.id);

			expect(result.data).toEqual(toInstance(MockTileEntity, mockTile));
			expect(tilesService.findOne).toHaveBeenCalledWith(mockTile.id);
		});

		it('should create a new tile', async () => {
			const createDto: CreateMockTileDto = {
				type: 'mock',
				row: 1,
				col: 1,
				mockValue: 'New mock value',
				parent: { type: 'page', id: mockPage.id },
			};

			jest.spyOn(tileMapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockTileEntity,
				createDto: CreateMockTileDto,
				updateDto: UpdateMockTileDto,
			});

			const mockRequest = {
				url: '/api/v1/dashboard/tiles',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(toInstance(MockTileEntity, mockTile));
			expect(tilesService.create).toHaveBeenCalledWith(createDto, { parentType: 'page', parentId: mockPage.id });
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(`/api/v1/${DASHBOARD_MODULE_PREFIX}/tiles/${mockTile.id}`),
			);
		});

		it('should update a tile', async () => {
			const updateDto: UpdateMockTileDto = {
				type: 'mock',
				row: 1,
				col: 1,
			};

			jest.spyOn(tileMapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockTileEntity,
				createDto: CreateMockTileDto,
				updateDto: UpdateMockTileDto,
			});

			const result = await controller.update(mockTile.id, { data: updateDto });

			expect(result.data).toEqual(toInstance(MockTileEntity, mockTile));
			expect(tilesService.update).toHaveBeenCalledWith(mockTile.id, updateDto);
		});

		it('should delete a tile', async () => {
			const result = await controller.remove(mockTile.id);

			expect(result).toBeUndefined();
			expect(tilesService.remove).toHaveBeenCalledWith(mockTile.id);
		});
	});
});
