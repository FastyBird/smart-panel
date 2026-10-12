import { Test, TestingModule } from '@nestjs/testing';

import { DevicesException } from '../devices.exceptions';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelPropertyEntity } from '../entities/devices.entity';

import { ChannelsPropertiesTypeMapperService } from './channels.properties-type-mapper.service';

class MockProperty extends ChannelPropertyEntity {}
class MockCreateChannelPropertyDto extends CreateChannelPropertyDto {}
class MockUpdateChannelPropertyDto extends UpdateChannelPropertyDto {}

describe('ChannelsPropertiesTypeMapperService', () => {
	let module: TestingModule | undefined;
	let service: ChannelsPropertiesTypeMapperService;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [ChannelsPropertiesTypeMapperService],
		}).compile();

		service = module.get<ChannelsPropertiesTypeMapperService>(ChannelsPropertiesTypeMapperService);
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
		it('should register a channel property type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockProperty,
				createDto: MockCreateChannelPropertyDto,
				updateDto: MockUpdateChannelPropertyDto,
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
				class: MockProperty,
				createDto: MockCreateChannelPropertyDto,
				updateDto: MockUpdateChannelPropertyDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a DevicesException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new DevicesException('Unsupported channel property type: unregistered'),
			);
		});
	});
});
