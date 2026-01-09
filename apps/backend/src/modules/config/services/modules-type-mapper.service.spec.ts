import { Test, TestingModule } from '@nestjs/testing';

import { ConfigException } from '../config.exceptions';
import { UpdateModuleConfigDto } from '../dto/config.dto';
import { ModuleConfigModel } from '../models/config.model';

import { ModulesTypeMapperService } from './modules-type-mapper.service';

class MockModule extends ModuleConfigModel {}
class MockUpdateModuleDto extends UpdateModuleConfigDto {}

describe('ModulesTypeMapperService', () => {
	let service: ModulesTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ModulesTypeMapperService],
		}).compile();

		service = module.get<ModulesTypeMapperService>(ModulesTypeMapperService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerMapping', () => {
		it('should register a module type mapping', () => {
			const mockMapping = {
				type: 'mock-module',
				class: MockModule,
				configDto: MockUpdateModuleDto,
			};

			service.registerMapping(mockMapping);

			const registeredMapping = service.getMapping('mock-module');
			expect(registeredMapping).toEqual(mockMapping);
		});

		it('should trigger callback when mapping is registered', () => {
			const callback = jest.fn();
			service.onMappingsRegistered(callback);

			const mockMapping = {
				type: 'mock-module',
				class: MockModule,
				configDto: MockUpdateModuleDto,
			};

			service.registerMapping(mockMapping);

			expect(callback).toHaveBeenCalled();
		});
	});

	describe('getMapping', () => {
		it('should return the correct mapping for a registered type', () => {
			const mockMapping = {
				type: 'mock-module',
				class: MockModule,
				configDto: MockUpdateModuleDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock-module');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a ConfigException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered-module')).toThrow(
				new ConfigException('Unsupported module type: unregistered-module'),
			);
		});
	});

	describe('getMappings', () => {
		it('should return all registered mappings', () => {
			const mockMapping1 = {
				type: 'mock-module-1',
				class: MockModule,
				configDto: MockUpdateModuleDto,
			};

			const mockMapping2 = {
				type: 'mock-module-2',
				class: MockModule,
				configDto: MockUpdateModuleDto,
			};

			service.registerMapping(mockMapping1);
			service.registerMapping(mockMapping2);

			const mappings = service.getMappings();
			expect(mappings).toHaveLength(2);
			expect(mappings).toContainEqual(mockMapping1);
			expect(mappings).toContainEqual(mockMapping2);
		});

		it('should return empty array when no mappings are registered', () => {
			const mappings = service.getMappings();
			expect(mappings).toHaveLength(0);
		});
	});

	describe('onMappingsRegistered', () => {
		it('should register a callback', () => {
			const callback = jest.fn();
			service.onMappingsRegistered(callback);

			const mockMapping = {
				type: 'mock-module',
				class: MockModule,
				configDto: MockUpdateModuleDto,
			};

			service.registerMapping(mockMapping);
			expect(callback).toHaveBeenCalled();
		});

		it('should throw ConfigException if callback is already registered', () => {
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			service.onMappingsRegistered(callback1);

			expect(() => service.onMappingsRegistered(callback2)).toThrow(
				new ConfigException('Mappings callback already registered'),
			);
		});
	});
});
