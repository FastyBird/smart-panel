import { Test, TestingModule } from '@nestjs/testing';

import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

import { DevicesTypeMapperService } from './devices-type-mapper.service';

class MockDevice extends DeviceEntity {}
class MockCreateDeviceDto extends CreateDeviceDto {}
class MockUpdateDeviceDto extends UpdateDeviceDto {}

describe('DevicesTypeMapperService', () => {
	let module: TestingModule | undefined;
	let service: DevicesTypeMapperService;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			providers: [DevicesTypeMapperService],
		}).compile();

		service = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);
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
		it('should register a device type mapping', () => {
			const mockMapping = {
				type: 'mock',
				class: MockDevice,
				createDto: MockCreateDeviceDto,
				updateDto: MockUpdateDeviceDto,
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
				class: MockDevice,
				createDto: MockCreateDeviceDto,
				updateDto: MockUpdateDeviceDto,
			};

			service.registerMapping(mockMapping);

			const result = service.getMapping('mock');
			expect(result).toEqual(mockMapping);
		});

		it('should throw a DevicesException for an unregistered type', () => {
			expect(() => service.getMapping('unregistered')).toThrow(
				new DevicesException('Unsupported device type: unregistered'),
			);
		});
	});
	describe('original creation capture', () => {
		const mapping = () => ({
			type: 'mock',
			class: MockDevice,
			createDto: MockCreateDeviceDto,
			updateDto: MockUpdateDeviceDto,
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
			const original = new MockDevice();
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
