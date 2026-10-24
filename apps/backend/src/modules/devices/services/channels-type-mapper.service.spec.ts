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
	describe('original creation capture', () => {
		const mapping = () => ({
			type: 'mock',
			class: MockChannel,
			createDto: MockCreateChannelDto,
			updateDto: MockUpdateChannelDto,
		});
		it('permanently retires same-object and A/B/A registrations while ordinary get retains identity', () => {
			const a = mapping();
			service.registerMapping(a);
			const first = service.captureMapping('mock');
			expect(first.current()).toBe(true);
			expect(service.getMapping('mock')).toBe(a);
			service.registerMapping(a);
			expect(first.current()).toBe(false);
			const second = service.captureMapping('mock');
			service.registerMapping(mapping());
			service.registerMapping(a);
			expect(second.current()).toBe(false);
			expect(service.captureMapping('mock').current()).toBe(true);
			expect(() => service.captureMapping('absent')).toThrow('Unsupported');
		});
		it.each(['class', 'createDto', 'afterCreate', 'beforeCreate', 'withStructuralWrite'])(
			'refuses %s accessors without invoking them, preserving ordinary lookup',
			(key) => {
				const a = mapping();
				service.registerMapping(a);
				const captured = service.captureMapping('mock');
				const getter = jest.fn(() => {
					throw new Error('successor getter');
				});
				Object.defineProperty(a, key, { configurable: true, get: getter });
				expect(captured.current()).toBe(false);
				expect(() => service.captureMapping('mock')).toThrow('Creation accessor');
				expect(getter).not.toHaveBeenCalled();
				expect(service.getMapping('mock')).toBe(a);
			},
		);
		it('retains original optional absence, methods and receiver across data-field replacement', async () => {
			const original = new MockChannel();
			const a = {
				...mapping(),
				afterCreate: function (this: object) {
					expect(this).toBe(a);
					return Promise.resolve(original);
				},
			};
			service.registerMapping(a);
			const captured = service.captureMapping('mock');
			expect(await captured.values.afterCreate.call(captured.receiver, original)).toBe(original);
			const successor = () => {
				throw new Error('successor method');
			};
			a.afterCreate = successor;
			expect(captured.current()).toBe(false);
			expect(await captured.values.afterCreate.call(captured.receiver, original)).toBe(original);
			service.registerMapping(mapping());
			const absent = service.captureMapping('mock');
			expect(absent.values.afterCreate).toBeUndefined();
			Reflect.set(absent.receiver, 'afterCreate', successor);
			expect(absent.current()).toBe(false);
		});
	});
});
