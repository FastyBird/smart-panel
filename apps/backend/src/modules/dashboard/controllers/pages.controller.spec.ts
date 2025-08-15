/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DisplayProfileEntity } from '../../system/entities/system.entity';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';
import { DataSourcesTypeMapperService } from '../services/data-source-type-mapper.service';
import { PagesTypeMapperService } from '../services/pages-type-mapper.service';
import { PagesService } from '../services/pages.service';
import { TilesTypeMapperService } from '../services/tiles-type-mapper.service';

import { PagesController } from './pages.controller';

class CreateMockPageDto extends CreatePageDto {
	@Expose({ name: 'mock_value' })
	@IsNotEmpty({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	@IsString({ message: '[{"field":"title","reason":"Mock value must be a non-empty string."}]' })
	mockValue: string;
}

class UpdateMockPageDto extends UpdatePageDto {
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
	get type(): string {
		return 'mock';
	}
}

describe('PagesController', () => {
	let controller: PagesController;
	let service: PagesService;
	let pageMapper: PagesTypeMapperService;
	let tileMapper: TilesTypeMapperService;
	let dataSourceMapper: DataSourcesTypeMapperService;

	const mockDisplay: DisplayProfileEntity = {
		id: uuid().toString(),
		uid: uuid().toString(),
		screenWidth: 1280,
		screenHeight: 720,
		pixelRatio: 2,
		unitSize: 120,
		rows: 6,
		cols: 4,
		primary: true,
		createdAt: new Date(),
		updatedAt: undefined,
	};

	const mockPageOne: MockPageEntity = {
		id: uuid().toString(),
		type: 'mock',
		title: 'Mock page one',
		order: 0,
		dataSource: [],
		display: mockDisplay.id,
		createdAt: new Date(),
		updatedAt: new Date(),
		mockValue: 'Some mock value',
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
						findAll: jest.fn().mockResolvedValue([toInstance(MockPageEntity, mockPageOne)]),
						findOne: jest.fn().mockResolvedValue(toInstance(MockPageEntity, mockPageOne)),
						create: jest.fn().mockResolvedValue(toInstance(MockPageEntity, mockPageOne)),
						update: jest.fn().mockResolvedValue(toInstance(MockPageEntity, mockPageOne)),
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

	afterEach(() => {
		jest.clearAllMocks();
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

			expect(result).toEqual([toInstance(MockPageEntity, mockPageOne)]);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return a single page', async () => {
			const result = await controller.findOne(mockPageOne.id);

			expect(result).toEqual(toInstance(MockPageEntity, mockPageOne));
			expect(service.findOne).toHaveBeenCalledWith(mockPageOne.id);
		});

		it('should create a new page', async () => {
			const createDto: CreateMockPageDto = {
				type: 'tiles',
				title: 'New Page',
				order: 0,
				mockValue: 'New mock value',
			};

			jest.spyOn(pageMapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: MockPageEntity,
				createDto: CreateMockPageDto,
				updateDto: UpdateMockPageDto,
			});

			const result = await controller.create({ data: createDto });

			expect(result).toEqual(toInstance(MockPageEntity, mockPageOne));
			expect(service.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a page', async () => {
			const updateDto: UpdateMockPageDto = {
				type: 'tiles',
				title: 'Updated Page',
			};

			jest.spyOn(pageMapper, 'getMapping').mockReturnValue({
				type: 'tiles',
				class: MockPageEntity,
				createDto: CreateMockPageDto,
				updateDto: UpdateMockPageDto,
			});

			const result = await controller.update(mockPageOne.id, { data: updateDto });

			expect(result).toEqual(toInstance(MockPageEntity, mockPageOne));
			expect(service.update).toHaveBeenCalledWith(mockPageOne.id, updateDto);
		});

		it('should delete a page', async () => {
			const result = await controller.remove(mockPageOne.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockPageOne.id);
		});
	});
});
