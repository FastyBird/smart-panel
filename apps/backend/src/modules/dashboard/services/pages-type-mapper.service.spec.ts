import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DashboardException } from '../dashboard.exceptions';
import { CreatePageDto } from '../dto/create-page.dto';
import { UpdatePageDto } from '../dto/update-page.dto';
import { PageEntity } from '../entities/dashboard.entity';

import { PagesTypeMapperService } from './pages-type-mapper.service';

class MockPage extends PageEntity {}
class MockCreateDto extends CreatePageDto {}
class MockUpdateDto extends UpdatePageDto {}

describe('PageTypeMapperService', () => {
	let service: PagesTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PagesTypeMapperService],
		}).compile();

		service = module.get<PagesTypeMapperService>(PagesTypeMapperService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerMapping', () => {
		it('should register a pages type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockPage,
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
				class: MockPage,
				createDto: MockCreateDto,
				updateDto: MockUpdateDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a DashboardException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new DashboardException('Unsupported page type: unregistered'),
			);
		});
	});
});
