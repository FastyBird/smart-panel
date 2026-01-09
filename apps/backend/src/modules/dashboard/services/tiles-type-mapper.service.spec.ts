import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DashboardException } from '../dashboard.exceptions';
import { CreateTileDto } from '../dto/create-tile.dto';
import { UpdateTileDto } from '../dto/update-tile.dto';
import { TileEntity } from '../entities/dashboard.entity';

import { TilesTypeMapperService } from './tiles-type-mapper.service';

class MockTile extends TileEntity {}
class MockCreateDto extends CreateTileDto {}
class MockUpdateDto extends UpdateTileDto {}

describe('TileTypeMapperService', () => {
	let service: TilesTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [TilesTypeMapperService],
		}).compile();

		service = module.get<TilesTypeMapperService>(TilesTypeMapperService);

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerMapping', () => {
		it('should register a tiles type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockTile,
				createDto: MockCreateDto,
				updateDto: MockUpdateDto,
			};

			service.registerMapping(mockMapping);

			const registeredMapping = service.getMapping('mock');
			expect(registeredMapping).toEqual(mockMapping);
		});
	});

	describe('getMapping', () => {
		it('should return the correct mapping for a registered type', () => {
			const mockMapping = {
				type: 'mock',
				class: MockTile,
				createDto: MockCreateDto,
				updateDto: MockUpdateDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a DashboardException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new DashboardException('Unsupported tile type: unregistered'),
			);
		});
	});
});
