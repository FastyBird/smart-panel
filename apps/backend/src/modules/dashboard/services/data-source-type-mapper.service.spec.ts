import { Test, TestingModule } from '@nestjs/testing';

import { DashboardException } from '../dashboard.exceptions';
import { CreateDataSourceDto } from '../dto/create-data-source.dto';
import { UpdateDataSourceDto } from '../dto/update-data-source.dto';
import { DataSourceEntity } from '../entities/dashboard.entity';

import { DataSourcesTypeMapperService } from './data-source-type-mapper.service';

class MockDataSource extends DataSourceEntity {}
class MockCreateDto extends CreateDataSourceDto {}
class MockUpdateDto extends UpdateDataSourceDto {}

describe('DataSourceTypeMapperService', () => {
	let service: DataSourcesTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [DataSourcesTypeMapperService],
		}).compile();

		service = module.get<DataSourcesTypeMapperService>(DataSourcesTypeMapperService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerMapping', () => {
		it('should register a data sources type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockDataSource,
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
				class: MockDataSource,
				createDto: MockCreateDto,
				updateDto: MockUpdateDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a DashboardException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new DashboardException('Unsupported data source type: unregistered'),
			);
		});
	});
});
