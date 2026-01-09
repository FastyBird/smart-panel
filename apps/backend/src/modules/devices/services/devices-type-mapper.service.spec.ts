import { Logger } from '@nestjs/common';
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
	let service: DevicesTypeMapperService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [DevicesTypeMapperService],
		}).compile();

		service = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);

	});

	afterEach(() => {
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
});
