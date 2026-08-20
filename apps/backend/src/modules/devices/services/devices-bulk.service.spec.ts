import { Test, TestingModule } from '@nestjs/testing';

import { DevicesNotAllowedException } from '../devices.exceptions';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

import { DevicesBulkService } from './devices-bulk.service';
import { DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesService } from './devices.service';

describe('DevicesBulkService', () => {
	let service: DevicesBulkService;
	let devicesService: { findOne: jest.Mock; remove: jest.Mock; update: jest.Mock };
	let mapperService: { getMapping: jest.Mock };

	const device = (id: string, type = 'mock-type'): DeviceEntity => ({ id, type }) as DeviceEntity;

	beforeEach(async () => {
		devicesService = {
			findOne: jest.fn(),
			remove: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue(undefined),
		};

		mapperService = {
			getMapping: jest.fn().mockReturnValue({ updateDto: UpdateDeviceDto }),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DevicesBulkService,
				{ provide: DevicesService, useValue: devicesService },
				{ provide: DevicesTypeMapperService, useValue: mapperService },
			],
		}).compile();

		service = module.get<DevicesBulkService>(DevicesBulkService);
	});

	describe('remove', () => {
		it('removes every device in the selection', async () => {
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(device(id)));

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'b', 'c']);
			expect(result.failed).toEqual([]);
			expect(devicesService.remove).toHaveBeenCalledTimes(3);
		});

		// The per-item endpoints each failed on their own; collapsing them into one
		// request must not turn one refusal into a lost selection.
		it('keeps going after a device fails and reports it', async () => {
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(device(id)));
			devicesService.remove.mockImplementation((id: string) =>
				id === 'b'
					? Promise.reject(new DevicesNotAllowedException('Device is hidden and can not be removed'))
					: Promise.resolve(),
			);

			const result = await service.remove(['a', 'b', 'c']);

			expect(result.succeeded).toEqual(['a', 'c']);
			expect(result.failed).toEqual([{ id: 'b', reason: 'Device is hidden and can not be removed' }]);
		});

		it('reports an unknown device instead of throwing', async () => {
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(id === 'gone' ? null : device(id)));

			const result = await service.remove(['a', 'gone']);

			expect(result.succeeded).toEqual(['a']);
			expect(result.failed).toEqual([{ id: 'gone', reason: 'Requested device does not exist' }]);
			expect(devicesService.remove).toHaveBeenCalledTimes(1);
		});

		it('acts once on a device listed twice', async () => {
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(device(id)));

			const result = await service.remove(['a', 'a', 'b']);

			expect(result.succeeded).toEqual(['a', 'b']);
			expect(devicesService.remove).toHaveBeenCalledTimes(2);
		});
	});

	describe('setEnabled', () => {
		it('updates every device in the selection', async () => {
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(device(id)));

			const result = await service.setEnabled(['a', 'b'], false);

			expect(result.succeeded).toEqual(['a', 'b']);
			expect(result.failed).toEqual([]);
			expect(devicesService.update).toHaveBeenCalledTimes(2);
			expect(devicesService.update).toHaveBeenCalledWith('a', expect.objectContaining({ enabled: false }));
		});

		// The type comes from the stored device, never the request, so a caller
		// cannot route a device through another type's update rules.
		it('resolves the update dto from the stored device type', async () => {
			devicesService.findOne.mockResolvedValue(device('a', 'devices-shelly-ng'));

			await service.setEnabled(['a'], true);

			expect(mapperService.getMapping).toHaveBeenCalledWith('devices-shelly-ng');
		});

		it('reports a device whose type has no registered mapping', async () => {
			devicesService.findOne.mockResolvedValue(device('a', 'gone-plugin'));
			mapperService.getMapping.mockImplementation(() => {
				throw new Error('no mapping');
			});

			const result = await service.setEnabled(['a'], true);

			expect(result.succeeded).toEqual([]);
			expect(result.failed).toEqual([{ id: 'a', reason: 'Unsupported device type: gone-plugin' }]);
			expect(devicesService.update).not.toHaveBeenCalled();
		});

		it('carries the refusal reason back rather than a generic message', async () => {
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(device(id)));
			devicesService.update.mockRejectedValue(new DevicesNotAllowedException('Hidden device placement is immutable'));

			const result = await service.setEnabled(['a'], true);

			expect(result.failed).toEqual([{ id: 'a', reason: 'Hidden device placement is immutable' }]);
		});
	});
});
