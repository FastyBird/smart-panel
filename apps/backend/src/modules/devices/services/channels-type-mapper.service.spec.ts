import { Test, TestingModule } from '@nestjs/testing';

import { DevicesException } from '../devices.exceptions';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { ChannelEntity } from '../entities/devices.entity';

import { ChannelsTypeMapperService } from './channels-type-mapper.service';

class MockChannel extends ChannelEntity {}
class MockCreateChannelDto extends CreateChannelDto {}
class MockUpdateChannelDto extends UpdateChannelDto {}

describe('ChannelsTypeMapperService', () => {
	let service: ChannelsTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [ChannelsTypeMapperService],
		}).compile();

		service = module.get<ChannelsTypeMapperService>(ChannelsTypeMapperService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('registerMapping', () => {
		it('should register a channel type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockChannel,
				createDto: MockCreateChannelDto,
				updateDto: MockUpdateChannelDto,
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
				class: MockChannel,
				createDto: MockCreateChannelDto,
				updateDto: MockUpdateChannelDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a DevicesException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new DevicesException('Unsupported channel type: unregistered'),
			);
		});
	});
});
