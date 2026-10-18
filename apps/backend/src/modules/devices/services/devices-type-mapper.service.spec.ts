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
	describe('original owned creation mapping continuity', () => {
		it('never revives A after same-object overwrite or A B A and keeps reads pure', () => {
			const a = { type: 'owned-creation', class: MockDevice, createDto: MockCreateDeviceDto, updateDto: MockUpdateDeviceDto };
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
			const mapping = { type: 'owned-accessor', class: MockDevice, createDto: MockCreateDeviceDto, updateDto: MockUpdateDeviceDto };
			let reads = 0;
			Object.defineProperty(mapping, 'class', { get: () => { reads++; return MockDevice; } });
			service.registerMapping(mapping);
			expect(service.getMapping('owned-accessor')).toBe(mapping);
			expect(service.captureMapping('owned-accessor')).toBeNull();
			expect(reads).toBe(0);
		});
	});

});
