import { Test, TestingModule } from '@nestjs/testing';

import { ConfigException } from '../config.exceptions';
import { UpdatePluginConfigDto } from '../dto/config.dto';
import { PluginConfigModel } from '../models/config.model';

import { PluginsTypeMapperService } from './plugins-type-mapper.service';

class MockPlugin extends PluginConfigModel {}
class MockCreatePluginDto extends UpdatePluginConfigDto {}

describe('PluginsTypeMapperService', () => {
	let module: TestingModule | undefined;
	let service: PluginsTypeMapperService;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [PluginsTypeMapperService],
		}).compile();

		service = module.get<PluginsTypeMapperService>(PluginsTypeMapperService);
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

	describe('registerMapping', () => {
		it('should register a plugin type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockPlugin,
				configDto: MockCreatePluginDto,
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
				class: MockPlugin,
				configDto: MockCreatePluginDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a ConfigException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new ConfigException('Unsupported plugin type: unregistered'),
			);
		});
	});
});
