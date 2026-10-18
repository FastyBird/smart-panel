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
	let module: TestingModule | undefined;
	let service: ChannelsTypeMapperService;

	beforeEach(async () => {
		module = await Test.createTestingModule({
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

	afterEach(async () => {
		const moduleToClose = module;
		module = undefined;
		await moduleToClose?.close();
	});
	describe('original owned creation mapping continuity', () => {
		it('never revives A after same-object overwrite or A B A and keeps reads pure', () => {
			const a = { type: 'owned-creation', class: MockChannel, createDto: MockCreateChannelDto, updateDto: MockUpdateChannelDto };
			const b = { ...a };
			expect(service.captureMapping('owned-creation')).toBeNull();
			service.registerMapping(a);
			const original = service.captureMapping('owned-creation');
			expect(original?.isCurrent()).toBe(true);
			expect(service.captureMapping('owned-creation')?.isCurrent()).toBe(true);
			expect(service.getMapping('owned-creation')).toBe(a);
			expect(original?.isCurrent()).toBe(true);
			service.registerMapping(a);
			expect(original?.isCurrent()).toBe(false);
			const second = service.captureMapping('owned-creation');
			service.registerMapping(b);
			service.registerMapping(a);
			expect(second?.isCurrent()).toBe(false);
			expect(original?.isCurrent()).toBe(false);
			expect(service.captureMapping('owned-creation')?.isCurrent()).toBe(true);
		});

		it('keeps ordinary accessor mappings usable but refuses owned capture without invoking their accessor', () => {
			const mapping = { type: 'owned-accessor', class: MockChannel, createDto: MockCreateChannelDto, updateDto: MockUpdateChannelDto };
			let reads = 0;
			Object.defineProperty(mapping, 'class', { get: () => { reads++; return MockChannel; } });
			service.registerMapping(mapping);
			expect(service.getMapping('owned-accessor')).toBe(mapping);
			expect(service.captureMapping('owned-accessor')).toBeNull();
			expect(reads).toBe(0);
		});
	});

});
